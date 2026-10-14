import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { createCustomExercise } from '../exercises/exerciseService'
import { createLocation } from '../locations/locationService'
import { completeSet, finishWorkout, loadSessionView, startWorkout, updateSet } from '../workout/workoutService'
import { inRange, rangeStart } from './analytics'
import { sessionRecords } from './records'

async function workout(opts: {
  at: string
  exerciseId: string
  locationId?: string | null
  sets: { weight: number; reps: number; warmup?: boolean }[]
  finish?: boolean
}) {
  const s = await startWorkout({ startedAt: opts.at, locationId: opts.locationId, exerciseIds: [opts.exerciseId] })
  const [ex] = (await loadSessionView(s.id))!.exercises
  let i = 0
  for (const set of opts.sets) {
    const target = (await loadSessionView(s.id))!.exercises[0].sets[i++]
    if (set.warmup) await updateSet(target.id, { setType: 'warmup' })
    await completeSet(target.id, { weightValue: set.weight, reps: set.reps })
  }
  void ex
  if (opts.finish !== false) await finishWorkout({ sessionId: s.id, endedAt: opts.at })
  return s.id
}

describe('personal records', () => {
  it('reports nothing for the first time an exercise is done', async () => {
    const { exercise } = await createCustomExercise({ name: 'Press' })
    const id = await workout({
      at: '2026-09-01T18:00:00.000+02:00',
      exerciseId: exercise.id,
      sets: [{ weight: 50, reps: 8 }],
    })
    expect(await sessionRecords(id)).toEqual([])
  })

  it('detects a heavier set and a volume record, and ignores equal or worse sets', async () => {
    const { exercise } = await createCustomExercise({ name: 'Press' })
    await workout({ at: '2026-09-01T18:00:00.000+02:00', exerciseId: exercise.id, sets: [{ weight: 50, reps: 8 }] })
    const heavier = await workout({
      at: '2026-09-08T18:00:00.000+02:00',
      exerciseId: exercise.id,
      sets: [{ weight: 52.5, reps: 5 }],
    })
    const r = await sessionRecords(heavier)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ kind: 'weight', weight: 52.5, reps: 5 })

    const volume = await workout({
      at: '2026-09-15T18:00:00.000+02:00',
      exerciseId: exercise.id,
      sets: [{ weight: 52.5, reps: 9 }], // not heavier than 52.5, but 472 > 262
    })
    expect((await sessionRecords(volume)).map((x) => x.kind)).toEqual(['volume'])

    const same = await workout({
      at: '2026-09-22T18:00:00.000+02:00',
      exerciseId: exercise.id,
      sets: [{ weight: 50, reps: 8 }],
    })
    expect(await sessionRecords(same)).toEqual([])
  })

  it('only compares with earlier workouts, so a back-filled old workout is not a record', async () => {
    const { exercise } = await createCustomExercise({ name: 'Press' })
    await workout({ at: '2026-09-10T18:00:00.000+02:00', exerciseId: exercise.id, sets: [{ weight: 80, reps: 5 }] })
    const old = await workout({
      at: '2026-08-01T18:00:00.000+02:00',
      exerciseId: exercise.id,
      sets: [{ weight: 90, reps: 5 }],
    })
    expect(await sessionRecords(old)).toEqual([])
  })

  it('compares per location and never counts warm-ups', async () => {
    const { exercise } = await createCustomExercise({ name: 'Press' })
    const home = await createLocation({ name: 'Home' })
    const gym = await createLocation({ name: 'Gym' })
    await workout({
      at: '2026-09-01T18:00:00.000+02:00',
      exerciseId: exercise.id,
      locationId: home.id,
      sets: [{ weight: 50, reps: 8 }],
    })
    const elsewhere = await workout({
      at: '2026-09-08T18:00:00.000+02:00',
      exerciseId: exercise.id,
      locationId: gym.id,
      sets: [{ weight: 100, reps: 5 }],
    })
    expect(await sessionRecords(elsewhere)).toEqual([]) // nothing earlier at the gym

    const warm = await workout({
      at: '2026-09-15T18:00:00.000+02:00',
      exerciseId: exercise.id,
      locationId: home.id,
      sets: [
        { weight: 70, reps: 5, warmup: true },
        { weight: 50, reps: 8 },
      ],
    })
    expect(await sessionRecords(warm)).toEqual([])
  })

  it('works for a workout that is still running', async () => {
    const { exercise } = await createCustomExercise({ name: 'Press' })
    await workout({ at: '2026-09-01T18:00:00.000+02:00', exerciseId: exercise.id, sets: [{ weight: 50, reps: 8 }] })
    const running = await workout({
      at: '2026-09-08T18:00:00.000+02:00',
      exerciseId: exercise.id,
      sets: [{ weight: 60, reps: 3 }],
      finish: false,
    })
    expect((await sessionRecords(running))[0]).toMatchObject({ kind: 'weight', weight: 60 })
    expect(await db.sessions.get(running)).toMatchObject({ status: 'active' })
  })
})

describe('time range', () => {
  it('starts at the matching calendar day and keeps everything for "all"', () => {
    expect(rangeStart('1m', '2026-10-14')).toBe('2026-09-14')
    expect(rangeStart('3m', '2026-10-14')).toBe('2026-07-14')
    expect(rangeStart('1y', '2026-10-14')).toBe('2025-10-14')
    expect(rangeStart('all', '2026-10-14')).toBeNull()
    const pts = [{ date: '2026-01-01' }, { date: '2026-09-20' }, { date: '2026-10-14' }]
    expect(inRange(pts, '1m', '2026-10-14').map((p) => p.date)).toEqual(['2026-09-20', '2026-10-14'])
    expect(inRange(pts, 'all', '2026-10-14')).toHaveLength(3)
  })
})
