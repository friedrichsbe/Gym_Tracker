import { useEffect, useMemo, useRef, useState } from 'react'
import { fitsDay, addExerciseToDayType } from '../daytypes/dayTypeService'
import { useDayTypes, useExercises, useRecentExerciseIds } from '../data/hooks'
import type { DayType, EquipmentType, Exercise } from '../domain/types'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { createCustomExercise, normalize, searchExercises } from './exerciseService'

const REASONS = ['Occupied', 'Not available', 'Preferred alternative']
const EQUIPMENT: EquipmentType[] = ['machine', 'dumbbell', 'barbell', 'cable', 'bodyweight', 'other']

interface Props {
  open: boolean
  /** add/replace pick one exercise; multi collects several (workout start, routine editor). */
  mode: 'add' | 'replace' | 'multi'
  /** Day the exercises are suggested for. Exercises outside it stay available but are marked. */
  day?: DayType | null
  /** Exercises that count as inside even if their muscles don't match (e.g. the session's routine). */
  extraFitIds?: ReadonlySet<string>
  /** Name of the exercise being replaced (replace mode). */
  replacing?: string
  confirmLabel?: (count: number) => string
  onClose: () => void
  onPick?: (exercise: Exercise, reason?: string) => void
  onConfirm?: (exerciseIds: string[]) => void
}

export function ExercisePicker({
  open,
  mode,
  day,
  extraFitIds,
  replacing,
  confirmLabel,
  onClose,
  onPick,
  onConfirm,
}: Props) {
  const all = useExercises()
  const recentIds = useRecentExerciseIds()
  const { active: dayTypes } = useDayTypes()
  const { guard } = useToast()
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState<string | undefined>()
  const [equipment, setEquipment] = useState<EquipmentType>('machine')
  const [selected, setSelected] = useState<string[]>([])
  const [belongsTo, setBelongsTo] = useState<string[] | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Sheet opens the dialog in its own effect (child effects run first), so focusing here sticks.
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  const specificDay = day && !day.matchAll ? day : null
  const fits = (e: Exercise) => fitsDay(e, day, extraFitIds)

  const { suggested, others } = useMemo(() => {
    const active = all.filter((e) => !e.archivedAt)
    if (query.trim()) {
      const found = searchExercises(active, query).slice(0, 60)
      return {
        suggested: [
          ...found.filter((e) => fitsDay(e, day, extraFitIds)),
          ...found.filter((e) => !fitsDay(e, day, extraFitIds)),
        ],
        others: [],
      }
    }
    const rank = (e: Exercise) => {
      const i = recentIds.indexOf(e.id)
      return i === -1 ? Infinity : i
    }
    const fitting = active
      .filter((e) => fitsDay(e, day, extraFitIds))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    const rest = active.filter((e) => !fitsDay(e, day, extraFitIds)).sort((a, b) => a.name.localeCompare(b.name))
    return { suggested: fitting, others: rest }
  }, [all, query, recentIds, day, extraFitIds])

  const exactMatch = all.some(
    (e) =>
      !e.archivedAt && (e.nameKey === normalize(query) || e.aliases.some((a) => normalize(a) === normalize(query))),
  )
  const chosenDays = belongsTo ?? (specificDay ? [specificDay.id] : [])

  const reset = () => {
    setQuery('')
    setReason(undefined)
    setSelected([])
    setBelongsTo(null)
  }
  const close = () => {
    reset()
    onClose()
  }
  const choose = (e: Exercise) => {
    if (mode === 'multi') {
      setSelected((xs) => (xs.includes(e.id) ? xs.filter((x) => x !== e.id) : [...xs, e.id]))
      return
    }
    onPick?.(e, mode === 'replace' ? reason : undefined)
    close()
  }

  const row = (e: Exercise) => {
    const outside = !!specificDay && !fits(e)
    const content = (
      <>
        <span className="grow">
          <span className="list-title">{e.name}</span>
          <span className="list-sub">{e.equipmentType}</span>
        </span>
        {outside && <span className="tag foreign">Outside {specificDay!.name}</span>}
      </>
    )
    return (
      <li key={e.id}>
        {mode === 'multi' ? (
          <label className="pick-row">
            <input type="checkbox" checked={selected.includes(e.id)} onChange={() => choose(e)} />
            {content}
          </label>
        ) : (
          <button type="button" className="list-btn" onClick={() => choose(e)}>
            {content}
          </button>
        )}
      </li>
    )
  }

  const title =
    mode === 'replace'
      ? 'Replace exercise'
      : mode === 'multi'
        ? 'Pick exercises'
        : `Add exercise${specificDay ? ` · ${specificDay.name}` : ''}`

  return (
    <Sheet open={open} title={title} onClose={close}>
      {mode === 'replace' && replacing && (
        <p className="secondary small">
          Replacing <strong>{replacing}</strong>. Sets already logged stay with it.
        </p>
      )}
      {mode === 'replace' && (
        <div className="chip-row" role="group" aria-label="Reason">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              className="chip"
              aria-pressed={reason === r}
              onClick={() => setReason(reason === r ? undefined : r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      <div className="field">
        <label htmlFor="exercise-search" className="sr-only">
          Search exercises
        </label>
        <input
          id="exercise-search"
          type="search"
          autoComplete="off"
          ref={searchRef}
          placeholder="Name, alias, muscle or equipment"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {!query.trim() && specificDay && <p className="section-label">Suggested for {specificDay.name}</p>}
      {!query.trim() && !specificDay && recentIds.length > 0 && <p className="section-label">Recent first</p>}

      <ul className="list">{suggested.map(row)}</ul>
      {suggested.length === 0 && others.length === 0 && (
        <div className="empty">
          <p className="empty-title">No match</p>
          <p>Try another name, muscle or piece of equipment — or create it below.</p>
        </div>
      )}

      {others.length > 0 && (
        <details>
          <summary>
            Other exercises ({others.length}) — marked as outside {specificDay?.name}
          </summary>
          <ul className="list">{others.map(row)}</ul>
        </details>
      )}

      {query.trim() && !exactMatch && (
        <div className="card stack create-card">
          <strong>Create “{query.trim()}”</strong>
          <div className="field">
            <label htmlFor="new-equipment">Equipment</label>
            <select
              id="new-equipment"
              value={equipment}
              onChange={(e) => setEquipment(e.target.value as EquipmentType)}
            >
              {EQUIPMENT.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          {dayTypes.some((d) => !d.matchAll) && (
            <div className="stack tight">
              <span className="field-label">Counts as</span>
              <div className="chip-row" role="group" aria-label="Counts as">
                {dayTypes
                  .filter((d) => !d.matchAll)
                  .map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className="chip"
                      aria-pressed={chosenDays.includes(d.id)}
                      onClick={() =>
                        setBelongsTo(
                          chosenDays.includes(d.id) ? chosenDays.filter((x) => x !== d.id) : [...chosenDays, d.id],
                        )
                      }
                    >
                      {d.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              void guard(async () => {
                const { exercise, created } = await createCustomExercise({ name: query, equipmentType: equipment })
                if (created) for (const id of chosenDays) await addExerciseToDayType(id, exercise.id)
                if (mode === 'multi') {
                  setSelected((xs) => (xs.includes(exercise.id) ? xs : [...xs, exercise.id]))
                  setQuery('')
                } else {
                  onPick?.(exercise, mode === 'replace' ? reason : undefined)
                  close()
                }
              })
            }
          >
            {mode === 'multi' ? 'Create and select' : 'Create and use'}
          </button>
        </div>
      )}

      {mode === 'multi' && (
        <div className="sticky-bottom">
          <button
            type="button"
            className="btn primary big"
            disabled={selected.length === 0}
            onClick={() => {
              onConfirm?.(selected)
              close()
            }}
          >
            {confirmLabel
              ? confirmLabel(selected.length)
              : `Use ${selected.length} exercise${selected.length === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </Sheet>
  )
}
