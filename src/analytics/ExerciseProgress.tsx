import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../data/db'
import { useSettings } from '../data/hooks'
import { formatDate, formatNumber } from '../ui/format'
import { IconChart } from '../ui/icons'
import {
  exerciseLocations,
  exerciseStats,
  inRange,
  loadStatsData,
  RANGES,
  type RangeId,
  trainedExerciseIds,
  type ExercisePoint,
  type LocationFilter,
} from './analytics'

type Metric = 'topWeight' | 'e1rm' | 'volume' | 'bestReps'
const METRICS: { id: Metric; label: string }[] = [
  { id: 'topWeight', label: 'Top weight' },
  { id: 'e1rm', label: 'Est. 1RM' },
  { id: 'volume', label: 'Volume' },
  { id: 'bestReps', label: 'Best reps' },
]

export function ExerciseProgress() {
  const settings = useSettings()
  const data = useLiveQuery(loadStatsData, [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const [exerciseId, setExerciseId] = useState<string | null>(null)
  const [location, setLocation] = useState<LocationFilter | null>(null) // null = pick default
  const [chosenMetric, setMetric] = useState<Metric>('topWeight')
  const [hideSupersets, setHideSupersets] = useState(false)
  const [range, setRange] = useState<RangeId>('all')

  const trained = useMemo(() => (data ? trainedExerciseIds(data) : []), [data])
  const names = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e.name])), [exercises])
  const activeExercise = exerciseId && trained.includes(exerciseId) ? exerciseId : (trained[0] ?? null)

  const locations = useMemo(
    () => (data && activeExercise ? exerciseLocations(data, activeExercise) : []),
    [data, activeExercise],
  )
  // Default to the most recent location: the honest "am I progressing at this gym" series.
  const effectiveLocation: LocationFilter =
    location !== null && (location === 'all' || locations.some((l) => (l.id ?? 'none') === location))
      ? location
      : (locations[0]?.id ?? (locations[0] ? 'none' : 'all'))

  const stats = useMemo(
    () =>
      data && activeExercise
        ? exerciseStats(data, activeExercise, {
            location: effectiveLocation,
            includeWarmups: settings.includeWarmupsInStats,
            unit: settings.units,
            supersets: hideSupersets ? 'exclude' : 'include',
          })
        : null,
    [data, activeExercise, effectiveLocation, settings.includeWarmupsInStats, settings.units, hideSupersets],
  )

  // The chart and the table follow the time range; records always look at everything.
  const shown = useMemo(() => (stats ? inRange(stats.points, range) : []), [stats, range])

  // Without any external load (bodyweight work) "top weight" has no values: show reps instead.
  const metric: Metric =
    (chosenMetric === 'topWeight' || chosenMetric === 'e1rm') &&
    shown.length > 0 &&
    shown.every((p) => (chosenMetric === 'e1rm' ? p.e1rm : p.topWeight) == null)
      ? 'bestReps'
      : chosenMetric

  if (!data) return <div className="skeleton block" />
  if (trained.length === 0) {
    return (
      <div className="card empty">
        <span className="empty-icon">
          <IconChart />
        </span>
        <p className="empty-title">Nothing to chart yet</p>
        <p>Progress charts appear once you have completed sets. Log a workout to get started.</p>
      </div>
    )
  }

  const unit = settings.units
  const value = (p: ExercisePoint): number | null =>
    metric === 'topWeight' ? p.topWeight : metric === 'e1rm' ? p.e1rm : metric === 'volume' ? p.volume : p.bestReps
  const metricLabel =
    metric === 'topWeight'
      ? `Top weight (${unit})`
      : metric === 'e1rm'
        ? `Estimated 1RM (${unit})`
        : metric === 'volume'
          ? `Volume (${unit} × reps)`
          : 'Best reps in a set'

  return (
    <section className="stack" aria-label="Exercise progress">
      <div className="card stack loose">
        <div className="field">
          <label htmlFor="pg-exercise">Exercise</label>
          <select
            id="pg-exercise"
            value={activeExercise ?? ''}
            onChange={(e) => {
              setExerciseId(e.target.value)
              setLocation(null)
            }}
          >
            {trained.map((id) => (
              <option key={id} value={id}>
                {names.get(id) ?? 'Exercise'}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pg-location">Location</label>
          <select id="pg-location" value={effectiveLocation} onChange={(e) => setLocation(e.target.value)}>
            {locations.map((l) => (
              <option key={l.id ?? 'none'} value={l.id ?? 'none'}>
                {l.name} ({l.sets} sets)
              </option>
            ))}
            {locations.length > 1 && <option value="all">All locations (not comparable)</option>}
          </select>
        </div>
        {effectiveLocation === 'all' && (
          <p className="banner">
            Machines and set-ups differ between locations, so loads here are not directly comparable. Markers show where
            each point was logged.
          </p>
        )}
        <label className="check-row">
          <input type="checkbox" checked={hideSupersets} onChange={(e) => setHideSupersets(e.target.checked)} />
          <span>Hide sets done in supersets</span>
        </label>
        <div className="segmented full" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="segmented full" role="group" aria-label="Metric">
          {METRICS.map((m) => (
            <button key={m.id} type="button" aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {stats && stats.points.length > 0 && shown.length === 0 && (
        <p className="banner">No sessions in this time range. Pick a longer one to see older workouts.</p>
      )}

      {stats && shown.length > 0 && (
        <div className="card stack">
          <h2>{metricLabel}</h2>
          <LineChart points={shown} value={value} label={metricLabel} showLocations={effectiveLocation === 'all'} />
          <p className="hint">
            {shown.length} {shown.length === 1 ? 'session' : 'sessions'}, {shown.reduce((n, p) => n + p.sets, 0)} sets.
            Warm-ups {settings.includeWarmupsInStats ? 'included' : 'excluded'}. Every dot is one session; nothing is
            smoothed.
            {metric === 'volume' && ' Volume is load × reps over all counted sets.'}
            {metric === 'e1rm' &&
              ' Estimate from the best set (Epley: weight × (1 + reps ⁄ 30)), only for sets of 1–12 reps — a guide, not a tested max.'}
          </p>
        </div>
      )}

      {stats && (stats.records.heaviest || stats.records.mostReps) && (
        <div className="card stack">
          <h2>Records{effectiveLocation === 'all' ? ' (all locations)' : ''} · all time</h2>
          <div className="summary-grid">
            {stats.records.heaviest && (
              <Record
                label="Heaviest set"
                main={`${formatNumber(round(stats.records.heaviest.weight))} ${unit} × ${stats.records.heaviest.reps}`}
                date={stats.records.heaviest.date}
                id={stats.records.heaviest.sessionId}
              />
            )}
            {stats.records.mostReps && (
              <Record
                label="Most reps in a set"
                main={`${stats.records.mostReps.reps}${stats.records.mostReps.weight != null ? ` @ ${formatNumber(round(stats.records.mostReps.weight))} ${unit}` : ''}`}
                date={stats.records.mostReps.date}
                id={stats.records.mostReps.sessionId}
              />
            )}
            {stats.records.bestSetVolume && (
              <Record
                label="Best set volume"
                main={`${formatNumber(round(stats.records.bestSetVolume.volume))} ${unit}`}
                date={stats.records.bestSetVolume.date}
                id={stats.records.bestSetVolume.sessionId}
              />
            )}
          </div>
        </div>
      )}

      {stats && shown.length > 0 && (
        <div className="card stack">
          <h2>Sessions</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Top set</th>
                  <th>Sets</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {[...shown].reverse().map((p) => (
                  <tr key={p.sessionId}>
                    <td>
                      <Link to={`/history/${p.sessionId}`}>{formatDate(p.startedAt)}</Link>
                    </td>
                    <td>{p.locationNames.join(', ')}</td>
                    <td>
                      {p.topWeight != null
                        ? `${formatNumber(round(p.topWeight))} × ${p.repsAtTop}`
                        : `${p.bestReps} reps`}
                    </td>
                    <td>
                      {p.sets}
                      {p.superset && (
                        <span className="inline-tags">
                          <span className="tag superset-tag">SS</span>
                        </span>
                      )}
                    </td>
                    <td>{p.volume ? formatNumber(Math.round(p.volume)) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

const round = (n: number) => Math.round(n * 100) / 100

function Record({ label, main, date, id }: { label: string; main: string; date: string; id: string }) {
  return (
    <div className="metric">
      <div className="l">{label}</div>
      <div className="v sm num">{main}</div>
      <Link to={`/history/${id}`} className="small muted">
        {formatDate(date)}
      </Link>
    </div>
  )
}

const SHAPES = ['circle', 'square', 'diamond', 'triangle'] as const

function LineChart(props: {
  points: ExercisePoint[]
  value: (p: ExercisePoint) => number | null
  label: string
  showLocations: boolean
}) {
  const { points, value, label, showLocations } = props
  // Draw in real pixels so labels and markers keep their size on wide screens.
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(340)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const W = Math.max(280, width)
  const H = Math.round(Math.min(260, Math.max(190, W * 0.42)))
  const m = { l: 40, r: 12, t: 12, b: 26 }
  const series = points
    .map((p) => ({ p, v: value(p) }))
    .filter((x): x is { p: ExercisePoint; v: number } => x.v != null)
  if (series.length === 0)
    return (
      <div ref={box}>
        <p className="hint">No values for this metric.</p>
      </div>
    )

  const times = series.map((x) => Date.parse(x.p.startedAt))
  const [t0, t1] = [Math.min(...times), Math.max(...times)]
  const vals = series.map((x) => x.v)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = hi === lo ? Math.max(1, hi * 0.1) : (hi - lo) * 0.15
  const y0 = Math.max(0, lo - pad)
  const y1 = hi + pad
  const x = (t: number) => (t1 === t0 ? (m.l + W - m.r) / 2 : m.l + ((t - t0) / (t1 - t0)) * (W - m.l - m.r))
  const y = (v: number) => H - m.b - ((v - y0) / (y1 - y0)) * (H - m.t - m.b)
  const ticks = niceTicks(y0, y1)
  const locs = [...new Set(series.map((s) => s.p.locationNames.join(', ')))]

  return (
    <div ref={box} className="stack">
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label} over time: ${series.map((s) => `${s.p.date} ${round(s.v)}`).join('; ')}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
            <text x={m.l - 6} y={y(t) + 3} textAnchor="end">
              {formatNumber(Math.round(t * 10) / 10)}
            </text>
          </g>
        ))}
        <text x={m.l} y={H - 8}>
          {series[0].p.date}
        </text>
        {series.length > 1 && (
          <text x={W - m.r} y={H - 8} textAnchor="end">
            {series[series.length - 1].p.date}
          </text>
        )}
        {!showLocations && series.length > 1 && (
          <polygon
            className="area"
            points={[
              `${x(Date.parse(series[0].p.startedAt))},${H - m.b}`,
              ...series.map((s) => `${x(Date.parse(s.p.startedAt))},${y(s.v)}`),
              `${x(Date.parse(series[series.length - 1].p.startedAt))},${H - m.b}`,
            ].join(' ')}
          />
        )}
        {!showLocations && series.length > 1 && (
          <polyline
            className="line"
            points={series.map((s) => `${x(Date.parse(s.p.startedAt))},${y(s.v)}`).join(' ')}
          />
        )}
        {series.map((s) => {
          const cx = x(Date.parse(s.p.startedAt))
          const cy = y(s.v)
          const shape = SHAPES[showLocations ? locs.indexOf(s.p.locationNames.join(', ')) % SHAPES.length : 0]
          const title = `${formatDate(s.p.startedAt)} · ${formatNumber(round(s.v))} · ${s.p.locationNames.join(', ')}${s.p.superset ? ' · superset' : ''}`
          return shape === 'square' ? (
            <rect
              key={s.p.sessionId}
              className={`pt ${s.p.superset ? 'ss' : ''}`}
              x={cx - 4.5}
              y={cy - 4.5}
              width={9}
              height={9}
            >
              <title>{title}</title>
            </rect>
          ) : shape === 'diamond' ? (
            <rect
              key={s.p.sessionId}
              className={`pt ${s.p.superset ? 'ss' : ''}`}
              x={cx - 4}
              y={cy - 4}
              width={8}
              height={8}
              transform={`rotate(45 ${cx} ${cy})`}
            >
              <title>{title}</title>
            </rect>
          ) : shape === 'triangle' ? (
            <polygon
              key={s.p.sessionId}
              className={`pt ${s.p.superset ? 'ss' : ''}`}
              points={`${cx},${cy - 6} ${cx + 5.5},${cy + 4} ${cx - 5.5},${cy + 4}`}
            >
              <title>{title}</title>
            </polygon>
          ) : (
            <circle key={s.p.sessionId} className={`pt ${s.p.superset ? 'ss' : ''}`} cx={cx} cy={cy} r={4.5}>
              <title>{title}</title>
            </circle>
          )
        })}
      </svg>
      {showLocations && (
        <ul className="chip-row plain-list">
          {locs.map((l, i) => (
            <li key={l} className="small secondary">
              {['●', '■', '◆', '▲'][i % 4]} {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 3–5 round tick values inside [lo, hi] (steps of 1, 2, 5 × 10ⁿ). */
function niceTicks(lo: number, hi: number): number[] {
  const raw = (hi - lo) / 4
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6)
  return out.length ? out : [lo, hi]
}
