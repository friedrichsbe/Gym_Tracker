import { describe, expect, it } from 'vitest'
import { dailyActivity, loadStatsData } from '../analytics/analytics'
import { db } from '../data/db'
import { instant } from '../domain/time'
import { ensureDefaultDayTypes } from '../daytypes/dayTypeService'
import { createCustomExercise, seedStarterExercises } from '../exercises/exerciseService'
import { createLocation } from '../locations/locationService'
import {
  addExercise,
  completeSet,
  deleteSet,
  finishWorkout,
  loadSessionView,
  restoreSet,
  startWorkout,
  updateSet,
} from '../workout/workoutService'
import {
  addPastExercise,
  addPastSet,
  changePerformedExercise,
  createPastWorkout,
  removePastExercise,
  updateSessionDetails,
} from './sessionEditService'

async function finishedWorkout(opts: {
  startedAt: string
  locationId?: string | null
  dayTypeId?: string | null
  exerciseIds?: string[]
}) {
  const s = await startWorkout({
    startedAt: opts.startedAt,
    locationId: opts.locationId,
    dayTypeId: opts.dayTypeId,
    exerciseIds: opts.exerciseIds,
  })
  for (const ex of (await loadSessionView(s.id))!.exercises) {
    await completeSet(ex.sets[0].id, { weightValue: 50, reps: 10 })
  }
  await finishWorkout({ sessionId: s.id, endedAt: opts.startedAt.replace('T18:00', 'T19:00') })
  return s.id
}

const ex = async (name: string) => (await createCustomExercise({ name })).exercise
const view = async (id: string) => (await loadSessionView(id))!

describe('correcting finished workouts', () => {
  it('moving the start shifts end time and every set timestamp together', async () => {
    const a = await ex('A')
    const id = await finishedWorkout({ startedAt: '2026-09-01T18:00:00.000+02:00', exerciseIds: [a.id] })
    const before = await view(id)
    const setBefore = before.exercises[0].sets[0]

    await updateSessionDetails(id, { startedAt: '2026-08-30T17:30:00.000+02:00' })
    const after = await view(id)
    const delta = instant(after.session.startedAt) - instant(before.session.startedAt)
    expect(delta).toBe(-(2 * 24 * 60 + 30) * 60_000)
    expect(instant(after.session.endedAt!) - instant(before.session.endedAt!)).toBe(delta)
    expect(instant(after.exercises[0].sets[0].performedAt!) - instant(setBefore.performedAt!)).toBe(delta)

    // The workout now counts on the new day in the calendar.
    const days = dailyActivity(await loadStatsData(), { includeWarmups: true })
    expect([...days.keys()]).toEqual(['2026-08-30'])
  })

  it('changes duration, location (all sets) and day (re-checks outside-day marks)', async () => {
    await ensureDefaultDayTypes()
    await seedStarterExercises()
    const bench = (await db.exercises.toArray()).find((e) => e.name === 'Barbell Bench Press')!
    const leg = (await db.dayTypes.toArray()).find((d) => d.name === 'Leg')!
    const upper = (await db.dayTypes.toArray()).find((d) => d.name === 'Upper')!
    const gymA = await createLocation({ name: 'Gym A' })
    const gymB = await createLocation({ name: 'Gym B' })
    const id = await finishedWorkout({
      startedAt: '2026-09-01T18:00:00.000+02:00',
      locationId: gymA.id,
      dayTypeId: leg.id,
      exerciseIds: [bench.id],
    })

    await updateSessionDetails(id, { durationMinutes: 75, locationId: gymB.id })
    let v = await view(id)
    expect(instant(v.session.endedAt!) - instant(v.session.startedAt)).toBe(75 * 60_000)
    expect(v.session.locationNameSnapshot).toBe('Gym B')
    expect(v.exercises[0].sets.every((s) => s.locationId === gymB.id && s.locationNameSnapshot === 'Gym B')).toBe(true)

    await updateSessionDetails(id, { dayTypeId: upper.id })
    v = await view(id)
    expect(v.session.dayTypeNameSnapshot).toBe('Upper')
    expect(v.exercises[0].we.isForeign).toBe(false)
    await updateSessionDetails(id, { dayTypeId: null, durationMinutes: null })
    v = await view(id)
    expect(v.session).toMatchObject({ dayTypeId: null, dayTypeNameSnapshot: null, endedAt: null })
  })

  it('rejects the future, bad durations and running workouts', async () => {
    const a = await ex('A')
    const id = await finishedWorkout({ startedAt: '2026-09-01T18:00:00.000+02:00', exerciseIds: [a.id] })
    await expect(updateSessionDetails(id, { startedAt: '2099-01-01T10:00:00.000+01:00' })).rejects.toThrow(/future/)
    await expect(updateSessionDetails(id, { durationMinutes: 0 })).rejects.toThrow(/Duration/)
    await expect(updateSessionDetails(id, { durationMinutes: 99999 })).rejects.toThrow(/Duration/)

    const running = await startWorkout({})
    await expect(updateSessionDetails(running.id, { durationMinutes: 30 })).rejects.toThrow(/running/)
  })

  it('edits, deletes (with undo) and adds sets of a finished workout', async () => {
    const a = await ex('A')
    const id = await finishedWorkout({ startedAt: '2026-09-01T18:00:00.000+02:00', exerciseIds: [a.id] })
    const first = (await view(id)).exercises[0]

    await updateSet(first.sets[0].id, { setType: 'warmup', reps: 12 })
    const added = await addPastSet(first.we.id)
    expect(added).toMatchObject({ setNumber: 2, isCompleted: true, weightValue: 50 }) // copied from the previous working set
    expect((await view(id)).exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2])

    const removed = await deleteSet(first.sets[0].id)
    expect((await view(id)).exercises[0].sets.map((s) => s.setNumber)).toEqual([1])
    await restoreSet(removed!)
    const sets = (await view(id)).exercises[0].sets
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2])
    expect(sets[0].setType).toBe('warmup')
  })

  it('adds, relabels and removes exercises', async () => {
    const a = await ex('A')
    const b = await ex('B')
    const c = await ex('C')
    const id = await finishedWorkout({ startedAt: '2026-09-01T18:00:00.000+02:00', exerciseIds: [a.id] })

    const added = await addPastExercise(id, b.id)
    let v = await view(id)
    expect(v.exercises.map((e) => e.we.performedNameSnapshot)).toEqual(['A', 'B'])
    expect(v.exercises[1].sets).toHaveLength(1)
    expect(v.exercises[1].sets[0]).toMatchObject({ isCompleted: true, weightValue: null, reps: null }) // nothing invented

    await changePerformedExercise(added.id, c.id)
    v = await view(id)
    expect(v.exercises[1].we).toMatchObject({ performedExerciseId: c.id, performedNameSnapshot: 'C' })

    await removePastExercise(v.exercises[0].we.id)
    v = await view(id)
    expect(v.exercises.map((e) => e.we.performedNameSnapshot)).toEqual(['C'])
    expect(v.exercises[0].we.position).toBe(0)
    expect(await db.sets.where('sessionId').equals(id).count()).toBe(1)
  })
})

describe('logging a workout afterwards', () => {
  it('creates a finished workout on the chosen day that shows up in the statistics once filled in', async () => {
    const a = await ex('A')
    const gym = await createLocation({ name: 'Gym A' })
    const session = await createPastWorkout({
      startedAt: '2026-08-10T18:00:00.000+02:00',
      durationMinutes: 60,
      locationId: gym.id,
    })
    expect(session).toMatchObject({ status: 'completed', locationNameSnapshot: 'Gym A' })
    expect(instant(session.endedAt!) - instant(session.startedAt)).toBe(3_600_000)

    // Empty shell leaves no mark.
    expect(dailyActivity(await loadStatsData(), { includeWarmups: true }).size).toBe(0)

    const we = await addPastExercise(session.id, a.id)
    await updateSet((await view(session.id)).exercises[0].sets[0].id, { weightValue: 80, reps: 8 })
    await addPastSet(we.id)
    const day = dailyActivity(await loadStatsData(), { includeWarmups: true }).get('2026-08-10')!
    expect(day).toMatchObject({ workouts: 1, sets: 2 })
    expect((await view(session.id)).exercises[0].sets[0].locationNameSnapshot).toBe('Gym A')
  })

  it('refuses future workouts and unknown duration values', async () => {
    await expect(createPastWorkout({ startedAt: '2099-01-01T10:00:00.000+01:00' })).rejects.toThrow(/future/)
    await expect(
      createPastWorkout({ startedAt: '2026-08-10T18:00:00.000+02:00', durationMinutes: -5 }),
    ).rejects.toThrow()
    // A past workout may run next to a live one: only one *active* workout is restricted.
    await startWorkout({})
    await expect(createPastWorkout({ startedAt: '2026-08-10T18:00:00.000+02:00' })).resolves.toBeTruthy()
    // ...and the live workout can still add exercises normally.
    const a = await ex('A')
    const running = await db.sessions.where('status').equals('active').first()
    await expect(addExercise({ sessionId: running!.id, exerciseId: a.id })).resolves.toBeTruthy()
  })
})
