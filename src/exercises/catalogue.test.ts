import { describe, expect, it } from 'vitest'
import { exerciseStats, loadStatsData } from '../analytics/analytics'
import { db } from '../data/db'
import { createDayType, updateDayType } from '../daytypes/dayTypeService'
import { createRoutine } from '../routines/routineService'
import { completeSet, finishWorkout, loadSessionView, startWorkout } from '../workout/workoutService'
import {
  archiveExercise,
  createCustomExercise,
  exerciseUsage,
  mergeExercises,
  previewMerge,
  unarchiveExercise,
  updateExercise,
} from './exerciseService'

const ex = async (name: string, extra: { aliases?: string[] } = {}) =>
  (await createCustomExercise({ name, ...extra })).exercise

async function trained(exerciseId: string, startedAt: string) {
  const s = await startWorkout({ startedAt, exerciseIds: [exerciseId] })
  const first = (await loadSessionView(s.id))!.exercises[0].sets[0]
  await completeSet(first.id, { weightValue: 40, reps: 10 })
  await finishWorkout({ sessionId: s.id })
  return s.id
}

describe('editing exercises', () => {
  it('renames, normalises aliases and keeps history labelled with the old name snapshot', async () => {
    const a = await ex('Leg Pres')
    const session = await trained(a.id, '2026-09-01T18:00:00.000+02:00')
    await updateExercise(a.id, {
      name: 'Leg Press',
      aliases: ['Beinpresse', ' beinpresse ', 'leg press', '', 'Sled Press'],
    })
    const updated = (await db.exercises.get(a.id))!
    expect(updated).toMatchObject({ name: 'Leg Press', nameKey: 'leg press' })
    expect(updated.aliases).toEqual(['Beinpresse', 'Sled Press']) // duplicates, empty and the name itself dropped
    expect((await loadSessionView(session))!.exercises[0].we.performedNameSnapshot).toBe('Leg Pres')
  })

  it('refuses names or aliases that clash with another active exercise', async () => {
    await ex('Leg Press', { aliases: ['Beinpresse'] })
    const b = await ex('Hack Squat')
    await expect(updateExercise(b.id, { name: 'leg press' })).rejects.toThrow(/already exists/)
    await expect(updateExercise(b.id, { name: 'Beinpresse' })).rejects.toThrow(/already exists/)
    await expect(updateExercise(b.id, { name: '   ' })).rejects.toThrow(/required/)
    await expect(updateExercise(b.id, { name: 'Hack Squat', equipmentType: 'machine' })).resolves.toBeUndefined()
  })

  it('stores a per-exercise rest and validates it', async () => {
    const a = await ex('A')
    await updateExercise(a.id, { defaultRestSeconds: 150 })
    expect((await db.exercises.get(a.id))!.defaultRestSeconds).toBe(150)
    await expect(updateExercise(a.id, { defaultRestSeconds: 2 })).rejects.toThrow(/Rest/)
    await expect(updateExercise(a.id, { defaultRestSeconds: 99999 })).rejects.toThrow(/Rest/)
    await updateExercise(a.id, { defaultRestSeconds: null })
    expect((await db.exercises.get(a.id))!.defaultRestSeconds).toBeNull()
    await updateExercise(a.id, { name: 'A2' }) // unrelated edit leaves the rest alone
    expect((await db.exercises.get(a.id))!.defaultRestSeconds).toBeNull()
  })

  it('archives and restores, but not into a name clash', async () => {
    const a = await ex('A')
    await archiveExercise(a.id)
    const dup = await ex('A') // allowed: the archived one no longer counts as a duplicate
    expect(dup.id).not.toBe(a.id)
    await expect(unarchiveExercise(a.id)).rejects.toThrow(/exists already/)
  })

  it('counts usage per exercise', async () => {
    const a = await ex('A')
    const b = await ex('B')
    await trained(a.id, '2026-09-01T18:00:00.000+02:00')
    await trained(a.id, '2026-09-02T18:00:00.000+02:00')
    await createRoutine({
      name: 'R',
      exercises: [{ exerciseId: a.id, suggestedSets: 3, targetRepMin: 8, targetRepMax: 12 }],
    })
    const usage = await exerciseUsage()
    expect(usage.get(a.id)).toEqual({ workouts: 2, sets: 2, presets: 1 })
    expect(usage.get(b.id)).toBeUndefined()
  })
})

describe('merging duplicates', () => {
  it('re-points workouts, presets and training days, keeps names as aliases and archives the duplicate', async () => {
    const keep = await ex('Leg Press')
    const dup = await ex('Beinpresse machine')
    const s1 = await trained(keep.id, '2026-09-01T18:00:00.000+02:00')
    const s2 = await trained(dup.id, '2026-09-08T18:00:00.000+02:00')
    const routine = await createRoutine({
      name: 'Leg',
      exercises: [{ exerciseId: dup.id, suggestedSets: 3, targetRepMin: 8, targetRepMax: 12 }],
    })
    const day = await createDayType({ name: 'Legs' })
    await updateDayType(day.id, { exerciseIds: [dup.id, keep.id] })

    expect(await previewMerge(dup.id)).toEqual({ instances: 1, sets: 1, presets: 1, days: 1 })
    const impact = await mergeExercises(dup.id, keep.id)
    expect(impact).toEqual({ instances: 1, sets: 1, presets: 1, days: 1 })

    const v2 = (await loadSessionView(s2))!.exercises[0]
    expect(v2.we).toMatchObject({ performedExerciseId: keep.id, performedNameSnapshot: 'Leg Press' })
    expect((await db.routineExercises.where('routineId').equals(routine.id).toArray())[0].exerciseId).toBe(keep.id)
    expect((await db.dayTypes.get(day.id))!.exerciseIds).toEqual([keep.id]) // de-duplicated

    const target = (await db.exercises.get(keep.id))!
    expect(target.aliases).toContain('Beinpresse machine')
    expect((await db.exercises.get(dup.id))!.archivedAt).not.toBeNull()

    // One continuous series in the statistics now.
    const stats = exerciseStats(await loadStatsData(), keep.id, { location: 'all', includeWarmups: true, unit: 'kg' })
    expect(stats.points.map((p) => p.sessionId)).toEqual([s1, s2])
  })

  it('rejects merging into itself or into an archived exercise', async () => {
    const a = await ex('A')
    const b = await ex('B')
    await expect(mergeExercises(a.id, a.id)).rejects.toThrow(/different/)
    await archiveExercise(b.id)
    await expect(mergeExercises(a.id, b.id)).rejects.toThrow(/archived/)
  })

  it('is all-or-nothing: a failed merge changes nothing', async () => {
    const a = await ex('A')
    const s = await trained(a.id, '2026-09-01T18:00:00.000+02:00')
    await expect(mergeExercises(a.id, 'missing-id')).rejects.toThrow(/not found/)
    expect((await db.exercises.get(a.id))!.archivedAt).toBeNull()
    expect((await loadSessionView(s))!.exercises[0].we.performedExerciseId).toBe(a.id)
  })
})

describe('existing duplicates', () => {
  it('stay editable (only a changed name is checked); merge resolves them', async () => {
    const a = await ex('Leg Press')
    await db.exercises.add({ ...a, id: 'imported-dup' }) // e.g. arrived through an import
    await expect(updateExercise('imported-dup', { defaultRestSeconds: 120 })).resolves.toBeUndefined()
    await expect(
      updateExercise('imported-dup', { name: 'Leg Press', equipmentType: 'machine' }),
    ).resolves.toBeUndefined()
    await mergeExercises('imported-dup', a.id)
    expect((await db.exercises.get('imported-dup'))!.archivedAt).not.toBeNull()
  })
})
