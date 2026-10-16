import { describe, expect, it } from 'vitest'
import { completeSet, finishWorkout, loadSessionView, skipExercise, startWorkout } from '../workout/workoutService'
import { createCustomExercise, exerciseHabits } from './exerciseService'

const ex = async (name: string) => (await createCustomExercise({ name })).exercise

async function workout(startedAt: string, exerciseIds: string[]) {
  const s = await startWorkout({ startedAt, exerciseIds })
  // Exercises without a completed set are saved as skipped, so log one set each.
  for (const e of (await loadSessionView(s.id))!.exercises)
    await completeSet(e.sets[0].id, { weightValue: 40, reps: 8 })
  await finishWorkout({ sessionId: s.id })
  return s
}

describe('recently used exercises', () => {
  it('counts workouts per exercise inside the window and remembers the latest one', async () => {
    const now = Date.parse('2026-10-16T12:00:00.000+02:00')
    const press = await ex('Press')
    const row = await ex('Row')
    const old = await ex('Old Curl')
    await workout('2026-10-01T18:00:00.000+02:00', [press.id, row.id])
    await workout('2026-10-14T18:00:00.000+02:00', [press.id])
    await workout('2026-06-01T18:00:00.000+02:00', [old.id]) // outside 60 days

    const habits = await exerciseHabits(60, now)
    expect(habits.get(press.id)).toEqual({ count: 2, lastAt: Date.parse('2026-10-14T18:00:00.000+02:00') })
    expect(habits.get(row.id)?.count).toBe(1)
    expect(habits.has(old.id)).toBe(false)
  })

  it('ignores skipped exercises', async () => {
    const now = Date.parse('2026-10-16T12:00:00.000+02:00')
    const a = await ex('Press')
    const s = await startWorkout({ startedAt: '2026-10-15T18:00:00.000+02:00', exerciseIds: [a.id] })
    await skipExercise((await loadSessionView(s.id))!.exercises[0].we.id, true)
    await finishWorkout({ sessionId: s.id })
    expect((await exerciseHabits(60, now)).has(a.id)).toBe(false)
  })
})
