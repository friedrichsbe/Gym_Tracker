import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fitsDay, setExerciseDays } from '../daytypes/dayTypeService'
import { ExerciseClassification } from './ExerciseClassification'
import { useExercises, useRecentExerciseIds } from '../data/hooks'
import type { DayType, EquipmentType, Exercise } from '../domain/types'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { createCustomExercise, normalize, searchExercises, setFavorite } from './exerciseService'
import { IconPlus, IconStar } from '../ui/icons'
import { LangToggle } from '../ui/LangToggle'
import { useNameLang } from '../ui/lang'
import { germanNameFor } from './seed'

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
  /** Overrides the sheet title. */
  title?: string
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
  title: titleOverride,
}: Props) {
  const all = useExercises()
  const recentIds = useRecentExerciseIds()
  const { guard, show } = useToast()
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState<string | undefined>()
  const [equipment, setEquipment] = useState<EquipmentType>('machine')
  const [selected, setSelected] = useState<string[]>([])
  const [belongsTo, setBelongsTo] = useState<string[] | null>(null)
  const [newMuscles, setNewMuscles] = useState<string[]>([])
  const [filterEquipment, setFilterEquipment] = useState('')
  const [filterMuscle, setFilterMuscle] = useState('')
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const lang = useNameLang()
  const searchRef = useRef<HTMLInputElement>(null)
  // "New exercise" form: opened by the button below the list, or offered when a search finds nothing.
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState<string | null>(null)
  const createRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  const labelOf = useCallback(
    (e: Exercise) => (lang === 'de' ? (germanNameFor(e.name, e.aliases, normalize) ?? e.name) : e.name),
    [lang],
  )

  // Sheet opens the dialog in its own effect (child effects run first), so focusing here sticks.
  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  const specificDay = day && !day.matchAll ? day : null
  const fits = (e: Exercise) => fitsDay(e, day, extraFitIds)

  const { suggested, others } = useMemo(() => {
    const active = all.filter(
      (e) =>
        !e.archivedAt &&
        (!filterEquipment || e.equipmentType === filterEquipment) &&
        (!filterMuscle || e.muscleTags.includes(filterMuscle)) &&
        (!onlyFavorites || e.favorite),
    )
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
      return (e.favorite ? -1 : 0) * 1000 + (i === -1 ? 500 : i) // favourites first, then recent
    }
    const fitting = active
      .filter((e) => fitsDay(e, day, extraFitIds))
      .sort((a, b) => rank(a) - rank(b) || labelOf(a).localeCompare(labelOf(b)))
    const rest = active
      .filter((e) => !fitsDay(e, day, extraFitIds))
      .sort((a, b) => labelOf(a).localeCompare(labelOf(b)))
    return { suggested: fitting, others: rest }
  }, [all, query, recentIds, day, extraFitIds, filterEquipment, filterMuscle, onlyFavorites, labelOf])
  const muscleOptions = useMemo(
    () => [...new Set(all.filter((e) => !e.archivedAt).flatMap((e) => e.muscleTags))].sort(),
    [all],
  )

  const exactMatch = all.some(
    (e) =>
      !e.archivedAt && (e.nameKey === normalize(query) || e.aliases.some((a) => normalize(a) === normalize(query))),
  )
  const chosenDays = belongsTo ?? (specificDay ? [specificDay.id] : [])
  const name = newName ?? query.trim()
  const showCreate = creating || (!!query.trim() && !exactMatch)
  const openCreate = () => {
    setCreating(true)
    setNewName(query.trim())
    // After the form has rendered: bring it into view and put the cursor in the name field.
    window.setTimeout(() => {
      createRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      nameRef.current?.focus({ preventScroll: true })
    }, 0)
  }

  const reset = () => {
    setQuery('')
    setReason(undefined)
    setSelected([])
    setBelongsTo(null)
    setNewMuscles([])
    setCreating(false)
    setNewName(null)
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
          <span className="list-title">{labelOf(e)}</span>
          <span className="list-sub">{e.equipmentType}</span>
        </span>
        {outside && <span className="tag foreign">Outside {specificDay!.name}</span>}
      </>
    )
    return (
      <li key={e.id} className="pick-item">
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
        <button
          type="button"
          className="btn ghost icon star-btn"
          aria-pressed={!!e.favorite}
          aria-label={e.favorite ? `Remove ${e.name} from favorites` : `Add ${e.name} to favorites`}
          onClick={() => void guard(() => setFavorite(e.id, !e.favorite))}
        >
          <IconStar filled={!!e.favorite} />
        </button>
      </li>
    )
  }

  const title =
    titleOverride ??
    (mode === 'replace'
      ? 'Replace exercise'
      : mode === 'multi'
        ? 'Pick exercises'
        : `Add exercise${specificDay ? ` · ${specificDay.name}` : ''}`)

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

      <div className="search-row">
        <div className="field grow">
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
            onChange={(e) => {
              setQuery(e.target.value)
              if (!creating) setNewName(null)
            }}
          />
        </div>
        <LangToggle />
      </div>

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="pick-eq">Equipment</label>
          <select id="pick-eq" value={filterEquipment} onChange={(e) => setFilterEquipment(e.target.value)}>
            <option value="">Any</option>
            {EQUIPMENT.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pick-mu">Muscle</label>
          <select id="pick-mu" value={filterMuscle} onChange={(e) => setFilterMuscle(e.target.value)}>
            <option value="">Any</option>
            {muscleOptions.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="chip-row">
        <button type="button" className="chip" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites((v) => !v)}>
          ★ Favorites only
        </button>
      </div>

      {!query.trim() && specificDay && <p className="section-label">Suggested for {specificDay.name}</p>}
      {!query.trim() && !specificDay && recentIds.length > 0 && <p className="section-label">Recent first</p>}

      <ul className="list">{suggested.map(row)}</ul>
      {suggested.length === 0 && others.length === 0 && (
        <div className="empty">
          <p className="empty-title">No match</p>
          <p>Try another name or filter — or create it below.</p>
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

      {!showCreate && (
        <button type="button" className="btn block dashed" onClick={openCreate}>
          <IconPlus />
          New exercise
        </button>
      )}

      {showCreate && (
        <div className="card stack create-card" ref={createRef}>
          <div className="card-head">
            <strong>{creating ? 'New exercise' : `Not found — create “${query.trim()}”?`}</strong>
            {creating && (
              <button type="button" className="btn ghost small" onClick={() => setCreating(false)}>
                Cancel
              </button>
            )}
          </div>
          <div className="field">
            <label htmlFor="new-name">Name</label>
            <input
              id="new-name"
              ref={nameRef}
              type="text"
              autoComplete="off"
              placeholder="e.g. Cable Fly"
              value={name}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
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
          <ExerciseClassification
            muscles={newMuscles}
            onMuscles={setNewMuscles}
            dayIds={chosenDays}
            onDayIds={setBelongsTo}
          />
          <button
            type="button"
            className="btn primary"
            disabled={!name.trim()}
            onClick={() =>
              void guard(async () => {
                const { exercise, created } = await createCustomExercise({
                  name,
                  equipmentType: equipment,
                  muscleTags: newMuscles,
                })
                if (created) await setExerciseDays(exercise.id, chosenDays)
                else show(`“${exercise.name}” already exists — using it`)
                if (mode === 'multi') {
                  setSelected((xs) => (xs.includes(exercise.id) ? xs : [...xs, exercise.id]))
                  setQuery('')
                  setCreating(false)
                  setNewName(null)
                  setNewMuscles([])
                } else {
                  onPick?.(exercise, mode === 'replace' ? reason : undefined)
                  close()
                }
              })
            }
          >
            <IconPlus />
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
