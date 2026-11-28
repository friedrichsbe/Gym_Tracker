import { describe, expect, it } from 'vitest'
import { createCustomExercise } from '../exercises/exerciseService'
import { completeSet, finishWorkout, loadSessionView, startWorkout } from '../workout/workoutService'
import { buildWidgetPayload } from './widgetPayload'

describe('widget payload (last completed workout)', () => {
  it('is null without a completed workout (empty state), also while one is running', async () => {
    expect(await buildWidgetPayload()).toBeNull()
    const e = (await createCustomExercise({ name: 'Squat' })).exercise
    await startWorkout({ exerciseIds: [e.id] })
    expect(await buildWidgetPayload()).toBeNull()
  })

  it('describes the latest finished workout: sets and volume', async () => {
    const e = (await createCustomExercise({ name: 'Bench' })).exercise
    const s = await startWorkout({ exerciseIds: [e.id] })
    const sets = (await loadSessionView(s.id))!.exercises[0].sets
    await completeSet(sets[0].id, { weightValue: 100, reps: 5, setType: 'working' })
    await finishWorkout({ sessionId: s.id })

    const p = await buildWidgetPayload()
    expect(p).toMatchObject({ v: 1, name: 'Workout', sets: 1, exercises: 1, volume: 500 })
    expect(p!.unit).toBeTruthy()
    expect(p!.endedAt).toBeGreaterThan(Date.now() - 60_000)
    // Survives the JSON hop to the native side unchanged.
    expect(JSON.parse(JSON.stringify(p))).toEqual(p)
  })
})
