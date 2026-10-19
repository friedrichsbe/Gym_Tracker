import { db } from '../data/db'
import { groupBy } from '../domain/collections'
import { instant } from '../domain/time'
import type { SetRecord, WeightUnit, WorkoutExercise, WorkoutSession } from '../domain/types'

// Pure statistics. Raw sets are the only source; everything here is derived at query time
// (PRD Appendix B) so definitions can change without touching stored data.

export interface StatsData {
  /** Completed sessions only. */
  sessions: WorkoutSession[]
  instances: WorkoutExercise[]
  /** Completed sets of those sessions only. */
  sets: SetRecord[]
  /** Exercises done one side at a time: a set's volume counts for both sides. */
  unilateral: Set<string>
}

export async function loadStatsData(): Promise<StatsData> {
  const sessions = await db.sessions.where('status').equals('completed').toArray()
  const ids = new Set(sessions.map((s) => s.id))
  const [instances, sets, exercises] = await Promise.all([
    db.workoutExercises.toArray(),
    db.sets.toArray(),
    db.exercises.toArray(),
  ])
  return {
    sessions,
    instances: instances.filter((i) => ids.has(i.sessionId)),
    sets: sets.filter((s) => s.isCompleted && ids.has(s.sessionId)),
    unilateral: new Set(exercises.filter((e) => e.unilateral).map((e) => e.id)),
  }
}

/** Instances whose sets count twice in volume (one-sided exercises: both sides are logged as one set). */
const unilateralInstances = (data: StatsData): Set<string> =>
  new Set(data.instances.filter((i) => data.unilateral.has(i.performedExerciseId)).map((i) => i.id))

// ---------------------------------------------------------------------------
// Dates — "YYYY-MM-DD" keys, calendar maths in UTC so DST never shifts a day.
// ---------------------------------------------------------------------------

export type DateKey = string

/** The calendar day the workout was logged on, in the local time recorded with it. */
export const dateKeyOf = (iso: string): DateKey => iso.slice(0, 10)

const toUtc = (k: DateKey) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const fromUtc = (d: Date): DateKey => d.toISOString().slice(0, 10)

export const addDays = (k: DateKey, n: number): DateKey => fromUtc(new Date(toUtc(k).getTime() + n * 86_400_000))
export const addMonths = (k: DateKey, n: number): DateKey => {
  const d = toUtc(k)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d.getUTCDate(), last))
  return fromUtc(target)
}
/** Monday = 0 … Sunday = 6 */
export const weekdayMon0 = (k: DateKey): number => (toUtc(k).getUTCDay() + 6) % 7
export const startOfWeek = (k: DateKey): DateKey => addDays(k, -weekdayMon0(k))
export const startOfMonth = (k: DateKey): DateKey => `${k.slice(0, 7)}-01`
export const daysInMonth = (k: DateKey): number => new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0)).getUTCDate()
export const todayKey = (): DateKey => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Activity per day (heatmap)
// ---------------------------------------------------------------------------

export interface DayActivity {
  date: DateKey
  workouts: number
  sets: number
  /** Σ weight × reps converted to kg (only to compare intensity between days). */
  volumeKg: number
  durationSeconds: number
  sessionIds: string[]
  dayTypes: string[]
}

export type HeatMetric = 'sets' | 'volume' | 'workouts'

const KG_PER_LB = 0.45359237
export const toKg = (value: number, unit: WeightUnit): number => (unit === 'lb' ? value * KG_PER_LB : value)

export function dailyActivity(data: StatsData, opts: { includeWarmups: boolean }): Map<DateKey, DayActivity> {
  const setsBySession = groupBy(data.sets, (s) => s.sessionId)
  const twoSided = unilateralInstances(data)
  const out = new Map<DateKey, DayActivity>()
  for (const session of data.sessions) {
    const sets = (setsBySession.get(session.id) ?? []).filter((s) => opts.includeWarmups || s.setType !== 'warmup')
    if (sets.length === 0) continue // a workout without a counted set leaves no mark
    const key = dateKeyOf(session.startedAt)
    const day = out.get(key) ?? {
      date: key,
      workouts: 0,
      sets: 0,
      volumeKg: 0,
      durationSeconds: 0,
      sessionIds: [],
      dayTypes: [],
    }
    day.workouts += 1
    day.sets += sets.length
    for (const s of sets) {
      if (s.loadType === 'weight' && s.weightValue != null && s.reps != null)
        day.volumeKg += toKg(s.weightValue, s.weightUnit) * s.reps * (twoSided.has(s.workoutExerciseId) ? 2 : 1)
    }
    if (session.endedAt)
      day.durationSeconds += Math.max(0, (instant(session.endedAt) - instant(session.startedAt)) / 1000)
    day.sessionIds.push(session.id)
    if (session.dayTypeNameSnapshot && !day.dayTypes.includes(session.dayTypeNameSnapshot))
      day.dayTypes.push(session.dayTypeNameSnapshot)
    out.set(key, day)
  }
  return out
}

export const metricValue = (d: DayActivity | undefined, metric: HeatMetric): number =>
  !d ? 0 : metric === 'sets' ? d.sets : metric === 'volume' ? d.volumeKg : d.workouts

/**
 * Maps a value to a colour level 0–4. Levels follow the quartiles of the non-zero
 * values, so a single huge day cannot wash out everything else.
 */
export function levelScale(values: number[]): (v: number) => 0 | 1 | 2 | 3 | 4 {
  const nz = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (nz.length === 0) return () => 0
  const q = (p: number) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))]
  const [t1, t2, t3] = [q(0.25), q(0.5), q(0.75)]
  return (v) => (v <= 0 ? 0 : v <= t1 ? 1 : v <= t2 ? 2 : v <= t3 ? 3 : 4)
}

// ---------------------------------------------------------------------------
// Exercise progress
// ---------------------------------------------------------------------------

export type LocationFilter = 'all' | 'none' | string

export interface ExercisePoint {
  date: DateKey
  sessionId: string
  startedAt: string
  /** Heaviest counted set, in the requested unit (null if no external-load set). */
  topWeight: number | null
  repsAtTop: number | null
  bestReps: number
  /** Best estimated one-rep max of the session (Epley), null when no loaded set of 1–12 reps. */
  e1rm: number | null
  volume: number
  sets: number
  locationNames: string[]
  /** At least one counted set of this session was done as part of a superset (effort is not directly comparable). */
  superset: boolean
}

export interface ExerciseStats {
  points: ExercisePoint[]
  records: {
    heaviest: { weight: number; reps: number; date: DateKey; sessionId: string } | null
    mostReps: { reps: number; weight: number | null; date: DateKey; sessionId: string } | null
    bestSetVolume: { volume: number; weight: number; reps: number; date: DateKey; sessionId: string } | null
  }
  totalSets: number
}

const convert = (value: number, from: WeightUnit, to: WeightUnit) =>
  from === to ? value : to === 'kg' ? value * KG_PER_LB : value / KG_PER_LB

export function exerciseStats(
  data: StatsData,
  exerciseId: string,
  opts: { location: LocationFilter; includeWarmups: boolean; unit: WeightUnit; supersets?: 'include' | 'exclude' },
): ExerciseStats {
  const mine = data.instances.filter((i) => i.performedExerciseId === exerciseId)
  const instanceIds = new Set(mine.map((i) => i.id))
  const supersetInstances = new Set(mine.filter((i) => i.supersetGroupId).map((i) => i.id))
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]))
  const sides = data.unilateral.has(exerciseId) ? 2 : 1
  const sets = data.sets.filter((s) => {
    if (!instanceIds.has(s.workoutExerciseId)) return false
    if (opts.supersets === 'exclude' && supersetInstances.has(s.workoutExerciseId)) return false
    if (!opts.includeWarmups && s.setType === 'warmup') return false
    if (opts.location === 'all') return true
    return opts.location === 'none' ? s.locationId === null : s.locationId === opts.location
  })

  const records: ExerciseStats['records'] = { heaviest: null, mostReps: null, bestSetVolume: null }
  const bySession = groupBy(sets, (s) => s.sessionId)
  const points: ExercisePoint[] = []

  for (const [sessionId, group] of bySession) {
    const session = sessionById.get(sessionId)!
    const date = dateKeyOf(session.startedAt)
    let topWeight: number | null = null
    let repsAtTop: number | null = null
    let bestReps = 0
    let volume = 0
    let e1rm: number | null = null
    for (const s of group) {
      const reps = s.reps ?? 0
      bestReps = Math.max(bestReps, reps)
      const external = s.loadType === 'weight' && s.weightValue != null
      const w = external ? convert(s.weightValue!, s.weightUnit, opts.unit) : null
      const est = estimateOneRepMax(w, reps)
      if (est != null && (e1rm == null || est > e1rm)) e1rm = est
      if (w != null) {
        volume += w * reps * sides
        if (topWeight == null || w > topWeight || (w === topWeight && reps > (repsAtTop ?? 0))) {
          topWeight = w
          repsAtTop = reps
        }
        // Ties go to the set with more reps.
        if (
          reps > 0 &&
          (!records.heaviest ||
            w > records.heaviest.weight ||
            (w === records.heaviest.weight && reps > records.heaviest.reps))
        )
          records.heaviest = { weight: w, reps, date, sessionId }
        if (reps > 0 && (!records.bestSetVolume || w * reps > records.bestSetVolume.volume))
          records.bestSetVolume = { volume: w * reps, weight: w, reps, date, sessionId }
      }
      // Ties go to the heavier set.
      if (
        reps > 0 &&
        (!records.mostReps ||
          reps > records.mostReps.reps ||
          (reps === records.mostReps.reps && (w ?? 0) > (records.mostReps.weight ?? 0)))
      )
        records.mostReps = { reps, weight: w, date, sessionId }
    }
    points.push({
      date,
      sessionId,
      startedAt: session.startedAt,
      topWeight,
      repsAtTop,
      bestReps,
      e1rm,
      volume,
      sets: group.length,
      locationNames: [...new Set(group.map((s) => s.locationNameSnapshot ?? 'Unknown'))],
      superset: group.some((s) => supersetInstances.has(s.workoutExerciseId)),
    })
  }
  points.sort((a, b) => instant(a.startedAt) - instant(b.startedAt))
  return { points, records, totalSets: sets.length }
}

/** Locations an exercise was done at, most recent first, with their set counts. */
export function exerciseLocations(
  data: StatsData,
  exerciseId: string,
): { id: string | null; name: string; sets: number; last: string }[] {
  const instanceIds = new Set(data.instances.filter((i) => i.performedExerciseId === exerciseId).map((i) => i.id))
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]))
  const out = new Map<string | null, { id: string | null; name: string; sets: number; last: string }>()
  for (const s of data.sets) {
    if (!instanceIds.has(s.workoutExerciseId)) continue
    const started = sessionById.get(s.sessionId)!.startedAt
    const cur = out.get(s.locationId) ?? {
      id: s.locationId,
      name: s.locationNameSnapshot ?? 'Unknown location',
      sets: 0,
      last: started,
    }
    cur.sets += 1
    if (instant(started) > instant(cur.last)) {
      cur.last = started
      cur.name = s.locationNameSnapshot ?? cur.name
    }
    out.set(s.locationId, cur)
  }
  return [...out.values()].sort((a, b) => instant(b.last) - instant(a.last))
}

/** Exercises that have at least one completed set, most recently done first. */
export function trainedExerciseIds(data: StatsData): string[] {
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]))
  const instanceById = new Map(data.instances.map((i) => [i.id, i]))
  const last = new Map<string, number>()
  for (const s of data.sets) {
    const inst = instanceById.get(s.workoutExerciseId)
    if (!inst) continue
    const t = instant(sessionById.get(s.sessionId)!.startedAt)
    last.set(inst.performedExerciseId, Math.max(last.get(inst.performedExerciseId) ?? 0, t))
  }
  return [...last.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
}

// ---------------------------------------------------------------------------
// Time range (progress charts)
// ---------------------------------------------------------------------------

export type RangeId = '1m' | '3m' | '6m' | '1y' | 'all'
export const RANGES: { id: RangeId; label: string }[] = [
  { id: '1m', label: '1 M' },
  { id: '3m', label: '3 M' },
  { id: '6m', label: '6 M' },
  { id: '1y', label: '1 Y' },
  { id: 'all', label: 'All' },
]

/** First calendar day included in the range (null = no lower bound). */
export function rangeStart(range: RangeId, today: DateKey = todayKey()): DateKey | null {
  const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, all: 0 }[range]
  return months === 0 ? null : addMonths(today, -months)
}

export const inRange = <T extends { date: DateKey }>(points: T[], range: RangeId, today?: DateKey): T[] => {
  const from = rangeStart(range, today)
  return from === null ? points : points.filter((p) => p.date >= from)
}

// ---------------------------------------------------------------------------
// Estimated 1RM, training frequency and weekly sets per muscle
// ---------------------------------------------------------------------------

/**
 * Epley estimate of the one-rep max. Only meaningful for loaded sets of up to 12 reps; always shown as an estimate.
 * Returns null where the formula does not apply.
 */
export function estimateOneRepMax(weight: number | null, reps: number | null): number | null {
  if (weight == null || weight <= 0 || reps == null || reps < 1 || reps > 12) return null
  return reps === 1 ? weight : weight * (1 + reps / 30)
}

export interface WeekRow {
  /** Monday of the week. */
  week: DateKey
  workouts: number
  /** Counted sets per muscle tag of the exercise performed. */
  muscleSets: Map<string, number>
}

/** The last `weeks` weeks (current one last), including weeks without training. */
export function weeklyOverview(
  data: StatsData,
  muscleOf: (exerciseId: string) => string[],
  opts: { weeks: number; includeWarmups: boolean; today?: DateKey },
): WeekRow[] {
  const thisWeek = startOfWeek(opts.today ?? todayKey())
  const rows = new Map<DateKey, WeekRow>()
  for (let i = opts.weeks - 1; i >= 0; i--) {
    const week = addDays(thisWeek, -7 * i)
    rows.set(week, { week, workouts: 0, muscleSets: new Map() })
  }
  const sessionDate = new Map(data.sessions.map((s) => [s.id, dateKeyOf(s.startedAt)]))
  const instance = new Map(data.instances.map((i) => [i.id, i]))
  const counted = new Set<string>()
  for (const s of data.sets) {
    if (!opts.includeWarmups && s.setType === 'warmup') continue
    const date = sessionDate.get(s.sessionId)
    const row = date ? rows.get(startOfWeek(date)) : undefined
    if (!row) continue
    counted.add(s.sessionId)
    const we = instance.get(s.workoutExerciseId)
    for (const m of we ? muscleOf(we.performedExerciseId) : []) row.muscleSets.set(m, (row.muscleSets.get(m) ?? 0) + 1)
  }
  for (const id of counted) {
    const row = rows.get(startOfWeek(sessionDate.get(id)!))
    if (row) row.workouts += 1
  }
  return [...rows.values()]
}
