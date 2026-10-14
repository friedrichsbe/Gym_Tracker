import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { db } from '../data/db'
import { useDayTypes, useLocations } from '../data/hooks'
import { instant } from '../domain/time'
import { formatDate, formatDurationShort, formatVolume } from '../ui/format'
import { DateField } from '../ui/DateField'
import { IconCalendar, IconPlus } from '../ui/icons'
import { PastWorkoutSheet } from './PastWorkoutSheet'
import { summarizeSession } from '../workout/workoutService'

export function HistoryPage() {
  const { active: days } = useDayTypes()
  const { active: locations, archived } = useLocations()
  const [day, setDay] = useState<string>('all')
  const [location, setLocation] = useState<string>('all')
  const [logging, setLogging] = useState(false)
  const [exerciseId, setExerciseId] = useState<string>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const route = useLocation()
  const navigate = useNavigate()
  // Set by "Save & finish": the workout just logged gently pulses once so it's easy to spot.
  const highlight = (route.state as { highlight?: string } | null)?.highlight ?? null
  useEffect(() => {
    if (!highlight) return
    const t = window.setTimeout(() => navigate(route.pathname, { replace: true, state: null }), 5000)
    return () => window.clearTimeout(t)
  }, [highlight, navigate, route.pathname])
  // Which exercises were done in which workout, for the exercise filter.
  const done = useLiveQuery(async () => {
    const completed = new Set((await db.sessions.where('status').equals('completed').primaryKeys()) as string[])
    const bySession = new Map<string, Set<string>>()
    const names = new Map<string, string>()
    for (const we of await db.workoutExercises.toArray()) {
      if (!completed.has(we.sessionId)) continue
      if (!bySession.has(we.sessionId)) bySession.set(we.sessionId, new Set())
      bySession.get(we.sessionId)!.add(we.performedExerciseId)
      names.set(we.performedExerciseId, we.performedNameSnapshot)
    }
    return { bySession, names: [...names.entries()].sort((a, b) => a[1].localeCompare(b[1])) }
  }, [])
  const sessions = useLiveQuery(
    async () =>
      (await db.sessions.where('status').equals('completed').toArray()).sort(
        (a, b) => instant(b.startedAt) - instant(a.startedAt),
      ),
    [],
  )

  const filtered = useMemo(
    () =>
      (sessions ?? []).filter(
        (s) =>
          (day === 'all' || (day === 'free' ? s.dayTypeId === null : s.dayTypeId === day)) &&
          (location === 'all' || (location === 'none' ? s.locationId === null : s.locationId === location)) &&
          (!from || s.startedAt.slice(0, 10) >= from) &&
          (!to || s.startedAt.slice(0, 10) <= to) &&
          (exerciseId === 'all' || (done?.bySession.get(s.id)?.has(exerciseId) ?? false)),
      ),
    [sessions, day, location, from, to, exerciseId, done],
  )
  const months = useMemo(() => {
    const out: { label: string; items: typeof filtered }[] = []
    for (const s of filtered) {
      const label = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(s.startedAt))
      const last = out[out.length - 1]
      if (last?.label === label) last.items.push(s)
      else out.push({ label, items: [s] })
    }
    return out
  }, [filtered])

  return (
    <main className="content">
      <div className="page-head">
        <h1>History</h1>
        <button type="button" className="btn primary small" onClick={() => setLogging(true)}>
          <IconPlus />
          Log past workout
        </button>
      </div>
      <PastWorkoutSheet open={logging} onClose={() => setLogging(false)} />

      <div className="filter-bar">
        <div className="field">
          <label htmlFor="h-day">Day</label>
          <select id="h-day" value={day} onChange={(e) => setDay(e.target.value)}>
            <option value="all">All days</option>
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            <option value="free">Free workouts</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="h-loc">Location</label>
          <select id="h-loc" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="all">All locations</option>
            {[...locations, ...archived].map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            <option value="none">No location</option>
          </select>
        </div>
      </div>

      <div className="filter-bar">
        <div className="field span-2">
          <label htmlFor="h-ex">Exercise</label>
          <select id="h-ex" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            <option value="all">All exercises</option>
            {(done?.names ?? []).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <DateField id="h-from" label="From" value={from} max={to || undefined} onChange={setFrom} />
        <DateField id="h-to" label="To" value={to} min={from || undefined} onChange={setTo} />
      </div>
      {(day !== 'all' || location !== 'all' || exerciseId !== 'all' || from || to) && sessions && (
        <div className="row-between">
          <span className="small muted num">
            {filtered.length} of {sessions.length} workouts
          </span>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              setDay('all')
              setLocation('all')
              setExerciseId('all')
              setFrom('')
              setTo('')
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {sessions === undefined && <div className="skeleton block" />}
      {sessions && sessions.length === 0 && (
        <div className="card empty">
          <span className="empty-icon">
            <IconCalendar />
          </span>
          <p className="empty-title">No workouts yet</p>
          <p>They appear here as soon as you finish one.</p>
        </div>
      )}
      {sessions && sessions.length > 0 && filtered.length === 0 && (
        <div className="card empty">
          <p className="empty-title">Nothing matches</p>
          <p>No workouts match these filters.</p>
        </div>
      )}

      {months.map((m) => (
        <section key={m.label} className="section" aria-label={m.label}>
          <div className="section-head">
            <h2 className="section-label">{m.label}</h2>
            <span className="small muted num">
              {m.items.length} {m.items.length === 1 ? 'workout' : 'workouts'}
            </span>
          </div>
          <ul className="list card flush">
            {m.items.map((s) => (
              <Row
                key={s.id}
                id={s.id}
                date={formatDate(s.startedAt)}
                title={[s.dayTypeNameSnapshot, s.routineNameSnapshot].filter(Boolean).join(' · ') || 'Workout'}
                place={s.locationNameSnapshot}
                highlight={s.id === highlight}
              />
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

function Row(props: { id: string; date: string; title: string; place: string | null; highlight?: boolean }) {
  const summary = useLiveQuery(() => summarizeSession(props.id), [props.id])
  const ref = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    if (props.highlight) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [props.highlight])
  return (
    <li>
      <Link
        ref={ref}
        to={`/history/${props.id}`}
        className={`session-item ${props.highlight ? 'just-saved' : ''}`}
        aria-description={props.highlight ? 'Just saved' : undefined}
      >
        <div>
          <div className="session-title">{props.date}</div>
          <div className="small muted">
            {props.title} · {props.place ?? 'No location'}
          </div>
        </div>
        {summary && (
          <div className="meta num">
            {summary.completedSets} {summary.completedSets === 1 ? 'set' : 'sets'}
            <br />
            {summary.durationSeconds != null ? formatDurationShort(summary.durationSeconds) : ''}
            {Object.keys(summary.volume).length > 0 && <> · {formatVolume(summary.volume)}</>}
          </div>
        )}
      </Link>
    </li>
  )
}
