import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../data/db'
import { useSettings } from '../data/hooks'
import { IconChart } from '../ui/icons'
import { loadStatsData, weeklyOverview } from './analytics'

const SPANS = [4, 8, 12] as const

/** Training frequency and weekly sets per muscle group — counts of sets, never a score. */
export function Insights() {
  const settings = useSettings()
  const data = useLiveQuery(loadStatsData, [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const [weeks, setWeeks] = useState<(typeof SPANS)[number]>(8)

  const rows = useMemo(() => {
    if (!data || !exercises) return null
    const tags = new Map(exercises.map((e) => [e.id, e.muscleTags]))
    return weeklyOverview(data, (id) => tags.get(id) ?? [], { weeks, includeWarmups: settings.includeWarmupsInStats })
  }, [data, exercises, weeks, settings.includeWarmupsInStats])

  if (!rows) return <div className="skeleton block" />
  if (rows.every((r) => r.workouts === 0)) {
    return (
      <div className="card empty">
        <span className="empty-icon">
          <IconChart />
        </span>
        <p className="empty-title">Nothing in this period</p>
        <p>Frequency and weekly sets per muscle appear once you have logged workouts.</p>
      </div>
    )
  }

  // The running week is incomplete, so averages use only the finished weeks.
  const finished = rows.slice(0, -1)
  const average = finished.length ? finished.reduce((n, r) => n + r.workouts, 0) / finished.length : 0
  const muscles = [...new Set(rows.flatMap((r) => [...r.muscleSets.keys()]))].sort(
    (a, b) =>
      rows.reduce((n, r) => n + (r.muscleSets.get(b) ?? 0), 0) -
      rows.reduce((n, r) => n + (r.muscleSets.get(a) ?? 0), 0),
  )
  const max = Math.max(1, ...rows.map((r) => r.workouts))
  const label = (week: string) => week.slice(5).replace('-', '/')

  return (
    <section className="stack" aria-label="Insights">
      <div className="segmented full" role="group" aria-label="Weeks">
        {SPANS.map((n) => (
          <button key={n} type="button" aria-pressed={weeks === n} onClick={() => setWeeks(n)}>
            {n} weeks
          </button>
        ))}
      </div>

      <div className="card stack">
        <h2>Workouts per week</h2>
        <p className="secondary">
          <strong className="num">{average.toFixed(1)}</strong> per week on average (finished weeks).
        </p>
        <ul className="week-bars" aria-label="Workouts per week">
          {rows.map((r, i) => (
            <li key={r.week} title={`Week of ${r.week}: ${r.workouts}`}>
              <span className="bar-track">
                <span className="bar-fill" style={{ height: `${(r.workouts / max) * 100}%` }} />
              </span>
              <span className="num small">{r.workouts}</span>
              <span className="small muted">{i === rows.length - 1 ? 'now' : label(r.week)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card stack">
        <h2>Sets per muscle group</h2>
        {muscles.length === 0 ? (
          <p className="hint">Exercises need muscle groups for this (Settings → Exercises).</p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Muscle</th>
                  {rows.slice(-4).map((r, i, a) => (
                    <th key={r.week}>{i === a.length - 1 ? 'This wk' : label(r.week)}</th>
                  ))}
                  <th>Ø/wk</th>
                </tr>
              </thead>
              <tbody>
                {muscles.map((m) => (
                  <tr key={m}>
                    <td>{m}</td>
                    {rows.slice(-4).map((r) => (
                      <td key={r.week} className="num">
                        {r.muscleSets.get(m) ?? 0}
                      </td>
                    ))}
                    <td className="num">
                      {(
                        finished.reduce((n, r) => n + (r.muscleSets.get(m) ?? 0), 0) / Math.max(1, finished.length)
                      ).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hint">
          Sets per week, per muscle group. Warm-ups {settings.includeWarmupsInStats ? 'included' : 'excluded'}.
        </p>
      </div>
    </section>
  )
}
