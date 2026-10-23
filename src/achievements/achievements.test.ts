import { describe, expect, it } from 'vitest'
import type { CardioEntry, SetRecord, WorkoutExercise, WorkoutSession } from '../domain/types'
import {
  allUnlocks,
  formatMass,
  hallOfFame,
  milestoneTitle,
  ordinal,
  rankOf,
  sessionTotals,
  trackProgress,
  TRACKS,
  type AchievementData,
} from './achievements'

const stamp = '2026-01-01T00:00:00.000+01:00'

function session(id: string, startedAt: string, minutes = 60, extra: Partial<WorkoutSession> = {}): WorkoutSession {
  const end = new Date(Date.parse(startedAt) + minutes * 60_000)
  return {
    id,
    routineId: null,
    routineNameSnapshot: null,
    dayTypeId: null,
    dayTypeNameSnapshot: null,
    locationId: null,
    locationNameSnapshot: null,
    startedAt,
    endedAt: end.toISOString(),
    status: 'completed',
    createdAt: stamp,
    updatedAt: stamp,
    ...extra,
  }
}

function instance(id: string, sessionId: string, exerciseId: string): WorkoutExercise {
  return {
    id,
    sessionId,
    plannedExerciseId: null,
    performedExerciseId: exerciseId,
    plannedNameSnapshot: null,
    performedNameSnapshot: exerciseId,
    position: 0,
    status: 'completed',
    isForeign: false,
  }
}

let n = 0
function set(
  sessionId: string,
  weId: string,
  weight: number,
  reps: number,
  setType: SetRecord['setType'] = 'working',
): SetRecord {
  return {
    id: `set-${++n}`,
    sessionId,
    workoutExerciseId: weId,
    setNumber: 1,
    setType,
    loadType: 'weight',
    weightValue: weight,
    weightUnit: 'kg',
    reps,
    isCompleted: true,
    performedAt: null,
    locationId: null,
    locationNameSnapshot: null,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

/** One workout per given start time, each with `setsEach` sets of 100 kg × 10. */
function history(starts: string[], setsEach = 1, unilateral: string[] = []): AchievementData {
  const sessions = starts.map((s, i) => session(`s${i}`, s))
  const instances = sessions.map((s) => instance(`we-${s.id}`, s.id, 'bench'))
  const sets = sessions.flatMap((s) => Array.from({ length: setsEach }, () => set(s.id, `we-${s.id}`, 100, 10)))
  return { sessions, instances, sets, unilateral: new Set(unilateral), cardio: [] }
}

describe('track design', () => {
  it('has twelve levels per track whose steps always grow', () => {
    for (const t of TRACKS) {
      expect(t.thresholds).toHaveLength(12)
      const steps = t.thresholds.slice(1).map((v, i) => v - t.thresholds[i])
      for (let i = 1; i < steps.length; i++) expect(steps[i], `${t.id} step ${i}`).toBeGreaterThan(steps[i - 1])
    }
  })
})

describe('running totals', () => {
  it('dates every level by the workout that crossed it', () => {
    const starts = Array.from({ length: 12 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}T18:00:00.000+01:00`)
    const tracks = trackProgress(sessionTotals(history(starts, 1), { includeWarmups: true }), '2026-03-12')
    const workouts = tracks.find((t) => t.def.id === 'workouts')!
    expect(workouts.value).toBe(12)
    expect(workouts.level).toBe(2) // 1 and 10
    expect(workouts.unlocked[1].sessionId).toBe('s9')
    expect(workouts.next).toBe(25)
    expect(workouts.fraction).toBeCloseTo(2 / 15)

    const volume = tracks.find((t) => t.def.id === 'volume')!
    expect(volume.value).toBe(12_000) // 12 × 100 kg × 10
    expect(volume.unlocked.map((u) => u.sessionId)).toEqual(['s0', 's9']) // 1 t, 10 t

    const time = tracks.find((t) => t.def.id === 'time')!
    expect(time.unlocked.map((u) => u.sessionId)).toEqual(['s0', 's9']) // 1 h, 10 h
  })

  it('respects the warm-up setting and counts one-sided sets for both sides', () => {
    const data = history(['2026-03-02T18:00:00.000+01:00'], 1, ['bench'])
    data.sets.push(set('s0', 'we-s0', 50, 10, 'warmup'))
    const [withWarmups] = sessionTotals(data, { includeWarmups: true })
    const [without] = sessionTotals(data, { includeWarmups: false })
    expect(withWarmups.sets).toBe(2)
    expect(without.sets).toBe(1)
    expect(without.volumeKg).toBe(2000) // 100 × 10 × 2 sides
    expect(without.reps).toBe(20)
  })

  it('counts cardio-only workouts, but not empty ones, and ignores runaway durations', () => {
    const data = history([])
    data.sessions.push(session('cardio', '2026-03-02T07:00:00.000+01:00', 40))
    data.sessions.push(session('empty', '2026-03-03T07:00:00.000+01:00'))
    data.sessions.push(session('forgotten', '2026-03-04T07:00:00.000+01:00', 20 * 60))
    data.instances.push(instance('we-f', 'forgotten', 'bench'))
    data.sets.push(set('forgotten', 'we-f', 60, 5))
    const cardio: CardioEntry = {
      id: 'c1',
      sessionId: 'cardio',
      kind: 'treadmill',
      slot: 'start',
      startedAt: '2026-03-02T07:00:00.000+01:00',
      endedAt: '2026-03-02T07:30:00.000+01:00',
      durationSeconds: 1800,
      createdAt: stamp,
      updatedAt: stamp,
    }
    data.cardio.push(cardio)
    const totals = sessionTotals(data, { includeWarmups: true })
    expect(totals.map((t) => t.sessionId)).toEqual(['cardio', 'forgotten'])
    expect(totals[0].cardioSeconds).toBe(1800)
    expect(totals[1].seconds).toBe(0)
  })
})

describe('weekly streaks', () => {
  // Mondays: 2026-03-02, 03-09, 03-16, 03-23, 03-30
  const weeks = [
    '2026-03-02T18:00:00.000+01:00',
    '2026-03-04T18:00:00.000+01:00',
    '2026-03-10T18:00:00.000+01:00',
    '2026-03-12T18:00:00.000+01:00',
    '2026-03-17T18:00:00.000+01:00',
    // week of 03-23: nothing → both streaks break
    '2026-03-31T18:00:00.000+02:00',
  ]

  it('tracks the current and the longest streak; the running week never breaks one', () => {
    const totals = sessionTotals(history(weeks), { includeWarmups: true })
    const [one, two] = trackProgress(totals, '2026-04-01').filter((t) => t.def.streak)
    expect(one.value).toBe(3)
    expect(one.current).toBe(1)
    expect(one.level).toBe(1) // 2 weeks
    expect(one.unlocked[0].sessionId).toBe('s2') // first workout of the second week
    expect(two.value).toBe(2)
    expect(two.unlocked[0].sessionId).toBe('s3') // second workout of the second week
    expect(two.current).toBe(0)
    expect(two.thisWeek).toBe(1)

    // Still the week of 03-17 and nothing logged yet → the streak is alive.
    const pending = trackProgress(sessionTotals(history(weeks.slice(0, 4)), { includeWarmups: true }), '2026-03-18')
    expect(pending.find((t) => t.def.id === 'streak1')!.current).toBe(2)
  })
})

describe('unlocks, wording and hall of fame', () => {
  it('lists milestones newest first', () => {
    const starts = Array.from({ length: 10 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}T18:00:00.000+01:00`)
    const unlocks = allUnlocks(trackProgress(sessionTotals(history(starts, 2), { includeWarmups: true }), '2026-03-10'))
    expect(unlocks[0].sessionId).toBe('s9')
    expect(unlocks.at(-1)!.sessionId).toBe('s0')
  })

  it('words milestones', () => {
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(12)).toBe('12th')
    expect(ordinal(22)).toBe('22nd')
    expect(milestoneTitle('workouts', 100, 'kg')).toBe('100th workout')
    expect(milestoneTitle('workouts', 1, 'kg')).toBe('First workout')
    expect(milestoneTitle('volume', 10_000, 'kg')).toBe('10 t lifted')
    expect(milestoneTitle('time', 3600, 'kg')).toBe('1 hour trained')
    expect(milestoneTitle('streak1', 13, 'kg')).toBe('13-week streak')
    expect(formatMass(850, 'kg')).toBe('850 kg')
    expect(formatMass(12_345, 'kg')).toBe('12.3 t')
    expect(rankOf(0).name).toBe('Rookie')
    expect(rankOf(59).name).toBe('Dedicated')
    expect(rankOf(60).name).toBe('Veteran')
    expect(rankOf(120).next).toBeNull()
  })

  it('picks favourites', () => {
    const data = history(['2026-03-02T18:00:00.000+01:00', '2026-03-03T07:30:00.000+01:00'], 2)
    data.sessions[0].locationId = 'gym'
    data.sessions[0].locationNameSnapshot = 'Gym'
    data.sessions[1].locationId = 'gym'
    data.sessions[1].locationNameSnapshot = 'My Gym'
    data.instances.push(instance('we-row', 's1', 'row'))
    data.sets.push(set('s1', 'we-row', 140, 3))
    const hall = hallOfFame(data, [], { includeWarmups: true })
    expect(hall.mostSets).toMatchObject({ exerciseId: 'bench', sets: 4 })
    expect(hall.mostFrequent).toMatchObject({ exerciseId: 'bench', workouts: 2 })
    expect(hall.heaviest).toMatchObject({ name: 'row', weight: 140, reps: 3 })
    expect(hall.location).toEqual({ name: 'My Gym', workouts: 2 })
    expect(hall.weekday).toEqual({ day: 0, workouts: 1 })
    expect(hall.biggest?.sessionId).toBe('s1')
    expect(hall.usualStart).toBe(18 * 60)
  })
})
