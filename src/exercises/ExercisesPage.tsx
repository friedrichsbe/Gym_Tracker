import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { setExerciseDays } from '../daytypes/dayTypeService'
import { ExerciseClassification } from './ExerciseClassification'
import { useDayTypes, useExercises, useSettings } from '../data/hooks'
import type { EquipmentType, Exercise } from '../domain/types'
import { IconChevronLeft, IconChevronRight, IconPlus } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import {
  archiveExercise,
  createCustomExercise,
  setFavorite,
  exerciseUsage,
  mergeExercises,
  previewMerge,
  searchExercises,
  unarchiveExercise,
  updateExercise,
  type MergeImpact,
} from './exerciseService'

const EQUIPMENT: EquipmentType[] = ['machine', 'dumbbell', 'barbell', 'cable', 'bodyweight', 'other']

export function ExercisesPage() {
  const all = useExercises()
  const usage = useLiveQuery(exerciseUsage, [])
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'active' | 'archived'>('active')
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)

  const shown = useMemo(() => {
    const pool = all.filter((e) => (view === 'archived' ? !!e.archivedAt : !e.archivedAt))
    if (query.trim()) {
      // searchExercises hides archived ones, so search the archived pool by plain name match.
      return view === 'archived'
        ? pool.filter((e) => e.nameKey.includes(query.trim().toLowerCase()))
        : searchExercises(pool, query)
    }
    return [...pool].sort((a, b) => a.name.localeCompare(b.name))
  }, [all, query, view])
  const archivedCount = all.filter((e) => e.archivedAt).length

  return (
    <main className="content">
      <Link to="/settings" className="link-subtle">
        <IconChevronLeft />
        Settings
      </Link>
      <div className="page-head">
        <h1>Exercises</h1>
        <button type="button" className="btn primary small" onClick={() => setEditing('new')}>
          <IconPlus />
          New
        </button>
      </div>
      <p className="page-intro">
        Rename, tag and tidy your exercise list. Past workouts keep working: nothing here rewrites history, and
        exercises are archived, never deleted.
      </p>

      <div className="field">
        <label htmlFor="ex-search">Search</label>
        <input
          id="ex-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, alias, muscle or equipment"
          autoComplete="off"
        />
      </div>
      <div className="segmented full" role="group" aria-label="Show">
        <button type="button" aria-pressed={view === 'active'} onClick={() => setView('active')}>
          Active ({all.length - archivedCount})
        </button>
        <button type="button" aria-pressed={view === 'archived'} onClick={() => setView('archived')}>
          Archived ({archivedCount})
        </button>
      </div>

      {shown.length === 0 && <p className="hint">{query ? 'No match.' : 'Nothing here yet.'}</p>}
      <ul className="list card" aria-label="Exercises">
        {shown.map((e) => {
          const u = usage?.get(e.id)
          return (
            <li key={e.id}>
              <button type="button" className="list-btn" onClick={() => setEditing(e)}>
                <span className="grow">
                  <span className="list-title">
                    {e.favorite ? '★ ' : ''}
                    {e.name}
                  </span>
                  <span className="list-sub">
                    {[
                      e.equipmentType,
                      e.muscleTags.slice(0, 3).join(', '),
                      u ? `${u.sets} sets in ${u.workouts} ${u.workouts === 1 ? 'workout' : 'workouts'}` : 'never used',
                      e.defaultRestSeconds ? `rest ${e.defaultRestSeconds}s` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="chev" aria-hidden="true">
                  <IconChevronRight />
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <Sheet
        open={editing !== null}
        title={editing === 'new' ? 'New exercise' : 'Edit exercise'}
        onClose={() => setEditing(null)}
      >
        <ExerciseForm
          key={typeof editing === 'object' && editing ? editing.id : 'new'}
          existing={typeof editing === 'object' ? editing : null}
          defaultRest={settings.restDefaultSeconds}
          onDone={() => setEditing(null)}
        />
      </Sheet>
    </main>
  )
}

function ExerciseForm({
  existing,
  defaultRest,
  onDone,
}: {
  existing: Exercise | null
  defaultRest: number
  onDone: () => void
}) {
  const { guard, show } = useToast()
  const all = useExercises()
  const usage = useLiveQuery(exerciseUsage, [])
  const [name, setName] = useState(existing?.name ?? '')
  const [aliases, setAliases] = useState((existing?.aliases ?? []).join(', '))
  const [equipment, setEquipment] = useState<EquipmentType>(existing?.equipmentType ?? 'machine')
  const [muscles, setMuscles] = useState<string[]>(existing?.muscleTags ?? [])
  const [rest, setRest] = useState(existing?.defaultRestSeconds ? String(existing.defaultRestSeconds) : '')
  const [merging, setMerging] = useState(false)
  // Day assignment: shown from the stored data until the user changes it, so nothing is overwritten unintentionally.
  const { active: activeDays, archived: archivedDays } = useDayTypes()
  const storedDayIds = existing
    ? [...activeDays, ...archivedDays].filter((d) => d.exerciseIds.includes(existing.id)).map((d) => d.id)
    : []
  const [dayIdsEdit, setDayIdsEdit] = useState<string[] | null>(null)
  const [favorite, setFavoriteFlag] = useState(!!existing?.favorite)
  const dayIds = dayIdsEdit ?? storedDayIds
  const u = existing ? usage?.get(existing.id) : undefined

  const restValue = rest.trim() === '' ? null : Number(rest)
  const restInvalid = restValue !== null && (!Number.isInteger(restValue) || restValue < 5 || restValue > 1800)
  const aliasList = aliases.split(',')

  return (
    <>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim() || restInvalid) return
          void guard(async () => {
            if (existing) {
              await updateExercise(existing.id, {
                name,
                aliases: aliasList,
                equipmentType: equipment,
                muscleTags: muscles,
                defaultRestSeconds: restValue,
              })
              if (dayIdsEdit) await setExerciseDays(existing.id, dayIdsEdit)
              if (favorite !== !!existing.favorite) await setFavorite(existing.id, favorite)
            } else {
              const { exercise, created } = await createCustomExercise({
                name,
                aliases: aliasList.map((a) => a.trim()).filter(Boolean),
                equipmentType: equipment,
                muscleTags: muscles,
                defaultRestSeconds: restValue,
              })
              if (!created) {
                show(`“${name.trim()}” already exists — nothing was added`)
                return
              }
              await setExerciseDays(exercise.id, dayIds)
              if (favorite) await setFavorite(exercise.id, true)
            }
            onDone()
          })
        }}
      >
        <div className="field">
          <label htmlFor="e-name">Name</label>
          <input id="e-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="e-alias">Other names (comma separated)</label>
          <input
            id="e-alias"
            type="text"
            value={aliases}
            onChange={(e) => setAliases(e.target.value)}
            placeholder="e.g. Beinpresse, Sled press"
            autoComplete="off"
          />
          <span className="hint">
            The search also finds the exercise by these names. Standard exercises already include their German and
            English names — add your own on top.
          </span>
        </div>
        <div className="field">
          <label htmlFor="e-equipment">Equipment</label>
          <select id="e-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value as EquipmentType)}>
            {EQUIPMENT.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        <ExerciseClassification muscles={muscles} onMuscles={setMuscles} dayIds={dayIds} onDayIds={setDayIdsEdit} />
        <label className="check-row">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavoriteFlag(e.target.checked)} />
          <span>Favorite (listed first when picking exercises)</span>
        </label>
        <div className="field">
          <label htmlFor="e-rest">Rest after a set (seconds)</label>
          <input
            id="e-rest"
            type="text"
            inputMode="numeric"
            value={rest}
            onChange={(e) => setRest(e.target.value.replace(/\D/g, ''))}
            placeholder={`Default (${defaultRest})`}
            aria-invalid={restInvalid}
          />
          <span className="hint">
            {restInvalid ? 'Use 5–1800 seconds, or leave empty.' : 'Empty = your default rest.'}
          </span>
        </div>
        <button type="submit" className="btn primary" disabled={!name.trim() || restInvalid}>
          {existing ? 'Save' : 'Create exercise'}
        </button>
      </form>

      {existing && (
        <div className="stack">
          <p className="hint">
            {u
              ? `Used in ${u.workouts} workouts (${u.sets} sets) and ${u.presets} presets.`
              : 'Not used in any workout yet.'}
          </p>
          {!existing.archivedAt && (
            <button type="button" className="btn block" onClick={() => setMerging(true)}>
              This is a duplicate — merge into another…
            </button>
          )}
          {existing.archivedAt ? (
            <button
              type="button"
              className="btn block"
              onClick={() =>
                void guard(async () => {
                  await unarchiveExercise(existing.id)
                  onDone()
                })
              }
            >
              Restore exercise
            </button>
          ) : (
            <button
              type="button"
              className="btn ghost danger-text block"
              onClick={() =>
                void guard(async () => {
                  await archiveExercise(existing.id)
                  show(`“${existing.name}” archived`, {
                    actionLabel: 'Undo',
                    onAction: () => void guard(() => unarchiveExercise(existing.id)),
                  })
                  onDone()
                })
              }
            >
              Archive exercise
            </button>
          )}
          <p className="hint">Archiving hides it from pickers; workouts and statistics that use it stay intact.</p>
        </div>
      )}

      {existing && (
        <MergeSheet
          open={merging}
          source={existing}
          candidates={all.filter((e) => !e.archivedAt && e.id !== existing.id)}
          onClose={() => setMerging(false)}
          onMerged={() => {
            setMerging(false)
            onDone()
          }}
        />
      )}
    </>
  )
}

function MergeSheet(props: {
  open: boolean
  source: Exercise
  candidates: Exercise[]
  onClose: () => void
  onMerged: () => void
}) {
  const { open, source, candidates, onClose, onMerged } = props
  return (
    <Sheet open={open} title={`Merge “${source.name}”`} onClose={onClose}>
      <MergeBody source={source} candidates={candidates} onMerged={onMerged} />
    </Sheet>
  )
}

function MergeBody({
  source,
  candidates,
  onMerged,
}: {
  source: Exercise
  candidates: Exercise[]
  onMerged: () => void
}) {
  const { guard, show } = useToast()
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<Exercise | null>(null)
  const usage = useLiveQuery(exerciseUsage, [])
  const impact = useLiveQuery<MergeImpact | undefined>(() => previewMerge(source.id), [source.id])
  const results = useMemo(
    () =>
      (query.trim()
        ? searchExercises(candidates, query)
        : [...candidates].sort((a, b) => a.name.localeCompare(b.name))
      ).slice(0, 40),
    [candidates, query],
  )

  if (target) {
    return (
      <div className="stack">
        <p>
          Merge <strong>{source.name}</strong> into <strong>{target.name}</strong>?
        </p>
        <ul className="plain-list stack tight">
          <li>
            {impact?.instances ?? 0} workout entries ({impact?.sets ?? 0} sets) will count as{' '}
            <strong>{target.name}</strong>
          </li>
          <li>{impact?.presets ?? 0} preset entries will use it</li>
          {(impact?.days ?? 0) > 0 && <li>{impact?.days} training day assignment(s) move over</li>}
          <li>
            “{source.name}” becomes another name for {target.name} and is archived.
          </li>
        </ul>
        <p className="hint">
          Your sets are not changed — only which exercise they belong to. This can’t be undone automatically.
        </p>
        <button
          type="button"
          className="btn primary"
          onClick={() =>
            void guard(async () => {
              await mergeExercises(source.id, target.id)
              show(`Merged into “${target.name}”`)
              onMerged()
            })
          }
        >
          Merge
        </button>
        <button type="button" className="btn" onClick={() => setTarget(null)}>
          Choose a different exercise
        </button>
      </div>
    )
  }

  return (
    <div className="stack">
      <p className="secondary small">Which exercise should be kept?</p>
      <div className="field">
        <label htmlFor="merge-search">Search exercises</label>
        <input
          id="merge-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>
      <ul className="list">
        {results.map((e) => (
          <li key={e.id}>
            <button type="button" className="list-btn" onClick={() => setTarget(e)}>
              <span className="grow">
                <span className="list-title">{e.name}</span>
                <span className="list-sub">
                  {e.equipmentType} ·{' '}
                  {usage?.get(e.id)
                    ? `${usage.get(e.id)!.sets} sets in ${usage.get(e.id)!.workouts} workouts`
                    : 'never used'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {results.length === 0 && <p className="hint">No match.</p>}
    </div>
  )
}
