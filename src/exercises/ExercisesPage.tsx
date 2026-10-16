import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fitsDay, setExerciseDays } from '../daytypes/dayTypeService'
import { ExerciseClassification } from './ExerciseClassification'
import { useDayTypes, useExercises, useSettings } from '../data/hooks'
import type { EquipmentType, Exercise } from '../domain/types'
import { IconChevronLeft, IconChevronRight, IconPlus, IconStar, IconTrash } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import {
  archiveExercise,
  createCustomExercise,
  deleteExercisePermanently,
  previewDelete,
  setFavorite,
  exerciseUsage,
  mergeExercises,
  previewMerge,
  searchExercises,
  unarchiveExercise,
  updateExercise,
  type DeleteImpact,
  type MergeImpact,
} from './exerciseService'

const EQUIPMENT: EquipmentType[] = ['machine', 'dumbbell', 'barbell', 'cable', 'bodyweight', 'other']

type Source = 'builtin' | 'custom'
const NO_DAY = '__none'

export function ExercisesPage() {
  const all = useExercises()
  const usage = useLiveQuery(exerciseUsage, [])
  const settings = useSettings()
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'active' | 'archived'>('active')
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const { active: dayTypes } = useDayTypes()
  // Optional filters; nothing selected = no restriction. Selecting several in one group means "any of these".
  const [sources, setSources] = useState<Source[]>([])
  const [dayFilter, setDayFilter] = useState<string[]>([])

  // "Mix"-style days match every exercise, so they are no use as a filter.
  const filterDays = useMemo(() => dayTypes.filter((d) => !d.matchAll), [dayTypes])

  const shown = useMemo(() => {
    const dayOf = (e: Exercise) => filterDays.filter((d) => fitsDay(e, d)).map((d) => d.id)
    const pool = all.filter((e) => {
      if ((view === 'archived') !== !!e.archivedAt) return false
      if (sources.length > 0 && !sources.includes(e.isCustom ? 'custom' : 'builtin')) return false
      if (dayFilter.length > 0) {
        const mine = dayOf(e)
        const hit = dayFilter.includes(NO_DAY) ? mine.length === 0 : false
        if (!hit && !mine.some((id) => dayFilter.includes(id))) return false
      }
      return true
    })
    if (query.trim()) {
      // searchExercises hides archived ones, so search the archived pool by plain name match.
      return view === 'archived'
        ? pool.filter((e) => e.nameKey.includes(query.trim().toLowerCase()))
        : searchExercises(pool, query)
    }
    return [...pool].sort((a, b) => a.name.localeCompare(b.name))
  }, [all, query, view, sources, dayFilter, filterDays])
  const filtering = sources.length > 0 || dayFilter.length > 0
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
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
        Rename, tag and tidy your exercise list. Past workouts keep working: nothing here rewrites history. Archived
        exercises can be deleted for good.
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

      <div className="filters">
        <div className="filter-group" role="group" aria-label="Origin">
          <span className="filter-label">Origin</span>
          <button
            type="button"
            className="chip"
            aria-pressed={sources.includes('builtin')}
            onClick={() => setSources((v) => toggle(v, 'builtin'))}
          >
            Built-in
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={sources.includes('custom')}
            onClick={() => setSources((v) => toggle(v, 'custom'))}
          >
            Added by me
          </button>
        </div>
        {filterDays.length > 0 && (
          <div className="filter-group" role="group" aria-label="Training day">
            <span className="filter-label">Training day</span>
            {filterDays.map((d) => (
              <button
                key={d.id}
                type="button"
                className="chip"
                aria-pressed={dayFilter.includes(d.id)}
                onClick={() => setDayFilter((v) => toggle(v, d.id))}
              >
                {d.name}
              </button>
            ))}
            <button
              type="button"
              className="chip"
              aria-pressed={dayFilter.includes(NO_DAY)}
              onClick={() => setDayFilter((v) => toggle(v, NO_DAY))}
            >
              No day
            </button>
          </div>
        )}
        {filtering && (
          <div className="row-between">
            <span className="small muted num">
              {shown.length} {shown.length === 1 ? 'exercise' : 'exercises'}
            </span>
            <button
              type="button"
              className="btn ghost small"
              onClick={() => {
                setSources([])
                setDayFilter([])
              }}
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {shown.length === 0 && <p className="hint">{query || filtering ? 'No match.' : 'Nothing here yet.'}</p>}
      {shown.length > 0 && (
        <ul className="list card flush" aria-label="Exercises">
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
                        u
                          ? `${u.sets} sets in ${u.workouts} ${u.workouts === 1 ? 'workout' : 'workouts'}`
                          : 'never used',
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
      )}

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
  const [deleting, setDeleting] = useState(false)
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
        <section className="form-section" aria-label="Basics">
          <div className="row top">
            <div className="field grow">
              <label htmlFor="e-name">Name</label>
              <input
                id="e-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <span className="field-label">Favorite</span>
              <button
                type="button"
                className="btn icon fav-toggle"
                aria-pressed={favorite}
                aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
                title="Favorites are listed first when picking exercises"
                onClick={() => setFavoriteFlag((v) => !v)}
              >
                <IconStar filled={favorite} />
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="e-alias">Other names</label>
            <input
              id="e-alias"
              type="text"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="e.g. Beinpresse, Sled press"
              autoComplete="off"
            />
            <span className="hint">Comma separated. Search finds the exercise by these too.</span>
          </div>
        </section>

        <section className="form-section" aria-label="Classification">
          <h3 className="section-label">Classification</h3>
          <div className="field">
            <label htmlFor="e-equipment">Equipment</label>
            <select id="e-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value as EquipmentType)}>
              {EQUIPMENT.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <ExerciseClassification muscles={muscles} onMuscles={setMuscles} dayIds={dayIds} onDayIds={setDayIdsEdit} />
        </section>

        <section className="form-section" aria-label="Rest timer">
          <h3 className="section-label">Rest timer</h3>
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
            <span className={`hint ${restInvalid ? 'danger-text' : ''}`}>
              {restInvalid ? 'Use 5–1800 seconds, or leave empty.' : 'Leave empty to use your default rest.'}
            </span>
          </div>
        </section>

        <div className="sticky-bottom">
          <button type="submit" className="btn primary big" disabled={!name.trim() || restInvalid}>
            {existing ? 'Save' : 'Create exercise'}
          </button>
        </div>
      </form>

      {existing && (
        <section className="form-section" aria-label="Manage">
          <h3 className="section-label">Manage</h3>
          <p className="hint">
            {u
              ? `Used in ${u.workouts} workouts (${u.sets} sets) and ${u.presets} presets.`
              : 'Not used in any workout yet.'}
          </p>
          {!existing.archivedAt && (
            <button type="button" className="btn block" onClick={() => setMerging(true)}>
              Merge into another exercise…
            </button>
          )}
          {existing.archivedAt && (
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
          )}
          {existing.archivedAt ? (
            <button type="button" className="btn ghost danger-text block" onClick={() => setDeleting(true)}>
              <IconTrash />
              Delete permanently…
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
          <p className="hint">
            {existing.archivedAt
              ? 'Restoring brings it back to the pickers. Deleting removes it for good.'
              : 'Merging is for duplicates. Archiving hides it from pickers; workouts and statistics stay intact.'}
          </p>
        </section>
      )}

      {existing && (
        <Sheet open={deleting} title={`Delete “${existing.name}”?`} onClose={() => setDeleting(false)}>
          <DeleteBody
            exercise={existing}
            onCancel={() => setDeleting(false)}
            onDeleted={() => {
              setDeleting(false)
              onDone()
            }}
          />
        </Sheet>
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

/** Confirmation for deleting an archived exercise: a simple warning if it was never trained, a stronger one if it was. */
function DeleteBody({
  exercise,
  onCancel,
  onDeleted,
}: {
  exercise: Exercise
  onCancel: () => void
  onDeleted: () => void
}) {
  const { guard, show } = useToast()
  const impact = useLiveQuery<DeleteImpact | undefined>(() => previewDelete(exercise.id), [exercise.id])
  const [understood, setUnderstood] = useState(false)
  if (!impact) return <div className="skeleton block" />
  const trained = impact.workouts > 0
  const alsoFrom = [
    impact.presets > 0 && `${impact.presets} ${impact.presets === 1 ? 'preset' : 'presets'}`,
    impact.days > 0 && `${impact.days} training ${impact.days === 1 ? 'day' : 'days'}`,
  ].filter(Boolean)

  return (
    <div className="stack">
      {trained ? (
        <div className="banner error stack">
          <strong>
            Used in {impact.workouts} {impact.workouts === 1 ? 'workout' : 'workouts'} ({impact.sets}{' '}
            {impact.sets === 1 ? 'set' : 'sets'})
          </strong>
          <p>
            Deleting removes these sets from your history, statistics and records. The rest of those workouts stays.
            This can’t be undone.
          </p>
        </div>
      ) : (
        <p>It was never used in a workout, so no history is affected. This can’t be undone.</p>
      )}
      {alsoFrom.length > 0 && <p className="secondary small">It will also be removed from {alsoFrom.join(' and ')}.</p>}
      {trained && (
        <>
          <p className="hint">
            Want to keep those sets under another exercise instead? Restore it and use “Merge into another exercise”.
          </p>
          <label className="check-row">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
            <span>
              Delete the exercise and its {impact.sets} logged {impact.sets === 1 ? 'set' : 'sets'}
            </span>
          </label>
        </>
      )}
      <button
        type="button"
        className="btn danger solid block"
        disabled={trained && !understood}
        onClick={() =>
          void guard(async () => {
            await deleteExercisePermanently(exercise.id)
            show(`“${exercise.name}” deleted`)
            onDeleted()
          })
        }
      >
        <IconTrash />
        Delete permanently
      </button>
      <button type="button" className="btn block" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
