import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../data/db'
import { useSettings } from '../data/hooks'
import { groupBy } from '../domain/collections'
import { formatNumber, formatSetShort } from '../ui/format'
import { IconChevronLeft, IconChevronRight } from '../ui/icons'
import {
  addDays,
  addMonths,
  dailyActivity,
  dateKeyOf,
  daysInMonth,
  levelScale,
  loadStatsData,
  metricValue,
  startOfMonth,
  startOfWeek,
  todayKey,
  weekdayMon0,
  type DateKey,
  type DayActivity,
  type HeatMetric,
  type StatsData,
} from './analytics'

type View = 'day' | 'week' | 'month' | 'year'
const VIEWS: { id: View; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]
const METRICS: { id: HeatMetric; label: string }[] = [
  { id: 'sets', label: 'Sets' },
  { id: 'volume', label: 'Volume' },
  { id: 'workouts', label: 'Workouts' },
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const asDate = (k: DateKey) => new Date(`${k}T12:00:00`)
const fmt = (k: DateKey, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, o).format(asDate(k))

function describe(k: DateKey, d: DayActivity | undefined, metric: HeatMetric): string {
  const day = fmt(k, { weekday: 'long', day: 'numeric', month: 'long' })
  if (!d) return `${day}: rest day`
  const volume = metric === 'volume' ? `, about ${formatNumber(Math.round(d.volumeKg))} kg volume` : ''
  return `${day}: ${d.workouts} ${d.workouts === 1 ? 'workout' : 'workouts'}, ${d.sets} sets${volume}`
}

export function ActivityHeatmap() {
  const settings = useSettings()
  const data = useLiveQuery(loadStatsData, [])
  const [view, setView] = useState<View>('month')
  const [metric, setMetric] = useState<HeatMetric>('sets')
  const [anchor, setAnchor] = useState<DateKey>(todayKey)

  const activity = useMemo(
    () =>
      data ? dailyActivity(data, { includeWarmups: settings.includeWarmupsInStats }) : new Map<DateKey, DayActivity>(),
    [data, settings.includeWarmupsInStats],
  )
  const level = useMemo(() => levelScale([...activity.values()].map((d) => metricValue(d, metric))), [activity, metric])
  const today = todayKey()

  const step = (dir: -1 | 1) =>
    setAnchor((a) =>
      view === 'day'
        ? addDays(a, dir)
        : view === 'week'
          ? addDays(a, 7 * dir)
          : view === 'month'
            ? addMonths(a, dir)
            : addMonths(a, 12 * dir),
    )

  const title =
    view === 'year'
      ? anchor.slice(0, 4)
      : view === 'month'
        ? fmt(anchor, { month: 'long', year: 'numeric' })
        : view === 'week'
          ? `${fmt(startOfWeek(anchor), { day: 'numeric', month: 'short' })} – ${fmt(addDays(startOfWeek(anchor), 6), { day: 'numeric', month: 'short', year: 'numeric' })}`
          : fmt(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const cell = (k: DateKey, extra?: { selected?: boolean; text?: ReactNode; className?: string }) => {
    const d = activity.get(k)
    return (
      <button
        key={k}
        type="button"
        className={`heat-cell ${extra?.className ?? ''} ${k === today ? 'today' : ''} ${extra?.selected ? 'selected' : ''}`}
        data-level={level(metricValue(d, metric))}
        aria-label={describe(k, d, metric)}
        aria-pressed={extra?.selected}
        title={describe(k, d, metric)}
        onClick={() => setAnchor(k)}
      >
        {extra?.text}
      </button>
    )
  }

  return (
    <section className="stack" aria-label="Activity calendar">
      <div className="segmented full" role="group" aria-label="Calendar view">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="card stack">
        <div className="cal-nav">
          <h2 className="grow" aria-live="polite">
            {title}
          </h2>
          <button
            type="button"
            className="btn ghost small"
            onClick={() => setAnchor(todayKey())}
            disabled={anchor === today}
          >
            Today
          </button>
          <button type="button" className="btn small icon" aria-label={`Previous ${view}`} onClick={() => step(-1)}>
            <IconChevronLeft />
          </button>
          <button type="button" className="btn small icon" aria-label={`Next ${view}`} onClick={() => step(1)}>
            <IconChevronRight />
          </button>
        </div>
        <div className="row between wrap">
          <div className="chip-row" role="group" aria-label="Colour by">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                className="chip"
                aria-pressed={metric === m.id}
                onClick={() => setMetric(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="heat-legend" aria-hidden="true">
            <span className="small muted">Less</span>
            {[0, 1, 2, 3, 4].map((l) => (
              <span key={l} className="heat-cell mini" data-level={l} />
            ))}
            <span className="small muted">More</span>
          </div>
        </div>

        {!data && <div className="skeleton block" />}

        {data && view === 'year' && <YearGrid year={+anchor.slice(0, 4)} anchor={anchor} cell={cell} />}

        {data && view === 'month' && (
          <div className="month-grid" role="group" aria-label={title}>
            {WEEKDAYS.map((w) => (
              <span key={w} className="set-grid-head">
                {w}
              </span>
            ))}
            {Array.from({ length: weekdayMon0(startOfMonth(anchor)) }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: daysInMonth(anchor) }, (_, i) => {
              const k = `${anchor.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`
              const d = activity.get(k)
              return cell(k, {
                selected: k === anchor,
                className: 'month-cell',
                text: (
                  <>
                    <span>{i + 1}</span>
                    {d && <span className="cnt">{d.sets}</span>}
                  </>
                ),
              })
            })}
          </div>
        )}

        {data && view === 'week' && (
          <WeekRow
            anchor={anchor}
            data={data}
            includeWarmups={settings.includeWarmupsInStats}
            activity={activity}
            level={level}
            metric={metric}
            today={today}
            onSelect={setAnchor}
          />
        )}

        <p className="hint">
          {metric === 'volume' ? 'Volume = load × reps, lb converted to kg for comparison. ' : ''}
          Warm-up sets {settings.includeWarmupsInStats ? 'are included' : 'are not counted'} (Settings → Statistics).
          Colours are relative to your own history.
        </p>
      </div>

      {data && <DayDetail date={anchor} data={data} activity={activity.get(anchor)} />}
    </section>
  )
}

function YearGrid({
  year,
  anchor,
  cell,
}: {
  year: number
  anchor: DateKey
  cell: (k: DateKey, extra?: { selected?: boolean }) => ReactNode
}) {
  const first = `${year}-01-01`
  const gridStart = startOfWeek(first)
  const weeks = Math.ceil(((Date.parse(`${year}-12-31`) - Date.parse(gridStart)) / 86_400_000 + 1) / 7)
  const scroller = useRef<HTMLDivElement>(null)

  const monthCols = Array.from({ length: 12 }, (_, m) => {
    const k = `${year}-${String(m + 1).padStart(2, '0')}-01`
    return {
      label: fmt(k, { month: 'short' }),
      col: Math.floor((Date.parse(k) - Date.parse(gridStart)) / 86_400_000 / 7) + 1,
    }
  })

  // Open scrolled to the selected week so "today" is visible on a phone.
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const col = Math.floor((Date.parse(anchor) - Date.parse(gridStart)) / 86_400_000 / 7)
    el.scrollLeft = Math.max(0, col * 15 - el.clientWidth / 2)
  }, [anchor, gridStart])

  return (
    <div className="year-wrap">
      <div className="year-days" aria-hidden="true">
        {['Mon', '', 'Wed', '', 'Fri', '', ''].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="year-scroll" ref={scroller} tabIndex={0} role="group" aria-label={`Year ${year}`}>
        <div className="year-months" style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }} aria-hidden="true">
          {monthCols.map((m) => (
            <span key={m.label} style={{ gridColumnStart: m.col }}>
              {m.label}
            </span>
          ))}
        </div>
        <div className="year-grid" style={{ gridTemplateColumns: `repeat(${weeks}, 12px)` }}>
          {Array.from({ length: weeks * 7 }, (_, i) => {
            const k = addDays(gridStart, i)
            if (k.slice(0, 4) !== String(year)) return <span key={k} className="year-gap" />
            return cell(k, { selected: k === anchor })
          })}
        </div>
      </div>
    </div>
  )
}

function WeekRow(props: {
  anchor: DateKey
  data: StatsData
  includeWarmups: boolean
  activity: Map<DateKey, DayActivity>
  level: (v: number) => number
  metric: HeatMetric
  today: DateKey
  onSelect: (k: DateKey) => void
}) {
  const { anchor, data, includeWarmups, activity, level, metric, today, onSelect } = props
  const start = startOfWeek(anchor)
  // One square per set — warm-ups hollow.
  const dots = useMemo(() => {
    const sessionDay = new Map(data.sessions.map((s) => [s.id, dateKeyOf(s.startedAt)]))
    return groupBy(
      data.sets.filter((s) => includeWarmups || s.setType !== 'warmup'),
      (s) => sessionDay.get(s.sessionId)!,
    )
  }, [data, includeWarmups])

  return (
    <div className="week-row" role="group" aria-label="Week">
      {Array.from({ length: 7 }, (_, i) => {
        const k = addDays(start, i)
        const d = activity.get(k)
        const sets = dots.get(k) ?? []
        return (
          <button
            key={k}
            type="button"
            className={`week-tile ${k === anchor ? 'selected' : ''} ${k === today ? 'today' : ''}`}
            data-level={level(metricValue(d, metric))}
            aria-pressed={k === anchor}
            aria-label={describe(k, d, metric)}
            onClick={() => onSelect(k)}
          >
            <span className="set-grid-head">{WEEKDAYS[i]}</span>
            <strong>{+k.slice(8)}</strong>
            <span className="dots">
              {sets.slice(0, 60).map((s) => (
                <i key={s.id} className={s.setType === 'warmup' ? 'dot warm' : 'dot'} />
              ))}
            </span>
            <span className="small muted num">{d ? d.sets : '–'}</span>
          </button>
        )
      })}
    </div>
  )
}

function DayDetail({ date, data, activity }: { date: DateKey; data: StatsData; activity?: DayActivity }) {
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  const names = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e.name])), [exercises])
  const sessions = data.sessions
    .filter((s) => dateKeyOf(s.startedAt) === date)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const settings = useSettings()

  return (
    <div className="card stack" aria-live="polite">
      <h2>{fmt(date, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
      {sessions.length === 0 && <p className="hint">Rest day — no workout logged.</p>}
      {sessions.map((s) => {
        const instances = data.instances.filter((i) => i.sessionId === s.id).sort((a, b) => a.position - b.position)
        return (
          <article key={s.id} className="stack">
            <div className="row between">
              <div>
                <strong>
                  {[s.dayTypeNameSnapshot, s.routineNameSnapshot].filter(Boolean).join(' · ') || 'Workout'}
                </strong>
                <div className="small muted">{s.locationNameSnapshot ?? 'No location'}</div>
              </div>
              <Link to={`/history/${s.id}`} className="btn ghost small">
                Open
              </Link>
            </div>
            {instances.map((i) => {
              const sets = data.sets
                .filter(
                  (x) => x.workoutExerciseId === i.id && (settings.includeWarmupsInStats || x.setType !== 'warmup'),
                )
                .sort((a, b) => a.setNumber - b.setNumber)
              if (sets.length === 0) return null
              return (
                <div key={i.id} className="stack tight">
                  <span className="small">
                    {names.get(i.performedExerciseId) ?? i.performedNameSnapshot}
                    {(i.isForeign || i.supersetGroupId) && (
                      <span className="inline-tags">
                        {i.isForeign && <span className="tag foreign">outside day</span>}
                        {i.supersetGroupId && <span className="tag superset-tag">superset</span>}
                      </span>
                    )}
                  </span>
                  <div className="chip-row">
                    {sets.map((x) => (
                      <span
                        key={x.id}
                        className={`set-chip num ${x.setType === 'warmup' ? 'warm' : ''}`}
                        title={x.setType === 'warmup' ? 'Warm-up' : 'Working set'}
                      >
                        {formatSetShort(x)}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </article>
        )
      })}
      {activity && sessions.length > 0 && (
        <p className="hint">
          {activity.sets} sets
          {activity.volumeKg > 0 ? ` · ≈ ${formatNumber(Math.round(activity.volumeKg))} kg volume` : ''}
        </p>
      )}
    </div>
  )
}
