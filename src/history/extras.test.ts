import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { createCustomExercise } from '../exercises/exerciseService'
import { buildExport, onlySession } from '../portability/exportData'
import { applyImport, parseImportText, planImport } from '../portability/importData'
import {
  createRoutineFromSession,
  getRoutineExercises,
  saveRoutine,
  updateRoutineFromSession,
} from '../routines/routineService'
import { effortLabel } from '../workout/effort'
import { completeSet, finishWorkout, loadSessionView, startWorkout, updateSet } from '../workout/workoutService'

async function done(at: string, ids: string[], sets = 3) {
  const s = await startWorkout({ startedAt: at, exerciseIds: ids })
  for (const e of (await loadSessionView(s.id))!.exercises) {
    for (let i = 0; i < sets; i++) {
      const cur = (await loadSessionView(s.id))!.exercises.find((x) => x.we.id === e.we.id)!.sets[i]
      await completeSet(cur.id, { weightValue: 40 + i, reps: 10 - i })
    }
  }
  await finishWorkout({ sessionId: s.id, endedAt: at })
  return s.id
}

describe('single workout export', () => {
  it('contains only that workout and what it refers to, and imports again', async () => {
    const a = (await createCustomExercise({ name: 'A' })).exercise
    const b = (await createCustomExercise({ name: 'B' })).exercise
    const one = await done('2026-09-01T18:00:00.000+02:00', [a.id])
    await done('2026-09-02T18:00:00.000+02:00', [b.id])

    const part = onlySession(await buildExport(), one)
    expect(part.sessions.map((s) => s.id)).toEqual([one])
    expect(part.exercises.map((e) => e.name)).toEqual(['A'])
    expect(part.routines).toEqual([])

    const parsed = parseImportText(JSON.stringify(part))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await db.sets.where('sessionId').equals(one).delete()
    await db.workoutExercises.where('sessionId').equals(one).delete()
    await db.sessions.delete(one)
    await applyImport(await planImport(parsed.file, 'merge'))
    expect((await db.sessions.get(one))?.status).toBe('completed')
    expect(await db.sets.where('sessionId').equals(one).count()).toBe(3)
  })
})

describe('updating a preset from a workout', () => {
  it('replaces the exercises with what was done, keeps name, day and notes, and can be undone', async () => {
    const a = (await createCustomExercise({ name: 'A' })).exercise
    const b = (await createCustomExercise({ name: 'B' })).exercise
    const c = (await createCustomExercise({ name: 'C' })).exercise
    const first = await done('2026-09-01T18:00:00.000+02:00', [a.id, b.id], 3)
    const routine = await createRoutineFromSession(first, { name: 'My preset', dayTypeId: null })
    await saveRoutine(routine.id, {
      name: 'My preset',
      dayTypeId: null,
      notes: 'keep me',
      exercises: (await getRoutineExercises(routine.id)).map((r) => ({
        ...r,
        notes: r.exerciseId === a.id ? 'tempo 3-1-1' : undefined,
      })),
    })

    const second = await done('2026-09-08T18:00:00.000+02:00', [a.id, c.id], 4)
    const previous = await updateRoutineFromSession(second, routine.id)

    const now = await getRoutineExercises(routine.id)
    expect(now.map((r) => r.exerciseId)).toEqual([a.id, c.id])
    expect(now.map((r) => r.suggestedSets)).toEqual([4, 4])
    expect(now[0].notes).toBe('tempo 3-1-1')
    const r = (await db.routines.get(routine.id))!
    expect(r).toMatchObject({ name: 'My preset', notes: 'keep me' })

    await saveRoutine(routine.id, { name: r.name, dayTypeId: r.dayTypeId, notes: r.notes, exercises: previous })
    expect((await getRoutineExercises(routine.id)).map((x) => x.exerciseId)).toEqual([a.id, b.id])
  })
})

describe('RPE, RIR and set notes', () => {
  it('are stored on the set, can be cleared, and are validated', async () => {
    const a = (await createCustomExercise({ name: 'A' })).exercise
    const s = await startWorkout({ exerciseIds: [a.id] })
    const set = (await loadSessionView(s.id))!.exercises[0].sets[0]
    await updateSet(set.id, { rpe: 8, rir: 2, notes: 'felt heavy' })
    let stored = (await db.sets.get(set.id))!
    expect(effortLabel(stored)).toBe('RPE 8 · RIR 2 · 📝')
    await updateSet(set.id, { rpe: null, notes: undefined })
    stored = (await db.sets.get(set.id))!
    expect(stored.rpe).toBeNull()
    expect(effortLabel(stored)).toBe('RIR 2')
    await expect(updateSet(set.id, { rpe: 11 })).rejects.toThrow()
    await expect(updateSet(set.id, { rir: -1 })).rejects.toThrow()
  })
})
