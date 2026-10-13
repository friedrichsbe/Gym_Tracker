import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { updateSettings } from '../data/settings'
import { seedStarterExercises, createCustomExercise } from '../exercises/exerciseService'
import {
  createRoutine,
  createRoutineFromSession,
  duplicateRoutine,
  getRoutineExercises,
  saveRoutine,
} from '../routines/routineService'
import {
  addExercise,
  completeSet,
  deleteSession,
  finishWorkout,
  loadSessionView,
  startWorkout,
  substituteExercise,
  summarizeSession,
  updateSet,
} from '../workout/workoutService'
import { addExerciseToDayType, createDayType, ensureDefaultDayTypes, fitsDay, updateDayType } from './dayTypeService'

async function setup() {
  await ensureDefaultDayTypes()
  await seedStarterExercises()
  const days = await db.dayTypes.toArray()
  const byName = (n: string) => days.find((d) => d.name === n)!
  const ex = async (name: string) => (await db.exercises.toArray()).find((e) => e.name === name)!
  return { leg: byName('Leg'), upper: byName('Upper'), mix: byName('Mix'), ex }
}

describe('day types', () => {
  it('seeds Leg/Upper/Mix once and does not resurrect deleted ones', async () => {
    await ensureDefaultDayTypes()
    expect((await db.dayTypes.toArray()).map((d) => d.name).sort()).toEqual(['Leg', 'Mix', 'Upper'])
    await db.dayTypes.clear()
    await ensureDefaultDayTypes()
    expect(await db.dayTypes.count()).toBe(0)
  })

  it('decides which exercises fit a day', async () => {
    const { leg, upper, mix, ex } = await setup()
    const press = await ex('Leg Press')
    const bench = await ex('Barbell Bench Press')
    expect(fitsDay(press, leg)).toBe(true)
    expect(fitsDay(bench, leg)).toBe(false)
    expect(fitsDay(bench, upper)).toBe(true)
    expect(fitsDay(bench, mix)).toBe(true)
    expect(fitsDay(bench, null)).toBe(true) // free workout
    expect(fitsDay(bench, leg, new Set([bench.id]))).toBe(true) // part of the routine
    await addExerciseToDayType(leg.id, bench.id)
    expect(fitsDay(bench, (await db.dayTypes.get(leg.id))!)).toBe(true)
  })

  it('supports user-defined days with their own muscle mapping', async () => {
    const { ex } = await setup()
    const push = await createDayType({ name: 'Push', muscleTags: ['chest', 'shoulders', 'triceps'] })
    await expect(createDayType({ name: 'push' })).rejects.toThrow(/already exists/)
    expect(fitsDay(await ex('Pec Deck'), push)).toBe(true)
    expect(fitsDay(await ex('Lat Pulldown'), push)).toBe(false)
    await updateDayType(push.id, { muscleTags: ['lats'] })
    expect(fitsDay(await ex('Lat Pulldown'), (await db.dayTypes.get(push.id))!)).toBe(true)
  })
})

describe('starting with a day type', () => {
  it('starts with picked exercises and flags outside exercises added later', async () => {
    const { leg, ex } = await setup()
    const press = await ex('Leg Press')
    const curl = await ex('Leg Extension')
    const chest = await ex('Chest Press Machine')

    const s = await startWorkout({ dayTypeId: leg.id, exerciseIds: [press.id, curl.id] })
    expect(s).toMatchObject({ dayTypeId: leg.id, dayTypeNameSnapshot: 'Leg', focus: 'Leg' })
    let view = (await loadSessionView(s.id))!.exercises
    expect(view.map((v) => v.we.performedNameSnapshot)).toEqual(['Leg Press', 'Leg Extension'])
    expect(view.every((v) => !v.we.isForeign)).toBe(true)
    expect(view[0].sets).toHaveLength(3)

    await addExercise({ sessionId: s.id, exerciseId: chest.id })
    view = (await loadSessionView(s.id))!.exercises
    expect(view[2].we).toMatchObject({ performedNameSnapshot: 'Chest Press Machine', isForeign: true })
  })

  it('does not flag anything in a Mix or free workout', async () => {
    const { mix, ex } = await setup()
    const chest = await ex('Chest Press Machine')
    for (const dayTypeId of [mix.id, null]) {
      const s = await startWorkout({ dayTypeId })
      await addExercise({ sessionId: s.id, exerciseId: chest.id })
      expect((await loadSessionView(s.id))!.exercises[0].we.isForeign).toBe(false)
      await finishWorkout({ sessionId: s.id })
    }
  })

  it('re-evaluates the flag when substituting with an outside exercise', async () => {
    const { leg, ex } = await setup()
    const s = await startWorkout({ dayTypeId: leg.id, exerciseIds: [(await ex('Leg Press')).id] })
    const we = (await loadSessionView(s.id))!.exercises[0].we
    await substituteExercise({ workoutExerciseId: we.id, performedExerciseId: (await ex('Pec Deck')).id })
    expect((await loadSessionView(s.id))!.exercises[0].we.isForeign).toBe(true)
  })

  it("routine exercises count as inside even if they don't match the day, and the routine's day is inherited", async () => {
    const { leg, ex } = await setup()
    const bench = await ex('Barbell Bench Press')
    const routine = await createRoutine({
      name: 'Leg + bench',
      dayTypeId: leg.id,
      exercises: [{ exerciseId: bench.id, suggestedSets: 2, targetRepMin: 5, targetRepMax: 8 }],
    })
    const s = await startWorkout({ routineId: routine.id })
    expect(s.dayTypeId).toBe(leg.id)
    const view = (await loadSessionView(s.id))!.exercises
    expect(view[0].we.isForeign).toBe(false)
    expect(view[0].sets).toHaveLength(2)

    await addExercise({ sessionId: s.id, exerciseId: bench.id }) // same exercise again: still inside
    expect((await loadSessionView(s.id))!.exercises[1].we.isForeign).toBe(false)
  })
})

describe('warm-ups in statistics', () => {
  it('stores warm-ups always and counts them in volume unless the setting is off', async () => {
    const { ex } = await setup()
    const s = await startWorkout({ exerciseIds: [(await ex('Leg Press')).id] })
    const sets = (await loadSessionView(s.id))!.exercises[0].sets
    await updateSet(sets[0].id, { setType: 'warmup' })
    await completeSet(sets[0].id, { weightValue: 40, reps: 10 })
    await completeSet(sets[1].id, { weightValue: 100, reps: 5 })

    expect((await summarizeSession(s.id)).volume).toEqual({ kg: 900 })
    await updateSettings({ includeWarmupsInStats: false })
    const without = await summarizeSession(s.id)
    expect(without.volume).toEqual({ kg: 500 })
    expect(without.completedSets).toBe(2) // still tracked
  })
})

describe('routines', () => {
  it('saves a finished workout as a routine from what was actually performed', async () => {
    const { leg, ex } = await setup()
    const press = await ex('Leg Press')
    const ext = await ex('Leg Extension')
    const s = await startWorkout({ dayTypeId: leg.id, exerciseIds: [press.id, ext.id] })
    const view = (await loadSessionView(s.id))!.exercises
    await updateSet(view[0].sets[0].id, { setType: 'warmup' })
    await completeSet(view[0].sets[0].id, { weightValue: 40, reps: 12 })
    await completeSet(view[0].sets[1].id, { weightValue: 100, reps: 8 })
    await completeSet((await loadSessionView(s.id))!.exercises[0].sets[2].id, { weightValue: 100, reps: 6 })
    await finishWorkout({ sessionId: s.id }) // Leg Extension untouched -> not part of the routine

    const routine = await createRoutineFromSession(s.id, { name: 'My leg day', dayTypeId: leg.id })
    expect(routine.dayTypeId).toBe(leg.id)
    const items = await getRoutineExercises(routine.id)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ exerciseId: press.id, suggestedSets: 2, targetRepMin: 6, targetRepMax: 8 }) // warm-up excluded
  })

  it('refuses to save an empty workout, validates and duplicates', async () => {
    const { leg, ex } = await setup()
    const s = await startWorkout({ dayTypeId: leg.id })
    await expect(createRoutineFromSession(s.id, { name: 'x', dayTypeId: null })).rejects.toThrow(/no completed sets/)

    const press = await ex('Leg Press')
    const r = await createRoutine({
      name: 'A',
      exercises: [{ exerciseId: press.id, suggestedSets: 3, targetRepMin: 8, targetRepMax: 12 }],
    })
    await expect(
      saveRoutine(r.id, {
        name: 'A',
        dayTypeId: null,
        exercises: [{ exerciseId: press.id, suggestedSets: 0, targetRepMin: null, targetRepMax: null }],
      }),
    ).rejects.toThrow()
    await expect(
      saveRoutine(r.id, {
        name: 'A',
        dayTypeId: null,
        exercises: [{ exerciseId: press.id, suggestedSets: 3, targetRepMin: 12, targetRepMax: 8 }],
      }),
    ).rejects.toThrow(/Min reps/)

    const copy = await duplicateRoutine(r.id)
    expect(copy.name).toBe('A (copy)')
    expect(await getRoutineExercises(copy.id)).toHaveLength(1)
  })

  it('custom exercises can be assigned to a day', async () => {
    const { leg } = await setup()
    const { exercise } = await createCustomExercise({ name: 'Sled Push' })
    expect(fitsDay(exercise, leg)).toBe(false)
    await addExerciseToDayType(leg.id, exercise.id)
    expect(fitsDay(exercise, (await db.dayTypes.get(leg.id))!)).toBe(true)
  })
})

describe('deleting a workout', () => {
  it('removes the session with its exercises and sets', async () => {
    const { ex } = await setup()
    const s = await startWorkout({ exerciseIds: [(await ex('Leg Press')).id] })
    await finishWorkout({ sessionId: s.id })
    await deleteSession(s.id)
    expect(await db.sessions.count()).toBe(0)
    expect(await db.workoutExercises.count()).toBe(0)
    expect(await db.sets.count()).toBe(0)
  })
})
