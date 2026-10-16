import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { createDayType, setExerciseDays } from '../daytypes/dayTypeService'
import { createRoutine, getRoutineExercises } from '../routines/routineService'
import { completeSet, finishWorkout, loadSessionView, startWorkout } from '../workout/workoutService'
import { archiveExercise, createCustomExercise, deleteExercisePermanently, previewDelete } from './exerciseService'

const ex = async (name: string) => (await createCustomExercise({ name })).exercise

describe('deleting an archived exercise for good', () => {
  it('refuses while the exercise is still active', async () => {
    const a = await ex('Oops Press')
    await expect(deleteExercisePermanently(a.id)).rejects.toThrow(/archive/i)
    expect(await db.exercises.get(a.id)).toBeDefined()
  })

  it('removes a never-trained exercise from presets and days, dissolving a superset left with one member', async () => {
    const a = await ex('Oops Press')
    const b = await ex('Row')
    const day = await createDayType({ name: 'Pull' })
    await setExerciseDays(a.id, [day.id])
    const r = await createRoutine({
      name: 'Pull A',
      exercises: [
        { exerciseId: a.id, suggestedSets: 3, targetRepMin: 8, targetRepMax: 12, supersetGroup: 'g1' },
        { exerciseId: b.id, suggestedSets: 3, targetRepMin: 8, targetRepMax: 12, supersetGroup: 'g1' },
      ],
    })
    await archiveExercise(a.id)

    expect(await previewDelete(a.id)).toEqual({ workouts: 0, sets: 0, plannedOnly: 0, presets: 1, days: 1 })
    await deleteExercisePermanently(a.id)

    expect(await db.exercises.get(a.id)).toBeUndefined()
    const items = await getRoutineExercises(r.id)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ exerciseId: b.id, supersetGroup: null })
    expect((await db.routineExercises.where('routineId').equals(r.id).first())?.position).toBe(0)
    expect((await db.dayTypes.get(day.id))!.exerciseIds).not.toContain(a.id)
  })

  it('removes a trained exercise with its sets but leaves the rest of the workout alone', async () => {
    const a = await ex('Oops Press')
    const b = await ex('Squat')
    const s = await startWorkout({ startedAt: '2026-09-01T18:00:00.000+02:00', exerciseIds: [a.id, b.id] })
    const view = (await loadSessionView(s.id))!
    for (const e of view.exercises) await completeSet(e.sets[0].id, { weightValue: 50, reps: 5 })
    await finishWorkout({ sessionId: s.id })
    await archiveExercise(a.id)

    const impact = await previewDelete(a.id)
    expect(impact).toMatchObject({ workouts: 1, presets: 0 })
    expect(impact.sets).toBeGreaterThanOrEqual(1)

    await deleteExercisePermanently(a.id)
    const after = (await loadSessionView(s.id))!
    expect(after.exercises.map((e) => e.we.performedExerciseId)).toEqual([b.id])
    expect(after.exercises[0].sets.some((st) => st.isCompleted)).toBe(true)
    expect(await db.sets.where('sessionId').equals(s.id).count()).toBe(after.exercises[0].sets.length)
  })
})
