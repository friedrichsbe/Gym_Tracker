import { db } from '../data/db'
import { groupBy } from '../domain/collections'
import { instant } from '../domain/time'
import type { CardioEntry, CardioKind, Exercise, IsoTimestamp, WeightUnit } from '../domain/types'
import {
  addDays,
  dateKeyOf,
  loadStatsData,
  startOfWeek,
  todayKey,
  toKg,
  type DateKey,
  type StatsData,
} from '../analytics/analytics'

// Milestones ("trophies"): every track is a running total (or a weekly streak) with twelve levels. Like all other
// statistics they are derived from the raw workouts at query time — nothing is stored, so editing or deleting a
// workout moves the milestones with it. The date of a milestone is the workout that crossed the line.

export type TrackId =
  'workouts' | 'volume' | 'sets' | 'reps' | 'time' | 'cardio' | 'streak1' | 'streak2' | 'streak3' | 'streak4'
type StreakId = 'streak1' | 'streak2' | 'streak3' | 'streak4'

export interface TrackDef {
  id: TrackId
  name: string
  /** What counts, in one line. */
  blurb: string
  /** Twelve levels. The step between two levels always grows, so every level is a little harder than the last. */
  thresholds: number[]
  streak?: { minPerWeek: number }
}

const HOUR = 3600
const TONNE = 1000

/**
 * Sizing (≈3–4 workouts a week, ~20 sets and ~10 t per workout): the first levels come within days or weeks, about
 * half the ladder within the first year, the last level after roughly a decade of steady training.
 * Counts that grow linearly (workouts, sets, hours) get gently growing steps; volume, which grows faster as you get
 * stronger, gets steeper ones; streaks need every single week, so they top out at 5, 3, 2 and
 * 1½ years (1+, 2+, 3+, 4+ workouts a week).
 */
export const TRACKS: TrackDef[] = [
  {
    id: 'workouts',
    name: 'Workouts',
    blurb: 'Every finished workout counts.',
    thresholds: [1, 10, 25, 50, 100, 175, 275, 400, 575, 800, 1100, 1500],
  },
  {
    id: 'volume',
    name: 'Volume',
    blurb: 'Total weight moved: weight × reps of every set.',
    thresholds: [1, 10, 50, 100, 250, 500, 1000, 2000, 3500, 6000, 10000, 15000].map((t) => t * TONNE),
  },
  {
    id: 'sets',
    name: 'Sets',
    blurb: 'Every completed set.',
    thresholds: [10, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 18000, 25000],
  },
  {
    id: 'reps',
    name: 'Reps',
    blurb: 'Every repetition of every set.',
    thresholds: [100, 1000, 2500, 5000, 10000, 20000, 35000, 55000, 80000, 120000, 175000, 250000],
  },
  {
    id: 'time',
    name: 'Training time',
    blurb: 'Time spent in finished workouts.',
    thresholds: [1, 10, 25, 50, 100, 175, 275, 400, 600, 850, 1200, 1700].map((h) => h * HOUR),
  },
  {
    id: 'cardio',
    name: 'Cardio',
    blurb: 'Time on the cardio machines.',
    thresholds: [1, 5, 10, 20, 35, 55, 80, 110, 150, 200, 275, 375].map((h) => h * HOUR),
  },
  {
    id: 'streak1',
    name: 'Weekly streak',
    blurb: 'Weeks in a row with at least one workout.',
    thresholds: [2, 4, 8, 13, 20, 30, 42, 56, 75, 104, 156, 260],
    streak: { minPerWeek: 1 },
  },
  {
    id: 'streak2',
    name: 'Double streak',
    blurb: 'Weeks in a row with at least two workouts.',
    thresholds: [2, 4, 7, 11, 16, 23, 32, 44, 60, 80, 110, 156],
    streak: { minPerWeek: 2 },
  },
  {
    id: 'streak3',
    name: 'Triple streak',
    blurb: 'Weeks in a row with at least three workouts.',
    thresholds: [2, 3, 5, 8, 12, 17, 23, 31, 42, 56, 75, 104],
    streak: { minPerWeek: 3 },
  },
  {
    id: 'streak4',
    name: 'Quad streak',
    blurb: 'Weeks in a row with at least four workouts.',
    thresholds: [2, 3, 5, 8, 12, 17, 23, 30, 38, 48, 60, 75],
    streak: { minPerWeek: 4 },
  },
]

export const MAX_LEVEL = 12
export const trackDef = (id: TrackId): TrackDef => TRACKS.find((t) => t.id === id)!

/** Medal material per level (1-based). */
export const TIERS = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Jade',
  'Sapphire',
  'Ruby',
  'Amethyst',
  'Diamond',
  'Obsidian',
  'Aurora',
  'Legend',
] as const
export const tierName = (level: number): string => TIERS[Math.max(1, Math.min(MAX_LEVEL, level)) - 1]

/** Overall rank from the sum of all track levels (0 … 120). */
export const RANKS: { from: number; name: string }[] = [
  { from: 0, name: 'Rookie' },
  { from: 15, name: 'Regular' },
  { from: 35, name: 'Dedicated' },
  { from: 60, name: 'Veteran' },
  { from: 85, name: 'Elite' },
  { from: 110, name: 'Legend' },
]

/** A workout that does not count anywhere is longer than this: most likely it was never finished on time. */
export const MAX_COUNTED_WORKOUT_SECONDS = 5 * HOUR

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export interface AchievementData extends StatsData {
  /** Cardio blocks of the completed sessions. */
  cardio: CardioEntry[]
}

export async function loadAchievementData(): Promise<AchievementData> {
  const stats = await loadStatsData()
  const ids = new Set(stats.sessions.map((s) => s.id))
  const cardio = (await db.cardio.toArray()).filter((c) => ids.has(c.sessionId))
  return { ...stats, cardio }
}

interface SessionTotals {
  sessionId: string
  startedAt: IsoTimestamp
  week: DateKey
  sets: number
  reps: number
  volumeKg: number
  seconds: number
  cardioSeconds: number
}

/** Per-workout contributions, oldest first. Workouts with neither a counted set nor cardio are left out. */
export function sessionTotals(data: AchievementData, opts: { includeWarmups: boolean }): SessionTotals[] {
  const setsBySession = groupBy(data.sets, (s) => s.sessionId)
  const cardioBySession = groupBy(data.cardio, (c) => c.sessionId)
  const twoSided = new Set(data.instances.filter((i) => data.unilateral.has(i.performedExerciseId)).map((i) => i.id))
  const out: SessionTotals[] = []
  for (const session of data.sessions) {
    const sets = (setsBySession.get(session.id) ?? []).filter((s) => opts.includeWarmups || s.setType !== 'warmup')
    const cardioSeconds = (cardioBySession.get(session.id) ?? []).reduce((n, c) => n + (c.durationSeconds ?? 0), 0)
    if (sets.length === 0 && cardioSeconds === 0) continue
    let reps = 0
    let volumeKg = 0
    for (const s of sets) {
      // A one-sided set is logged once but done on both sides.
      const sides = twoSided.has(s.workoutExerciseId) ? 2 : 1
      reps += (s.reps ?? 0) * sides
      if (s.loadType === 'weight' && s.weightValue != null && s.reps != null)
        volumeKg += toKg(s.weightValue, s.weightUnit) * s.reps * sides
    }
    const seconds = session.endedAt ? (instant(session.endedAt) - instant(session.startedAt)) / 1000 : 0
    out.push({
      sessionId: session.id,
      startedAt: session.startedAt,
      week: startOfWeek(dateKeyOf(session.startedAt)),
      sets: sets.length,
      reps,
      volumeKg,
      seconds: seconds > 0 && seconds <= MAX_COUNTED_WORKOUT_SECONDS ? seconds : 0,
      cardioSeconds,
    })
  }
  return out.sort((a, b) => instant(a.startedAt) - instant(b.startedAt))
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export interface Unlock {
  /** Stable key, "workouts:5". */
  id: string
  track: TrackId
  level: number
  threshold: number
  sessionId: string
  at: IsoTimestamp
}

export interface TrackProgress {
  def: TrackDef
  /** Running total; for streaks the longest streak. */
  value: number
  /** Streaks only: the streak still alive (the running week never breaks it). */
  current?: number
  /** Streaks only: workouts in the running week. */
  thisWeek?: number
  level: number
  /** Reached levels, lowest first. */
  unlocked: Unlock[]
  /** Next threshold; null at the top level. */
  next: number | null
  /** 0 … 1 towards `next` (1 at the top level). Streaks measure the current streak against it. */
  fraction: number
}

const unlock = (track: TrackId, index: number, threshold: number, s: { sessionId: string; startedAt: string }) => ({
  id: `${track}:${index + 1}`,
  track,
  level: index + 1,
  threshold,
  sessionId: s.sessionId,
  at: s.startedAt,
})

function totalTrack(def: TrackDef, totals: SessionTotals[], pick: (t: SessionTotals) => number): TrackProgress {
  let value = 0
  const unlocked: Unlock[] = []
  for (const t of totals) {
    value += pick(t)
    while (unlocked.length < def.thresholds.length && value >= def.thresholds[unlocked.length])
      unlocked.push(unlock(def.id, unlocked.length, def.thresholds[unlocked.length], t))
  }
  const level = unlocked.length
  const next = def.thresholds[level] ?? null
  const prev = level > 0 ? def.thresholds[level - 1] : 0
  return {
    def,
    value,
    level,
    unlocked,
    next,
    fraction: next == null ? 1 : Math.max(0, Math.min(1, (value - prev) / (next - prev))),
  }
}

function streakTrack(def: TrackDef, totals: SessionTotals[], today: DateKey): TrackProgress {
  const min = def.streak!.minPerWeek
  const byWeek = groupBy(totals, (t) => t.week)
  const thisWeek = startOfWeek(today)
  const unlocked: Unlock[] = []
  let current = 0
  let longest = 0
  if (totals.length > 0) {
    for (let week = totals[0].week; week <= thisWeek; week = addDays(week, 7)) {
      const workouts = byWeek.get(week) ?? []
      if (workouts.length >= min) {
        current += 1
        longest = Math.max(longest, current)
        // The workout that made the week count is the one that extended the streak.
        while (unlocked.length < def.thresholds.length && current >= def.thresholds[unlocked.length])
          unlocked.push(unlock(def.id, unlocked.length, def.thresholds[unlocked.length], workouts[min - 1]))
      } else if (week !== thisWeek) {
        current = 0
      }
    }
  }
  const level = unlocked.length
  const next = def.thresholds[level] ?? null
  return {
    def,
    value: longest,
    current,
    thisWeek: byWeek.get(thisWeek)?.length ?? 0,
    level,
    unlocked,
    next,
    fraction: next == null ? 1 : Math.max(0, Math.min(1, current / next)),
  }
}

const PICK: Record<Exclude<TrackId, StreakId>, (t: SessionTotals) => number> = {
  workouts: () => 1,
  volume: (t) => t.volumeKg,
  sets: (t) => t.sets,
  reps: (t) => t.reps,
  time: (t) => t.seconds,
  cardio: (t) => t.cardioSeconds,
}

export function trackProgress(totals: SessionTotals[], today: DateKey = todayKey()): TrackProgress[] {
  return TRACKS.map((def) =>
    def.streak ? streakTrack(def, totals, today) : totalTrack(def, totals, PICK[def.id as keyof typeof PICK]),
  )
}

/** All reached milestones, newest first (higher level first within the same workout). */
export function allUnlocks(tracks: TrackProgress[]): Unlock[] {
  return tracks
    .flatMap((t) => t.unlocked)
    .sort((a, b) => instant(b.at) - instant(a.at) || b.level - a.level || a.id.localeCompare(b.id))
}

export function rankOf(totalLevel: number): { name: string; next: { from: number; name: string } | null } {
  let i = 0
  while (i + 1 < RANKS.length && totalLevel >= RANKS[i + 1].from) i++
  return { name: RANKS[i].name, next: RANKS[i + 1] ?? null }
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

const intFmt = new Intl.NumberFormat('en')
const compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const LB_PER_KG = 1 / 0.45359237

export function ordinal(n: number): string {
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10]
  return `${intFmt.format(n)}${suffix ?? 'th'}`
}

/** "850 kg", "12.5 t", "1,000 t"; pounds in compact form ("27.6K lb"). */
export function formatMass(kg: number, unit: WeightUnit): string {
  if (unit === 'lb') return `${compactFmt.format(Math.round(kg * LB_PER_KG))} lb`
  if (kg < TONNE) return `${intFmt.format(Math.round(kg))} kg`
  const t = kg / TONNE
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: t < 100 ? 1 : 0 }).format(t)} t`
}

const hours = (seconds: number) => Math.floor(seconds / HOUR)

/** A value of the track, short: "312", "48.2 t", "86 h", "13 wk". */
export function formatTrackValue(track: TrackId, value: number, unit: WeightUnit): string {
  switch (track) {
    case 'volume':
      return formatMass(value, unit)
    case 'time':
    case 'cardio':
      return value < HOUR ? `${Math.floor(value / 60)} min` : `${intFmt.format(hours(value))} h`
    case 'streak1':
    case 'streak2':
    case 'streak3':
    case 'streak4':
      return `${value} wk`
    default:
      return intFmt.format(Math.floor(value))
  }
}

/** The headline of a milestone: "100th workout", "10 t lifted", "13-week streak". */
export function milestoneTitle(track: TrackId, threshold: number, unit: WeightUnit): string {
  switch (track) {
    case 'workouts':
      return threshold === 1 ? 'First workout' : `${ordinal(threshold)} workout`
    case 'volume':
      return `${formatMass(threshold, unit)} lifted`
    case 'sets':
      return `${intFmt.format(threshold)} sets`
    case 'reps':
      return `${intFmt.format(threshold)} reps`
    case 'time':
      return `${intFmt.format(hours(threshold))} ${threshold === HOUR ? 'hour' : 'hours'} trained`
    case 'cardio':
      return `${intFmt.format(hours(threshold))} ${threshold === HOUR ? 'hour' : 'hours'} of cardio`
    case 'streak1':
      return `${threshold}-week streak`
    case 'streak2':
    case 'streak3':
    case 'streak4':
      return `${threshold} weeks of ${track.slice(-1)}+`
  }
}

// ---------------------------------------------------------------------------
// Hall of fame: a snapshot of favourites and bests, no levels
// ---------------------------------------------------------------------------

export interface HallOfFame {
  topVolume: { exerciseId: string; name: string; volumeKg: number } | null
  mostSets: { exerciseId: string; name: string; sets: number } | null
  mostFrequent: { exerciseId: string; name: string; workouts: number } | null
  heaviest: { name: string; weight: number; unit: WeightUnit; reps: number; at: IsoTimestamp } | null
  cardio: { kind: CardioKind; sessions: number; seconds: number } | null
  location: { name: string; workouts: number } | null
  dayType: { name: string; workouts: number } | null
  /** Monday = 0. */
  weekday: { day: number; workouts: number } | null
  biggest: { sessionId: string; at: IsoTimestamp; volumeKg: number } | null
  longest: { sessionId: string; at: IsoTimestamp; seconds: number } | null
  /** Median start time of day, in minutes after midnight (local time of each workout). */
  usualStart: number | null
  /** The week (its Monday) with the most workouts. */
  bestWeek: { week: DateKey; workouts: number; sets: number } | null
}

const top = <K>(counts: Map<K, number>): [K, number] | null => {
  let best: [K, number] | null = null
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry
  return best
}
const inc = <K>(m: Map<K, number>, k: K, by = 1) => m.set(k, (m.get(k) ?? 0) + by)

export function hallOfFame(
  data: AchievementData,
  exercises: Exercise[],
  opts: { includeWarmups: boolean },
): HallOfFame {
  const totals = sessionTotals(data, opts)
  const counted = new Set(totals.map((t) => t.sessionId))
  const sessions = data.sessions.filter((s) => counted.has(s.id))
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const instanceById = new Map(data.instances.map((i) => [i.id, i]))
  const nameOf = new Map(exercises.map((e) => [e.id, e.name]))
  const snapshot = new Map(data.instances.map((i) => [i.performedExerciseId, i.performedNameSnapshot]))
  const exName = (id: string) => nameOf.get(id) ?? snapshot.get(id) ?? 'Unknown exercise'

  const volume = new Map<string, number>()
  const setCount = new Map<string, number>()
  const workoutsWith = new Map<string, Set<string>>()
  let heaviest: HallOfFame['heaviest'] = null
  let heaviestKg = 0
  for (const s of data.sets) {
    if (!opts.includeWarmups && s.setType === 'warmup') continue
    const inst = instanceById.get(s.workoutExerciseId)
    if (!inst || !sessionById.has(s.sessionId)) continue
    const id = inst.performedExerciseId
    inc(setCount, id)
    if (!workoutsWith.has(id)) workoutsWith.set(id, new Set())
    workoutsWith.get(id)!.add(s.sessionId)
    if (s.loadType === 'weight' && s.weightValue != null && s.reps != null && s.reps > 0) {
      const kg = toKg(s.weightValue, s.weightUnit)
      inc(volume, id, kg * s.reps * (data.unilateral.has(id) ? 2 : 1))
      if (kg > heaviestKg) {
        heaviestKg = kg
        heaviest = {
          name: exName(id),
          weight: s.weightValue,
          unit: s.weightUnit,
          reps: s.reps,
          at: sessionById.get(s.sessionId)!.startedAt,
        }
      }
    }
  }

  const v = top(volume)
  const sc = top(setCount)
  const freq = top(new Map([...workoutsWith].map(([id, set]) => [id, set.size])))

  const cardioCount = new Map<CardioKind, number>()
  const cardioSeconds = new Map<CardioKind, number>()
  for (const c of data.cardio) {
    if (!sessionById.has(c.sessionId)) continue
    inc(cardioCount, c.kind)
    inc(cardioSeconds, c.kind, c.durationSeconds ?? 0)
  }
  const fav = top(cardioCount)

  const locations = new Map<string, number>()
  const locationName = new Map<string, string>()
  const days = new Map<string, number>()
  const weekdays = new Map<number, number>()
  for (const s of [...sessions].sort((a, b) => instant(a.startedAt) - instant(b.startedAt))) {
    if (s.locationId) {
      inc(locations, s.locationId)
      locationName.set(s.locationId, s.locationNameSnapshot ?? 'Unknown location') // latest name wins
    }
    if (s.dayTypeNameSnapshot) inc(days, s.dayTypeNameSnapshot)
    inc(weekdays, (new Date(`${dateKeyOf(s.startedAt)}T12:00:00Z`).getUTCDay() + 6) % 7)
  }
  const loc = top(locations)
  const day = top(days)
  const wd = top(weekdays)

  let biggest: HallOfFame['biggest'] = null
  let longest: HallOfFame['longest'] = null
  for (const t of totals) {
    if (t.volumeKg > 0 && (!biggest || t.volumeKg > biggest.volumeKg))
      biggest = { sessionId: t.sessionId, at: t.startedAt, volumeKg: t.volumeKg }
    if (t.seconds > 0 && (!longest || t.seconds > longest.seconds))
      longest = { sessionId: t.sessionId, at: t.startedAt, seconds: t.seconds }
  }

  // Busiest week: most workouts; more sets break a tie.
  let bestWeek: HallOfFame['bestWeek'] = null
  for (const [week, list] of groupBy(totals, (t) => t.week)) {
    const sets = list.reduce((n, t) => n + t.sets, 0)
    if (!bestWeek || list.length > bestWeek.workouts || (list.length === bestWeek.workouts && sets > bestWeek.sets))
      bestWeek = { week, workouts: list.length, sets }
  }

  const starts = totals.map((t) => +t.startedAt.slice(11, 13) * 60 + +t.startedAt.slice(14, 16)).sort((a, b) => a - b)

  return {
    topVolume: v && v[1] > 0 ? { exerciseId: v[0], name: exName(v[0]), volumeKg: v[1] } : null,
    mostSets: sc ? { exerciseId: sc[0], name: exName(sc[0]), sets: sc[1] } : null,
    mostFrequent: freq ? { exerciseId: freq[0], name: exName(freq[0]), workouts: freq[1] } : null,
    heaviest,
    cardio: fav ? { kind: fav[0], sessions: fav[1], seconds: cardioSeconds.get(fav[0]) ?? 0 } : null,
    location: loc ? { name: locationName.get(loc[0])!, workouts: loc[1] } : null,
    dayType: day ? { name: day[0], workouts: day[1] } : null,
    weekday: wd ? { day: wd[0], workouts: wd[1] } : null,
    biggest,
    longest,
    usualStart: starts.length ? starts[Math.floor(starts.length / 2)] : null,
    bestWeek,
  }
}
