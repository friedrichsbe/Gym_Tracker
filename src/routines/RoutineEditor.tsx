import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../data/db'
import { useDayTypes, useExercises } from '../data/hooks'
import { moveBlock, normalizeGroupIds } from '../workout/supersets'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { IconArrowDown, IconArrowUp, IconChevronLeft, IconPlus, IconX } from '../ui/icons'
import { NumericField } from '../ui/NumericField'
import { useToast } from '../ui/toastContext'
import {
  archiveRoutine,
  createRoutine,
  duplicateRoutine,
  getRoutineExercises,
  saveRoutine,
  type RoutineExerciseInput,
} from './routineService'

interface Item extends RoutineExerciseInput {
  key: string
}

export function RoutineEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const loaded = useLiveQuery(async () => {
    if (isNew) return { routine: null, items: [] as RoutineExerciseInput[] }
    const routine = await db.routines.get(id!)
    return { routine: routine ?? null, items: routine ? await getRoutineExercises(id!) : [] }
  }, [id, isNew])

  if (!loaded) return null
  if (!isNew && !loaded.routine) {
    return (
      <main className="content">
        <p>This preset no longer exists.</p>
        <Link to="/routines" className="btn">
          Back to presets
        </Link>
      </main>
    )
  }
  // Keyed on the routine so the form state is initialised once from the stored data.
  return <Editor key={id ?? 'new'} id={isNew ? null : id!} initial={loaded} />
}

function Editor({
  id,
  initial,
}: {
  id: string | null
  initial: { routine: { name: string; dayTypeId: string | null; notes?: string } | null; items: RoutineExerciseInput[] }
}) {
  const navigate = useNavigate()
  const { guard, show } = useToast()
  const exercises = useExercises()
  const { active: days } = useDayTypes()
  const [name, setName] = useState(initial.routine?.name ?? '')
  const [dayTypeId, setDayTypeId] = useState<string | null>(initial.routine?.dayTypeId ?? null)
  const [notes, setNotes] = useState(initial.routine?.notes ?? '')
  const [items, setItems] = useState<Item[]>(() =>
    initial.items.map((it, i) => ({ ...it, key: `${it.id ?? 'n'}-${i}` })),
  )
  const [picking, setPicking] = useState(false)
  const baseline = useMemo(
    () => JSON.stringify([name, dayTypeId, notes, items.map(({ key: _k, ...r }) => r)]),
    [name, dayTypeId, notes, items],
  )
  const [saved] = useState(() => baseline)
  const dirty = baseline !== saved || id === null

  const nameOf = useMemo(() => new Map(exercises.map((e) => [e.id, e.name])), [exercises])
  const day = days.find((d) => d.id === dayTypeId) ?? null

  const patch = (key: string, p: Partial<RoutineExerciseInput>) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)))
  // Supersets must stay adjacent and have 2+ members: re-establish that after every structural change.
  const normalized = (xs: Item[]): Item[] => {
    const ids = normalizeGroupIds(
      xs.map((x) => x.supersetGroup),
      () => `g${Math.random().toString(36).slice(2, 8)}`,
    )
    return xs.map((x, i) => ((x.supersetGroup ?? null) === ids[i] ? x : { ...x, supersetGroup: ids[i] }))
  }
  // A superset moves as one block.
  const move = (i: number, dir: -1 | 1) => setItems((xs) => normalized(moveBlock(xs, i, dir, (x) => x.supersetGroup)))
  const linkNext = (i: number) =>
    setItems((xs) => {
      const gid = xs[i].supersetGroup ?? xs[i + 1].supersetGroup ?? `g${Math.random().toString(36).slice(2, 8)}`
      const joining = new Set([xs[i].key, xs[i + 1].key])
      for (const x of xs) if (xs[i + 1].supersetGroup && x.supersetGroup === xs[i + 1].supersetGroup) joining.add(x.key)
      return normalized(xs.map((x) => (joining.has(x.key) ? { ...x, supersetGroup: gid } : x)))
    })
  const unlink = (key: string) =>
    setItems((xs) => normalized(xs.map((x) => (x.key === key ? { ...x, supersetGroup: null } : x))))

  const save = () =>
    void guard(async () => {
      const payload = items.map(({ key: _k, ...r }) => r)
      if (id) await saveRoutine(id, { name, dayTypeId, notes, exercises: payload })
      else await createRoutine({ name, dayTypeId, notes, exercises: payload })
      show('Preset saved')
      navigate('/routines')
    })

  const back = () => {
    if (id && baseline !== saved && !window.confirm('Discard your unsaved changes?')) return
    navigate('/routines')
  }

  return (
    <main className="content">
      <div className="row between">
        <button type="button" className="link-subtle btn-reset" onClick={back}>
          <IconChevronLeft />
          Presets
        </button>
        {id && baseline !== saved && <span className="tag sub">Unsaved changes</span>}
      </div>
      <h1>{id ? 'Edit preset' : 'New preset'}</h1>

      <div className="card stack loose">
        <div className="field">
          <label htmlFor="r-name">Name</label>
          <input
            id="r-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Leg A"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label htmlFor="r-day">Day</label>
          <select id="r-day" value={dayTypeId ?? ''} onChange={(e) => setDayTypeId(e.target.value || null)}>
            <option value="">Any day</option>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="r-notes">Notes (optional)</label>
          <textarea id="r-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <section className="card stack" aria-labelledby="r-ex">
        <div className="card-head">
          <h2 id="r-ex">Exercises</h2>
          {items.length > 0 && <span className="small muted num">{items.length}</span>}
        </div>
        {items.length === 0 && <p className="hint">No exercises yet — add a few to build this preset.</p>}
        <ul className="list">
          {items.map((it, i) => (
            <li key={it.key} className={`editor-row ${it.supersetGroup ? 'ss' : ''}`}>
              {it.supersetGroup && items[i - 1]?.supersetGroup !== it.supersetGroup && (
                <span className="tag superset-tag">Superset</span>
              )}
              <div className="row between">
                <strong className="preset-name">{nameOf.get(it.exerciseId) ?? 'Unknown exercise'}</strong>
                <span className="row tight">
                  <button
                    type="button"
                    className="btn ghost icon small"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <IconArrowUp />
                  </button>
                  <button
                    type="button"
                    className="btn ghost icon small"
                    aria-label="Move down"
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <IconArrowDown />
                  </button>
                  <button
                    type="button"
                    className="btn ghost icon small"
                    aria-label={`Remove ${nameOf.get(it.exerciseId) ?? 'exercise'}`}
                    onClick={() => setItems((xs) => normalized(xs.filter((x) => x.key !== it.key)))}
                  >
                    <IconX />
                  </button>
                </span>
              </div>
              <div className="editor-nums">
                <div className="field">
                  <span className="field-label">Sets</span>
                  <NumericField
                    label={`Sets for ${nameOf.get(it.exerciseId) ?? 'exercise'}`}
                    integer
                    value={it.suggestedSets}
                    onCommit={(v) => patch(it.key, { suggestedSets: v })}
                  />
                </div>
                <div className="field">
                  <span className="field-label">Reps from</span>
                  <NumericField
                    label={`Minimum reps for ${nameOf.get(it.exerciseId) ?? 'exercise'}`}
                    integer
                    value={it.targetRepMin}
                    onCommit={(v) => patch(it.key, { targetRepMin: v })}
                  />
                </div>
                <div className="field">
                  <span className="field-label">to</span>
                  <NumericField
                    label={`Maximum reps for ${nameOf.get(it.exerciseId) ?? 'exercise'}`}
                    integer
                    value={it.targetRepMax}
                    onCommit={(v) => patch(it.key, { targetRepMax: v })}
                  />
                </div>
              </div>
              {it.supersetGroup ? (
                <button type="button" className="btn ghost small self-start" onClick={() => unlink(it.key)}>
                  Take out of superset
                </button>
              ) : (
                i < items.length - 1 && (
                  <button type="button" className="btn ghost small self-start" onClick={() => linkNext(i)}>
                    Superset with next exercise
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
        <button type="button" className="btn block dashed" onClick={() => setPicking(true)}>
          <IconPlus />
          Add exercises
        </button>
        <p className="hint">Sets and reps are suggestions, not limits. You can change everything in the workout.</p>
      </section>

      <button type="button" className="btn primary big" disabled={!name.trim() || !dirty} onClick={save}>
        Save preset
      </button>

      {id && (
        <div className="row">
          <button
            type="button"
            className="btn grow"
            onClick={() => void guard(async () => navigate(`/routines/${(await duplicateRoutine(id)).id}`))}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn ghost danger-text grow"
            onClick={() => {
              if (!window.confirm('Archive this preset? Past workouts keep their data.')) return
              void guard(async () => {
                await archiveRoutine(id)
                navigate('/routines')
              })
            }}
          >
            Archive
          </button>
        </div>
      )}

      <ExercisePicker
        open={picking}
        mode="multi"
        day={day}
        confirmLabel={(n) => `Add ${n} exercise${n === 1 ? '' : 's'}`}
        onClose={() => setPicking(false)}
        onConfirm={(ids) =>
          setItems((xs) => [
            ...xs,
            ...ids.map((exerciseId, i) => ({
              key: `new-${Date.now()}-${i}`,
              exerciseId,
              suggestedSets: 3,
              targetRepMin: 8,
              targetRepMax: 12,
            })),
          ])
        }
      />
    </main>
  )
}
