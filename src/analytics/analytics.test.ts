import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { createCustomExercise } from '../exercises/exerciseService'
import { createLocation } from '../locations/locationService'
import {
  addExercise,
  completeSet,
  finishWorkout,
  loadSessionView,
  startWorkout,
  updateSet,
} from '../workout/workoutService'
import {
  addDays,
  addMonths,
  dailyActivity,
  exerciseLocations,
  exerciseStats,
  levelScale,
  loadStatsData,
  startOfMonth,
  startOfWeek,
  weekdayMon0,
} from './analytics'

describe('date helpers', () => {
  it('does calendar maths without DST or month-length surprises', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30') // EU DST switch weekend
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-10-13', -12)).toBe('2025-10-13')
    expect(weekdayMon0('2026-10-12')).toBe(0) // Monday
    expect(weekdayMon0('2026-10-18')).toBe(6) // Sunday
    expect(startOfWeek('2026-10-13')).toBe('2026-10-12')
    expect(startOfMonth('2026-10-13')).toBe('2026-10-01')
  })

  it('assigns colour levels by quartiles of non-zero values', () => {
    const level = levelScale([0, 10, 12, 14, 16, 18, 20, 22, 200])
    expect(level(0)).toBe(0)
    expect(level(10)).toBe(1)
    expect(level(200)).toBe(4)
    expect(level(12)).toBeLessThanOrEqual(level(20))
    expect(levelScale([])(5)).toBe(0)
  })
})

async function workout(opts: {
  startedAt: string
  location: string | null
  exerciseId: string
  sets: [number, number, ('warmup' | 'working')?][]
}) {
  const s = await startWorkout({ startedAt: opts.startedAt, locationId: opts.location })
  await addExercise({ sessionId: s.id, exerciseId: opts.exerciseId })
  for (const [i, [w, r, type]] of opts.sets.entries()) {
    let sets = (await loadSessionView(s.id))!.exercises[0].sets
    if (type) await updateSet(sets[i].id, { setType: type })
    sets = (await loadSessionView(s.id))!.exercises[0].sets
    await completeSet(sets[i].id, { weightValue: w, reps: r })
  }
  await finishWorkout({ sessionId: s.id, endedAt: opts.startedAt.replace('T18', 'T19') })
  return s.id
}

describe('statistics', () => {
  it('aggregates per day and honours the warm-up setting', async () => {
    const e = (await createCustomExercise({ name: 'Press' })).exercise
    await workout({
      startedAt: '2026-10-12T18:00:00.000+02:00',
      location: null,
      exerciseId: e.id,
      sets: [
        [40, 10, 'warmup'],
        [100, 5],
        [100, 5],
      ],
    })
    await workout({ startedAt: '2026-10-12T20:00:00.000+02:00', location: null, exerciseId: e.id, sets: [[50, 10]] })
    const data = await loadStatsData()

    const withWarmup = dailyActivity(data, { includeWarmups: true }).get('2026-10-12')!
    expect(withWarmup).toMatchObject({ workouts: 2, sets: 4, volumeKg: 400 + 1000 + 500 })
    expect(withWarmup.sessionIds).toHaveLength(2)

    const without = dailyActivity(data, { includeWarmups: false }).get('2026-10-12')!
    expect(without).toMatchObject({ workouts: 2, sets: 3, volumeKg: 1500 })
  })

  it('converts lb to kg only for cross-day intensity', async () => {
    const e = (await createCustomExercise({ name: 'Press' })).exercise
    const id = await workout({
      startedAt: '2026-10-13T18:00:00.000+02:00',
      location: null,
      exerciseId: e.id,
      sets: [[100, 10]],
    })
    await db.sets.where('sessionId').equals(id).modify({ weightUnit: 'lb' })
    const day = dailyActivity(await loadStatsData(), { includeWarmups: true }).get('2026-10-13')!
    expect(Math.round(day.volumeKg)).toBe(454)
  })

  it('builds per-location series and records without mixing machines', async () => {
    const a = await createLocation({ name: 'Gym A' })
    const b = await createLocation({ name: 'Gym B' })
    const e = (await createCustomExercise({ name: 'Leg Press' })).exercise
    await workout({
      startedAt: '2026-09-01T18:00:00.000+02:00',
      location: a.id,
      exerciseId: e.id,
      sets: [
        [100, 10],
        [110, 8],
      ],
    })
    await workout({ startedAt: '2026-09-08T18:00:00.000+02:00', location: a.id, exerciseId: e.id, sets: [[120, 8]] })
    await workout({ startedAt: '2026-09-15T18:00:00.000+02:00', location: b.id, exerciseId: e.id, sets: [[200, 6]] })
    const data = await loadStatsData()

    const atA = exerciseStats(data, e.id, { location: a.id, includeWarmups: true, unit: 'kg' })
    expect(atA.points.map((p) => p.topWeight)).toEqual([110, 120])
    expect(atA.records.heaviest).toMatchObject({ weight: 120, reps: 8 })
    expect(atA.records.mostReps).toMatchObject({ reps: 10, weight: 100 })
    expect(atA.records.bestSetVolume).toMatchObject({ volume: 1000, weight: 100, reps: 10 }) // 100×10 beats 120×8 = 960
    expect(atA.points[0]).toMatchObject({ sets: 2, volume: 1000 + 880, repsAtTop: 8 })

    const atB = exerciseStats(data, e.id, { location: b.id, includeWarmups: true, unit: 'kg' })
    expect(atB.points).toHaveLength(1)
    expect(atB.records.heaviest?.weight).toBe(200)

    const all = exerciseStats(data, e.id, { location: 'all', includeWarmups: true, unit: 'kg' })
    expect(all.points).toHaveLength(3)

    expect(exerciseLocations(data, e.id).map((l) => [l.name, l.sets])).toEqual([
      ['Gym B', 1],
      ['Gym A', 3],
    ])
    expect(exerciseStats(data, e.id, { location: 'none', includeWarmups: true, unit: 'kg' }).points).toHaveLength(0)
  })

  it('shows weights in the requested unit', async () => {
    const e = (await createCustomExercise({ name: 'Curl' })).exercise
    await workout({ startedAt: '2026-09-01T18:00:00.000+02:00', location: null, exerciseId: e.id, sets: [[20, 10]] })
    const lb = exerciseStats(await loadStatsData(), e.id, { location: 'all', includeWarmups: true, unit: 'lb' })
    expect(lb.points[0].topWeight).toBeCloseTo(44.09, 1)
  })
})
