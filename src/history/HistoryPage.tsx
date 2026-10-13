import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../data/db'
import { useDayTypes, useLocations } from '../data/hooks'
import { instant } from '../domain/time'
import { formatDate, formatDurationShort, formatVolume } from '../ui/format'
import { IconCalendar } from '../ui/icons'
import { summarizeSession } from '../workout/workoutService'

export function HistoryPage() {
  const { active: days } = useDayTypes()
  const { active: locations, archived } = useLocations()
  const [day, setDay] = useState<string>('all')
  const [location, setLocation] = useState<string>('all')
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
          (location === 'all' || (location === 'none' ? s.locationId === null : s.locationId === location)),
      ),
    [sessions, day, location],
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
      </div>

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
              />
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

function Row(props: { id: string; date: string; title: string; place: string | null }) {
  const summary = useLiveQuery(() => summarizeSession(props.id), [props.id])
  return (
    <li>
      <Link to={`/history/${props.id}`} className="session-item">
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
