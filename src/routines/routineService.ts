import { db } from '../data/db'
import { instant, newId, nowIso } from '../domain/time'
import type { Routine, RoutineExercise } from '../domain/types'
import { normalizeGroupIds } from '../workout/supersets'

export interface RoutineExerciseInput {
  id?: string
  exerciseId: string
  suggestedSets: number | null
  targetRepMin: number | null
  targetRepMax: number | null
  /** Same key = superset. Non-adjacent or single members are dropped on save. */
  supersetGroup?: string | null
  notes?: string
}

function validate(items: RoutineExerciseInput[]) {
  for (const it of items) {
    if (it.suggestedSets != null && (!Number.isInteger(it.suggestedSets) || it.suggestedSets < 1))
      throw new Error('Sets must be a whole number ≥ 1')
    for (const r of [it.targetRepMin, it.targetRepMax])
      if (r != null && (!Number.isInteger(r) || r < 1)) throw new Error('Reps must be a whole number ≥ 1')
    if (it.targetRepMin != null && it.targetRepMax != null && it.targetRepMin > it.targetRepMax)
      throw new Error('Min reps is above max reps')
  }
}

async function writeExercises(routineId: string, items: RoutineExerciseInput[]) {
  validate(items)
  await db.routineExercises.where('routineId').equals(routineId).delete()
  const groups = normalizeGroupIds(
    items.map((it) => it.supersetGroup),
    () => `g${newId().slice(0, 8)}`,
  )
  const rows: RoutineExercise[] = items.map((it, position) => ({
    supersetGroup: groups[position],
    id: it.id ?? newId(),
    routineId,
    exerciseId: it.exerciseId,
    position,
    suggestedSets: it.suggestedSets,
    targetRepMin: it.targetRepMin,
    targetRepMax: it.targetRepMax,
    notes: it.notes?.trim() || undefined,
  }))
  await db.routineExercises.bulkAdd(rows)
}

export async function createRoutine(input: {
  name: string
  dayTypeId?: string | null
  notes?: string
  exercises?: RoutineExerciseInput[]
}): Promise<Routine> {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  const now = nowIso()
  const routine: Routine = {
    id: newId(),
    name,
    dayTypeId: input.dayTypeId ?? null,
    notes: input.notes?.trim() || undefined,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.transaction('rw', db.routines, db.routineExercises, async () => {
    await db.routines.add(routine)
    await writeExercises(routine.id, input.exercises ?? [])
  })
  return routine
}

/** Saves the routine and replaces its exercise list in one transaction. Running sessions keep their own snapshot. */
export async function saveRoutine(
  id: string,
  input: { name: string; dayTypeId: string | null; notes?: string; exercises: RoutineExerciseInput[] },
): Promise<void> {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  await db.transaction('rw', db.routines, db.routineExercises, async () => {
    await db.routines.update(id, {
      name,
      dayTypeId: input.dayTypeId,
      notes: input.notes?.trim() || undefined,
      updatedAt: nowIso(),
    })
    await writeExercises(id, input.exercises)
  })
}

export async function getRoutineExercises(routineId: string): Promise<RoutineExercise[]> {
  return (await db.routineExercises.where('routineId').equals(routineId).toArray()).sort(
    (a, b) => a.position - b.position,
  )
}

export async function duplicateRoutine(id: string): Promise<Routine> {
  const src = await db.routines.get(id)
  if (!src) throw new Error('Routine not found')
  const items = await getRoutineExercises(id)
  return createRoutine({
    name: `${src.name} (copy)`,
    dayTypeId: src.dayTypeId,
    notes: src.notes,
    exercises: items.map(({ exerciseId, suggestedSets, targetRepMin, targetRepMax, notes, supersetGroup }) => ({
      exerciseId,
      suggestedSets,
      targetRepMin,
      targetRepMax,
      supersetGroup,
      notes,
    })),
  })
}

export async function archiveRoutine(id: string): Promise<void> {
  const now = nowIso()
  await db.routines.update(id, { archivedAt: now, updatedAt: now })
}

export async function unarchiveRoutine(id: string): Promise<void> {
  await db.routines.update(id, { archivedAt: null, updatedAt: nowIso() })
}

/**
 * "Save this workout as a preset": takes what was actually performed (not what was
 * planned), in session order. Exercises without completed sets are left out.
 */
async function itemsFromSession(sessionId: string): Promise<RoutineExerciseInput[]> {
  const wes = (await db.workoutExercises.where('sessionId').equals(sessionId).toArray()).sort(
    (a, b) => a.position - b.position,
  )
  const sets = (await db.sets.where('sessionId').equals(sessionId).toArray()).filter((s) => s.isCompleted)
  const byExercise = new Map<string, RoutineExerciseInput>()
  for (const we of wes) {
    const mine = sets.filter((s) => s.workoutExerciseId === we.id)
    if (mine.length === 0) continue
    const working = mine.filter((s) => s.setType !== 'warmup')
    const reps = working.map((s) => s.reps).filter((r): r is number => r != null && r > 0)
    const prev = byExercise.get(we.performedExerciseId)
    const count = Math.max(1, working.length) + (prev?.suggestedSets ?? 0)
    byExercise.set(we.performedExerciseId, {
      // Keeps supersets (the same session group id becomes the preset's group key).
      supersetGroup: prev ? prev.supersetGroup : we.supersetGroupId,
      exerciseId: we.performedExerciseId,
      suggestedSets: count,
      targetRepMin: reps.length ? Math.min(...reps, prev?.targetRepMin ?? Infinity) : (prev?.targetRepMin ?? null),
      targetRepMax: reps.length ? Math.max(...reps, prev?.targetRepMax ?? 0) : (prev?.targetRepMax ?? null),
    })
  }
  if (byExercise.size === 0) throw new Error('This workout has no completed sets to save')
  return [...byExercise.values()]
}

export async function createRoutineFromSession(
  sessionId: string,
  input: { name: string; dayTypeId: string | null },
): Promise<Routine> {
  return createRoutine({ name: input.name, dayTypeId: input.dayTypeId, exercises: await itemsFromSession(sessionId) })
}

/**
 * "Update this preset from the workout": the preset keeps its name, day and notes, but its exercises become what
 * was actually done (order, set counts, rep range, supersets). Notes of exercises that stay are kept.
 * Returns the previous exercise list so the caller can offer undo.
 */
export async function updateRoutineFromSession(sessionId: string, routineId: string): Promise<RoutineExerciseInput[]> {
  const routine = await db.routines.get(routineId)
  if (!routine) throw new Error('Preset not found')
  const before = await getRoutineExercises(routineId)
  const previous: RoutineExerciseInput[] = before.map(
    ({ id, exerciseId, suggestedSets, targetRepMin, targetRepMax, supersetGroup, notes }) => ({
      id,
      exerciseId,
      suggestedSets,
      targetRepMin,
      targetRepMax,
      supersetGroup,
      notes,
    }),
  )
  const oldNotes = new Map(before.map((r) => [r.exerciseId, r.notes]))
  const items = (await itemsFromSession(sessionId)).map((it) => ({ ...it, notes: oldNotes.get(it.exerciseId) }))
  await saveRoutine(routineId, {
    name: routine.name,
    dayTypeId: routine.dayTypeId,
    notes: routine.notes,
    exercises: items,
  })
  return previous
}

export async function lastUsedByRoutine(): Promise<Map<string, string>> {
  const sessions = (await db.sessions.where('status').equals('completed').toArray()).filter((s) => s.routineId)
  const out = new Map<string, string>()
  for (const s of sessions) {
    const cur = out.get(s.routineId!)
    if (!cur || instant(s.startedAt) > instant(cur)) out.set(s.routineId!, s.startedAt)
  }
  return out
}
