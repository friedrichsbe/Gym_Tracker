import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../data/db'
import { useDayTypes, useRoutines } from '../data/hooks'
import type { Routine } from '../domain/types'
import { suggestedLocationId } from '../locations/locationService'
import { formatDate } from '../ui/format'
import { IconList, IconPlus } from '../ui/icons'
import { useToast } from '../ui/toastContext'
import { startWorkout } from '../workout/workoutService'
import { duplicateRoutine, lastUsedByRoutine, unarchiveRoutine } from './routineService'

export function RoutinesPage() {
  const { active, archived } = useRoutines()
  const { active: days } = useDayTypes()
  const { guard } = useToast()
  const navigate = useNavigate()
  const meta = useLiveQuery(async () => {
    const counts = new Map<string, number>()
    for (const re of await db.routineExercises.toArray()) counts.set(re.routineId, (counts.get(re.routineId) ?? 0) + 1)
    return { counts, lastUsed: await lastUsedByRoutine() }
  }, [])

  const groups = [
    ...days.map((d) => ({ id: d.id, title: d.name, items: active.filter((r) => r.dayTypeId === d.id) })),
    {
      id: 'any',
      title: 'Any day',
      items: active.filter((r) => r.dayTypeId === null || !days.some((d) => d.id === r.dayTypeId)),
    },
  ].filter((g) => g.items.length > 0)

  const row = (r: Routine) => {
    const count = meta?.counts.get(r.id) ?? 0
    const last = meta?.lastUsed.get(r.id)
    return (
      <li key={r.id} className="preset">
        <Link to={`/routines/${r.id}`} className="grow link-reset">
          <div className="preset-name">{r.name}</div>
          <div className="small muted">
            {count} {count === 1 ? 'exercise' : 'exercises'}
            {last ? ` · last ${formatDate(last)}` : ' · never used'}
          </div>
        </Link>
        <button
          type="button"
          className="btn ghost small"
          aria-label={`Duplicate ${r.name}`}
          onClick={() => void guard(async () => navigate(`/routines/${(await duplicateRoutine(r.id)).id}`))}
        >
          Copy
        </button>
        <button
          type="button"
          className="btn primary small"
          disabled={count === 0}
          onClick={() =>
            void guard(async () => {
              await startWorkout({ routineId: r.id, locationId: await suggestedLocationId() })
              navigate('/')
            })
          }
        >
          Start
        </button>
      </li>
    )
  }

  return (
    <main className="content">
      <div className="page-head">
        <h1>Presets</h1>
        <Link to="/routines/new" className="btn primary small">
          <IconPlus />
          New
        </Link>
      </div>
      <p className="page-intro">
        A preset suggests exercises for a day. You can still add, reorder, replace or skip anything while training — it
        never locks you in.
      </p>

      {groups.length === 0 && (
        <div className="card empty">
          <span className="empty-icon">
            <IconList />
          </span>
          <p className="empty-title">No presets yet</p>
          <p>Create one here, or finish a workout and choose “Save as preset”.</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.id} className="section" aria-label={g.title}>
          <div className="section-head">
            <h2 className="section-label">{g.title}</h2>
          </div>
          <ul className="stack plain-list preset-list">{g.items.map(row)}</ul>
        </section>
      ))}

      {archived.length > 0 && (
        <details>
          <summary>Archived ({archived.length})</summary>
          <ul className="list">
            {archived.map((r) => (
              <li key={r.id} className="list-row">
                <span className="muted">{r.name}</span>
                <button type="button" className="btn small" onClick={() => void guard(() => unarchiveRoutine(r.id))}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  )
}
