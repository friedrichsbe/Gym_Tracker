import { db } from '../data/db'
import { getSettings } from '../data/settings'
import { instant, newId, nowIso, toIso } from '../domain/time'
import type { IsoTimestamp, SetRecord, WorkoutExercise, WorkoutSession } from '../domain/types'
import { blankSet, isForeignFor, locationInfo, normalizeGroups, normalizePositions } from '../workout/workoutService'

// Corrections to finished workouts (PRD F6) and entering workouts that were not logged live.
// Everything here works on `completed` sessions; the live workout has its own service.

const TABLES = () => [
  db.sessions,
  db.workoutExercises,
  db.sets,
  db.locations,
  db.dayTypes,
  db.exercises,
  db.routineExercises,
  db.settings,
]
const MAX_FUTURE_MS = 5 * 60_000

async function requireFinished(sessionId: string): Promise<WorkoutSession> {
  const s = await db.sessions.get(sessionId)
  if (!s) throw new Error('Workout not found')
  if (s.status === 'active') throw new Error('Finish the running workout before editing it here')
  return s
}

function shift(iso: IsoTimestamp, deltaMs: number): IsoTimestamp {
  return toIso(new Date(instant(iso) + deltaMs))
}

function checkStart(startedAt: IsoTimestamp) {
  const t = instant(startedAt)
  if (!Number.isFinite(t)) throw new Error('Invalid date')
  if (t > Date.now() + MAX_FUTURE_MS) throw new Error('A workout cannot start in the future')
}

function checkDuration(minutes: number | null | undefined) {
  if (minutes != null && (!Number.isFinite(minutes) || minutes < 1 || minutes > 24 * 60)) {
    throw new Error('Duration must be between 1 minute and 24 hours')
  }
}

export interface SessionDetailsPatch {
  startedAt?: IsoTimestamp
  /** Duration in minutes; null clears the end time (unknown duration). */
  durationMinutes?: number | null
  locationId?: string | null
  dayTypeId?: string | null
}

/**
 * Change date/time, duration, location or day of a finished workout.
 *  - Moving the start moves the whole workout: end time and every set's timestamp shift by the same amount.
 *  - A new location is applied to the workout and to all its sets (it was a correction, not a move).
 *  - A new day re-evaluates which exercises count as "outside the day".
 */
export async function updateSessionDetails(sessionId: string, patch: SessionDetailsPatch): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    const session = await requireFinished(sessionId)
    const now = nowIso()
    let next: WorkoutSession = { ...session, updatedAt: now }

    if (patch.startedAt !== undefined && patch.startedAt !== session.startedAt) {
      checkStart(patch.startedAt)
      const delta = instant(patch.startedAt) - instant(session.startedAt)
      next.startedAt = patch.startedAt
      if (session.endedAt) next.endedAt = shift(session.endedAt, delta)
      const sets = await db.sets.where('sessionId').equals(sessionId).toArray()
      await db.sets.bulkPut(
        sets.map((s) => (s.performedAt ? { ...s, performedAt: shift(s.performedAt, delta), updatedAt: now } : s)),
      )
    }

    if (patch.durationMinutes !== undefined) {
      checkDuration(patch.durationMinutes)
      next.endedAt = patch.durationMinutes === null ? null : shift(next.startedAt, patch.durationMinutes * 60_000)
    }

    if (patch.locationId !== undefined) {
      const loc = await locationInfo(patch.locationId)
      next = { ...next, locationId: loc.id, locationNameSnapshot: loc.name }
      const sets = await db.sets.where('sessionId').equals(sessionId).toArray()
      await db.sets.bulkPut(
        sets.map((s) => ({ ...s, locationId: loc.id, locationNameSnapshot: loc.name, updatedAt: now })),
      )
    }

    if (patch.dayTypeId !== undefined) {
      const day = patch.dayTypeId ? await db.dayTypes.get(patch.dayTypeId) : undefined
      if (patch.dayTypeId && !day) throw new Error('Training day not found')
      next = { ...next, dayTypeId: day?.id ?? null, dayTypeNameSnapshot: day?.name ?? null }
      await db.sessions.put(next)
      const instances = await db.workoutExercises.where('sessionId').equals(sessionId).toArray()
      const exercises = await db.exercises.bulkGet(instances.map((i) => i.performedExerciseId))
      const updated: WorkoutExercise[] = []
      for (const [i, inst] of instances.entries()) {
        const ex = exercises[i]
        if (ex) updated.push({ ...inst, isForeign: await isForeignFor(next, ex) })
      }
      await db.workoutExercises.bulkPut(updated)
      return
    }
    await db.sessions.put(next)
  })
}

/**
 * A finished workout without exercises, to be filled in afterwards ("log a past workout").
 * Values are never invented: sets start empty and the user types what happened.
 */
export async function createPastWorkout(input: {
  startedAt: IsoTimestamp
  durationMinutes?: number | null
  locationId?: string | null
  dayTypeId?: string | null
}): Promise<WorkoutSession> {
  checkStart(input.startedAt)
  checkDuration(input.durationMinutes)
  return db.transaction('rw', TABLES(), async () => {
    const loc = await locationInfo(input.locationId ?? null)
    const day = input.dayTypeId ? await db.dayTypes.get(input.dayTypeId) : undefined
    const now = nowIso()
    const session: WorkoutSession = {
      id: newId(),
      routineId: null,
      routineNameSnapshot: null,
      dayTypeId: day?.id ?? null,
      dayTypeNameSnapshot: day?.name ?? null,
      locationId: loc.id,
      locationNameSnapshot: loc.name,
      startedAt: input.startedAt,
      endedAt: input.durationMinutes ? shift(input.startedAt, input.durationMinutes * 60_000) : null,
      status: 'completed',
      focus: day?.name,
      createdAt: now,
      updatedAt: now,
    }
    await db.sessions.add(session)
    return session
  })
}

function pastSet(
  session: WorkoutSession,
  workoutExerciseId: string,
  setNumber: number,
  unit: SetRecord['weightUnit'],
  like?: SetRecord,
): SetRecord {
  const base = blankSet({
    sessionId: session.id,
    workoutExerciseId,
    setNumber,
    unit,
    location: { id: session.locationId, name: session.locationNameSnapshot },
    // Copies the shape of the previous set (unit, load type); numbers only when copying a sibling set.
    defaults: like
      ? { weightValue: like.weightValue, reps: like.reps, loadType: like.loadType, weightUnit: like.weightUnit }
      : undefined,
  })
  return { ...base, isCompleted: true, performedAt: session.endedAt ?? session.startedAt }
}

/** Adds an exercise (with one empty, completed set) to a finished workout. */
export async function addPastExercise(sessionId: string, exerciseId: string): Promise<WorkoutExercise> {
  return db.transaction('rw', TABLES(), async () => {
    const session = await requireFinished(sessionId)
    const exercise = await db.exercises.get(exerciseId)
    if (!exercise) throw new Error('Exercise not found')
    const settings = await getSettings()
    const existing = await db.workoutExercises.where('sessionId').equals(sessionId).toArray()
    const we: WorkoutExercise = {
      id: newId(),
      sessionId,
      plannedExerciseId: null,
      performedExerciseId: exercise.id,
      plannedNameSnapshot: null,
      performedNameSnapshot: exercise.name,
      position: existing.length,
      status: 'completed',
      isForeign: await isForeignFor(session, exercise),
      supersetGroupId: null,
    }
    await db.workoutExercises.add(we)
    const set = pastSet(session, we.id, 1, settings.units)
    if (exercise.equipmentType === 'bodyweight') set.loadType = 'bodyweight'
    await db.sets.add(set)
    return we
  })
}

/** Adds a set after the last one, copying its values as a starting point (the user edits them). */
export async function addPastSet(workoutExerciseId: string): Promise<SetRecord> {
  return db.transaction('rw', TABLES(), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId)
    if (!we) throw new Error('Exercise not found')
    const session = await requireFinished(we.sessionId)
    const settings = await getSettings()
    const sets = (await db.sets.where('workoutExerciseId').equals(we.id).toArray()).sort(
      (a, b) => a.setNumber - b.setNumber,
    )
    const prev = [...sets].reverse().find((s) => s.setType !== 'warmup') ?? sets.at(-1)
    const set = pastSet(session, we.id, sets.length + 1, settings.units, prev)
    await db.sets.add(set)
    return set
  })
}

/** Removes an exercise with all its sets from a finished workout. Callers must confirm first. */
export async function removePastExercise(workoutExerciseId: string): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId)
    if (!we) return
    await requireFinished(we.sessionId)
    await db.sets.where('workoutExerciseId').equals(we.id).delete()
    await db.workoutExercises.delete(we.id)
    await normalizePositions(we.sessionId)
    await normalizeGroups(we.sessionId)
  })
}

/**
 * "I picked the wrong exercise": point an existing entry at another exercise. Sets stay as logged;
 * the entry's name snapshot follows because it is the same entry, now correctly labelled.
 */
export async function changePerformedExercise(workoutExerciseId: string, exerciseId: string): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId)
    if (!we) throw new Error('Exercise entry not found')
    const session = await requireFinished(we.sessionId)
    const exercise = await db.exercises.get(exerciseId)
    if (!exercise) throw new Error('Exercise not found')
    await db.workoutExercises.put({
      ...we,
      performedExerciseId: exercise.id,
      performedNameSnapshot: exercise.name,
      isForeign: await isForeignFor(session, exercise),
    })
    await db.sessions.update(session.id, { updatedAt: nowIso() })
  })
}
