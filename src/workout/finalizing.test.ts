import { describe, expect, it } from 'vitest'
import { estimateOneRepMax, exerciseStats, loadStatsData, weeklyOverview } from '../analytics/analytics'
import { db } from '../data/db'
import { createCustomExercise, searchExercises, setFavorite } from '../exercises/exerciseService'
import {
  addExercise,
  completeSet,
  finishWorkout,
  linkSuperset,
  loadSessionView,
  removeExercise,
  restoreExercise,
  startWorkout,
} from './workoutService'

describe('undo for removing an exercise', () => {
  it('puts the exercise back at its old position with its sets and superset', async () => {
    const [a, b, c] = await Promise.all(
      ['A', 'B', 'C'].map(async (n) => (await createCustomExercise({ name: n })).exercise),
    )
    const s = await startWorkout({ exerciseIds: [a.id, b.id, c.id] })
    const first = (await loadSessionView(s.id))!.exercises
    await linkSuperset(first[1].we.id) // B + C superset

    const removed = await removeExercise(first[1].we.id)
    expect(removed?.sets.length).toBeGreaterThan(0)
    expect((await loadSessionView(s.id))!.exercises.map((e) => e.we.performedNameSnapshot)).toEqual(['A', 'C'])

    await restoreExercise(removed!)
    const after = (await loadSessionView(s.id))!.exercises
    expect(after.map((e) => e.we.performedNameSnapshot)).toEqual(['A', 'B', 'C'])
    expect(after[1].sets.length).toBe(first[1].sets.length)
    expect(after[1].we.supersetGroupId).toBeTruthy()
    expect(after[1].we.supersetGroupId).toBe(after[2].we.supersetGroupId)
    expect(after.map((e) => e.we.position)).toEqual([0, 1, 2])
  })

  it('works when it was the last exercise', async () => {
    const a = (await createCustomExercise({ name: 'A' })).exercise
    const b = (await createCustomExercise({ name: 'B' })).exercise
    const s = await startWorkout({ exerciseIds: [a.id] })
    const we = await addExercise({ sessionId: s.id, exerciseId: b.id })
    const removed = await removeExercise(we.id)
    await restoreExercise(removed!)
    expect((await loadSessionView(s.id))!.exercises.map((e) => e.we.performedNameSnapshot)).toEqual(['A', 'B'])
  })
})

describe('favorites', () => {
  it('toggle on and off without losing other data', async () => {
    const e = (await createCustomExercise({ name: 'Fav', aliases: ['x'] })).exercise
    await setFavorite(e.id, true)
    expect((await db.exercises.get(e.id))!.favorite).toBe(true)
    await setFavorite(e.id, false)
    const after = (await db.exercises.get(e.id))!
    expect(after.favorite).toBeUndefined()
    expect(after.aliases).toEqual(['x'])
    expect(searchExercises([after], 'fav')).toHaveLength(1)
  })
})

describe('estimated 1RM', () => {
  it('uses Epley for loaded sets of 1–12 reps and nothing else', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100)
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 1)
    expect(estimateOneRepMax(100, 13)).toBeNull()
    expect(estimateOneRepMax(null, 5)).toBeNull()
    expect(estimateOneRepMax(0, 5)).toBeNull()
    expect(estimateOneRepMax(100, null)).toBeNull()
  })

  it('shows up as the best value per session', async () => {
    const a = (await createCustomExercise({ name: 'A' })).exercise
    const s = await startWorkout({ startedAt: '2026-10-05T18:00:00.000+02:00', exerciseIds: [a.id] })
    const sets = (await loadSessionView(s.id))!.exercises[0].sets
    await completeSet(sets[0].id, { weightValue: 100, reps: 5 })
    await completeSet((await loadSessionView(s.id))!.exercises[0].sets[1].id, { weightValue: 90, reps: 10 })
    await finishWorkout({ sessionId: s.id })
    const stats = exerciseStats(await loadStatsData(), a.id, { location: 'all', includeWarmups: true, unit: 'kg' })
    expect(stats.points[0].e1rm).toBeCloseTo(120, 0) // 90 × 10 → 120 beats 100 × 5 → 116.7
  })
})

describe('weekly overview', () => {
  it('counts workouts and sets per muscle per week, including empty weeks', async () => {
    const chest = (await createCustomExercise({ name: 'Press', muscleTags: ['chest', 'triceps'] })).exercise
    const log = async (at: string) => {
      const s = await startWorkout({ startedAt: at, exerciseIds: [chest.id] })
      await completeSet((await loadSessionView(s.id))!.exercises[0].sets[0].id, { weightValue: 50, reps: 8 })
      await finishWorkout({ sessionId: s.id, endedAt: at })
    }
    await log('2026-10-05T18:00:00.000+02:00') // Mon, week of 10-05
    await log('2026-10-07T18:00:00.000+02:00') // same week
    await log('2026-09-23T18:00:00.000+02:00') // week of 09-21
    const rows = weeklyOverview(await loadStatsData(), () => ['chest', 'triceps'], {
      weeks: 4,
      includeWarmups: true,
      today: '2026-10-08',
    })
    expect(rows.map((r) => r.week)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05'])
    expect(rows.map((r) => r.workouts)).toEqual([0, 1, 0, 2])
    expect(rows[3].muscleSets.get('chest')).toBe(2)
    expect(rows[1].muscleSets.get('triceps')).toBe(1)
  })
})
