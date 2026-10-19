import { db } from '../data/db'
import { stopRunningCardio } from '../cardio/cardioService'
import { getSettings, updateSettings } from '../data/settings'
import { fitsDay } from '../daytypes/dayTypeService'
import { instant, newId, nowIso } from '../domain/time'
import { moveBlock, normalizeGroupIds } from './supersets'
import type {
  Exercise,
  LoadType,
  Location,
  SetRecord,
  SetType,
  Side,
  WeightUnit,
  WorkoutExercise,
  WorkoutSession,
} from '../domain/types'

const TABLES = () => [
  db.sessions,
  db.dayTypes,
  db.workoutExercises,
  db.sets,
  db.cardio,
  db.locations,
  db.exercises,
  db.routines,
  db.routineExercises,
  db.settings,
]

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  return db.sessions.where('status').equals('active').first()
}

export interface LastPerformance {
  sessionId: string
  startedAt: string
  locationId: string | null
  locationName: string | null
  sameLocation: boolean
  sets: SetRecord[]
}

/**
 * Most recent completed performance of an exercise. Prefers the same location
 * (loads on different machines are not blindly comparable), falling back to any.
 */
export async function getLastPerformance(
  exerciseId: string,
  opts: { locationId: string | null; excludeSessionId?: string },
): Promise<LastPerformance | undefined> {
  const instances = (await db.workoutExercises.where('performedExerciseId').equals(exerciseId).toArray()).filter(
    (we) => we.sessionId !== opts.excludeSessionId,
  )
  if (instances.length === 0) return undefined
  const sessions = (await db.sessions.bulkGet([...new Set(instances.map((i) => i.sessionId))])).filter(
    (s): s is WorkoutSession => !!s && s.status === 'completed',
  )
  const sessionById = new Map(sessions.map((s) => [s.id, s]))
  const candidates: LastPerformance[] = []
  for (const we of instances) {
    const session = sessionById.get(we.sessionId)
    if (!session) continue
    const sets = (await db.sets.where('workoutExerciseId').equals(we.id).toArray())
      .filter((s) => s.isCompleted)
      .sort((a, b) => a.setNumber - b.setNumber)
    if (sets.length === 0) continue
    const setLocation = sets[sets.length - 1].locationId
    candidates.push({
      sessionId: session.id,
      startedAt: session.startedAt,
      locationId: setLocation,
      locationName: sets[sets.length - 1].locationNameSnapshot,
      sameLocation: !!opts.locationId && setLocation === opts.locationId,
      sets,
    })
  }
  candidates.sort((a, b) => instant(b.startedAt) - instant(a.startedAt))
  return candidates.find((c) => c.sameLocation) ?? candidates[0]
}

interface SetDefaults {
  weightValue: number | null
  reps: number | null
  loadType: LoadType
  weightUnit: WeightUnit
}

async function defaultsFor(
  exerciseId: string,
  locationId: string | null,
  excludeSessionId?: string,
): Promise<SetDefaults | undefined> {
  const last = await getLastPerformance(exerciseId, { locationId, excludeSessionId })
  if (!last) return undefined
  const working = last.sets.filter((s) => s.setType !== 'warmup')
  const ref = (working.length ? working : last.sets).at(-1)
  if (!ref) return undefined
  return { weightValue: ref.weightValue, reps: ref.reps, loadType: ref.loadType, weightUnit: ref.weightUnit }
}

// ---------------------------------------------------------------------------
// Internal helpers (call inside a transaction)
// ---------------------------------------------------------------------------

export async function locationInfo(locationId: string | null): Promise<{ id: string | null; name: string | null }> {
  if (!locationId) return { id: null, name: null }
  const loc = await db.locations.get(locationId)
  return loc ? { id: loc.id, name: loc.name } : { id: null, name: null }
}

export function blankSet(args: {
  sessionId: string
  workoutExerciseId: string
  setNumber: number
  unit: WeightUnit
  location: { id: string | null; name: string | null }
  defaults?: Partial<SetDefaults>
}): SetRecord {
  const now = nowIso()
  return {
    id: newId(),
    sessionId: args.sessionId,
    workoutExerciseId: args.workoutExerciseId,
    setNumber: args.setNumber,
    setType: 'working',
    loadType: args.defaults?.loadType ?? 'weight',
    weightValue: args.defaults?.weightValue ?? null,
    weightUnit: args.defaults?.weightUnit ?? args.unit,
    reps: args.defaults?.reps ?? null,
    isCompleted: false,
    performedAt: null,
    locationId: args.location.id,
    locationNameSnapshot: args.location.name,
    createdAt: now,
    updatedAt: now,
  }
}

export async function renumberSets(workoutExerciseId: string): Promise<void> {
  const sets = (await db.sets.where('workoutExerciseId').equals(workoutExerciseId).toArray()).sort(
    (a, b) => a.setNumber - b.setNumber || a.createdAt.localeCompare(b.createdAt),
  )
  const changed = sets.flatMap((s, i) => (s.setNumber === i + 1 ? [] : [{ ...s, setNumber: i + 1 }]))
  if (changed.length) await db.sets.bulkPut(changed)
}

export async function normalizePositions(sessionId: string): Promise<void> {
  const list = (await db.workoutExercises.where('sessionId').equals(sessionId).toArray()).sort(
    (a, b) => a.position - b.position,
  )
  const changed = list.flatMap((we, i) => (we.position === i ? [] : [{ ...we, position: i }]))
  if (changed.length) await db.workoutExercises.bulkPut(changed)
}

async function touchSession(sessionId: string): Promise<void> {
  await db.sessions.update(sessionId, { updatedAt: nowIso() })
}

async function requireActive(sessionId: string): Promise<WorkoutSession> {
  const s = await db.sessions.get(sessionId)
  if (!s) throw new Error('Session not found')
  if (s.status !== 'active') throw new Error('Session is not active')
  return s
}

/** Is this exercise outside the session's day type? Exercises of the session's own routine always count as inside. */
export async function isForeignFor(session: WorkoutSession, exercise: Exercise): Promise<boolean> {
  if (!session.dayTypeId) return false
  const day = await db.dayTypes.get(session.dayTypeId)
  if (!day) return false
  const planned = session.routineId
    ? new Set(
        (await db.routineExercises.where('routineId').equals(session.routineId).toArray()).map((r) => r.exerciseId),
      )
    : undefined
  return !fitsDay(exercise, day, planned)
}

/** An exercise planned up front (routine or start-time pick) with "count" prefilled sets. */
async function addPlannedExercise(
  session: WorkoutSession,
  exercise: Exercise,
  opts: {
    position: number
    count: number
    targetRepMax?: number | null
    notes?: string
    foreign: boolean
    supersetGroupId?: string | null
  },
): Promise<WorkoutExercise> {
  const settings = await getSettings()
  const we: WorkoutExercise = {
    id: newId(),
    sessionId: session.id,
    plannedExerciseId: exercise.id,
    performedExerciseId: exercise.id,
    plannedNameSnapshot: exercise.name,
    performedNameSnapshot: exercise.name,
    position: opts.position,
    status: 'planned',
    isForeign: opts.foreign,
    supersetGroupId: opts.supersetGroupId ?? null,
    notes: opts.notes,
  }
  await db.workoutExercises.add(we)
  const defaults = await defaultsFor(exercise.id, session.locationId, session.id)
  const location = { id: session.locationId, name: session.locationNameSnapshot }
  await db.sets.bulkAdd(
    Array.from({ length: Math.max(1, opts.count) }, (_, i) =>
      blankSet({
        sessionId: session.id,
        workoutExerciseId: we.id,
        setNumber: i + 1,
        unit: settings.units,
        location,
        defaults: {
          ...defaults,
          reps: defaults?.reps ?? opts.targetRepMax ?? null,
          loadType: defaults?.loadType ?? (exercise.equipmentType === 'bodyweight' ? 'bodyweight' : 'weight'),
        },
      }),
    ),
  )
  return we
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export async function startWorkout(input: {
  routineId?: string | null
  /** Kind of day; defaults to the routine's day. null = free workout. */
  dayTypeId?: string | null
  /** Exercises picked at the start (no routine). */
  exerciseIds?: string[]
  /** Optional superset key per picked exercise (same key = superset), aligned with exerciseIds. */
  supersetKeys?: (string | null)[]
  locationId?: string | null
  focus?: string
  startedAt?: string
}): Promise<WorkoutSession> {
  return db.transaction('rw', TABLES(), async () => {
    if (await getActiveSession()) throw new Error('A workout is already in progress')
    const settings = await getSettings()
    const now = input.startedAt ?? nowIso()
    const location = await locationInfo(input.locationId ?? null)
    const routine = input.routineId ? await db.routines.get(input.routineId) : undefined
    if (input.routineId && !routine) throw new Error('Routine not found')
    const dayTypeId = input.dayTypeId !== undefined ? input.dayTypeId : (routine?.dayTypeId ?? null)
    const dayType = dayTypeId ? await db.dayTypes.get(dayTypeId) : undefined

    const session: WorkoutSession = {
      id: newId(),
      routineId: routine?.id ?? null,
      routineNameSnapshot: routine?.name ?? null,
      dayTypeId: dayType?.id ?? null,
      dayTypeNameSnapshot: dayType?.name ?? null,
      locationId: location.id,
      locationNameSnapshot: location.name,
      startedAt: now,
      endedAt: null,
      status: 'active',
      focus: input.focus?.trim() || routine?.name || dayType?.name,
      createdAt: now,
      updatedAt: now,
    }
    await db.sessions.add(session)

    if (routine) {
      // The session snapshots its own plan: later routine edits never affect it.
      const planned = (await db.routineExercises.where('routineId').equals(routine.id).toArray()).sort(
        (a, b) => a.position - b.position,
      )
      let position = 0
      const groups = new Map<string, string>() // preset group key -> this session's group id
      for (const re of planned) {
        const exercise = await db.exercises.get(re.exerciseId)
        if (!exercise) continue
        let supersetGroupId: string | null = null
        if (re.supersetGroup) {
          supersetGroupId = groups.get(re.supersetGroup) ?? newId()
          groups.set(re.supersetGroup, supersetGroupId)
        }
        await addPlannedExercise(session, exercise, {
          supersetGroupId,
          position: position++,
          count: re.suggestedSets ?? 3,
          targetRepMax: re.targetRepMax,
          notes: re.notes,
          foreign: false,
        })
      }
    } else if (input.exerciseIds?.length) {
      let position = 0
      const groups = new Map<string, string>()
      const keys = normalizeGroupIds(input.supersetKeys ?? [], () => newId()) // invalid groups drop out
      const rawKeys = input.supersetKeys ?? []
      for (const [idx, id] of input.exerciseIds.entries()) {
        const exercise = await db.exercises.get(id)
        if (!exercise) continue
        const key = keys[idx] ? rawKeys[idx] : null
        let supersetGroupId: string | null = null
        if (key) {
          supersetGroupId = groups.get(key) ?? newId()
          groups.set(key, supersetGroupId)
        }
        // Picked on purpose at the start, so not flagged as outside the day.
        await addPlannedExercise(session, exercise, { position: position++, count: 3, foreign: false, supersetGroupId })
      }
    }

    await updateSettings({ lastLocationId: location.id ?? settings.lastLocationId, lastDayTypeId: dayType?.id ?? null })
    return session
  })
}

export interface WorkoutSummary {
  durationSeconds: number | null
  completedSets: number
  workingSets: number
  exercisesDone: number
  exercisesSkipped: number
  /** Cardio blocks of the workout and their total time. */
  cardioCount: number
  cardioSeconds: number
  /** Σ weight × reps over completed sets with external load, per unit (warm-ups per the stats setting). */
  volume: Partial<Record<WeightUnit, number>>
}

/** Exercise instances whose exercise is done one side at a time (their sets count twice in volume). */
async function unilateralInstanceIds(instances: WorkoutExercise[]): Promise<Set<string>> {
  const exercises = await db.exercises.bulkGet([...new Set(instances.map((i) => i.performedExerciseId))])
  const ids = new Set(exercises.filter((e) => e?.unilateral).map((e) => e!.id))
  return new Set(instances.filter((i) => ids.has(i.performedExerciseId)).map((i) => i.id))
}

export async function summarizeSession(sessionId: string): Promise<WorkoutSummary> {
  const session = await db.sessions.get(sessionId)
  const exercises = await db.workoutExercises.where('sessionId').equals(sessionId).toArray()
  const sets = (await db.sets.where('sessionId').equals(sessionId).toArray()).filter((s) => s.isCompleted)
  const cardio = await db.cardio.where('sessionId').equals(sessionId).toArray()
  const { includeWarmupsInStats } = await getSettings()
  const unilateral = await unilateralInstanceIds(exercises)
  const volume: WorkoutSummary['volume'] = {}
  for (const s of sets) {
    if (
      (s.setType === 'warmup' && !includeWarmupsInStats) ||
      s.loadType !== 'weight' ||
      s.weightValue == null ||
      s.reps == null
    )
      continue
    const sides = unilateral.has(s.workoutExerciseId) ? 2 : 1
    volume[s.weightUnit] = (volume[s.weightUnit] ?? 0) + s.weightValue * s.reps * sides
  }
  const withSets = new Set(sets.map((s) => s.workoutExerciseId))
  return {
    durationSeconds:
      session?.endedAt && session.startedAt
        ? Math.max(0, Math.round((instant(session.endedAt) - instant(session.startedAt)) / 1000))
        : null,
    completedSets: sets.length,
    workingSets: sets.filter((s) => s.setType !== 'warmup').length,
    exercisesDone: exercises.filter((e) => withSets.has(e.id)).length,
    exercisesSkipped: exercises.filter((e) => !withSets.has(e.id)).length,
    cardioCount: cardio.length,
    cardioSeconds: cardio.reduce((n, c) => n + (c.durationSeconds ?? 0), 0),
    volume,
  }
}

export async function finishWorkout(input: {
  sessionId: string
  notes?: string
  endedAt?: string
}): Promise<WorkoutSummary> {
  await db.transaction('rw', TABLES(), async () => {
    const session = await requireActive(input.sessionId)
    const exercises = await db.workoutExercises.where('sessionId').equals(session.id).toArray()
    const sets = await db.sets.where('sessionId').equals(session.id).toArray()

    // Planned-but-not-done sets are intentions, not data: drop them.
    const pending = sets.filter((s) => !s.isCompleted).map((s) => s.id)
    if (pending.length) await db.sets.bulkDelete(pending)

    const withSets = new Set(sets.filter((s) => s.isCompleted).map((s) => s.workoutExerciseId))
    await db.workoutExercises.bulkPut(
      exercises.map((we) => ({
        ...we,
        status: !withSets.has(we.id)
          ? 'skipped'
          : we.plannedExerciseId && we.plannedExerciseId !== we.performedExerciseId
            ? 'substituted'
            : 'completed',
      })),
    )
    for (const we of exercises) await renumberSets(we.id)

    const endedAt = input.endedAt ?? nowIso()
    await stopRunningCardio(session.id, endedAt) // a forgotten timer ends with the workout
    await db.sessions.update(session.id, {
      status: 'completed',
      endedAt,
      notes: input.notes?.trim() || session.notes,
      updatedAt: nowIso(),
    })
    if (session.locationId) await updateSettings({ lastLocationId: session.locationId })
  })
  return summarizeSession(input.sessionId)
}

/** Keeps the data but marks the session abandoned; it is hidden from normal history. */
export async function discardWorkout(sessionId: string): Promise<void> {
  await requireActive(sessionId)
  await db.sessions.update(sessionId, { status: 'abandoned', endedAt: nowIso(), updatedAt: nowIso() })
}

/** Permanently removes a workout and all its sets. Callers must confirm with the user first. */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    await db.sets.where('sessionId').equals(sessionId).delete()
    await db.cardio.where('sessionId').equals(sessionId).delete()
    await db.workoutExercises.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}

export async function updateSessionNotes(sessionId: string, patch: { notes?: string; focus?: string }): Promise<void> {
  await db.sessions.update(sessionId, { ...patch, updatedAt: nowIso() })
}

// ---------------------------------------------------------------------------
// Location context
// ---------------------------------------------------------------------------

/**
 * Switch location mid-session (PRD F2).
 *  - 'fromNow':  sets logged from now on use the new location (e.g. moved to another gym).
 *  - 'session':  the whole workout was at the new location; relabel already logged sets too (correction).
 */
export async function changeSessionLocation(input: {
  sessionId: string
  locationId: string | null
  scope: 'fromNow' | 'session'
}): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    const session = await requireActive(input.sessionId)
    const loc = await locationInfo(input.locationId)
    await db.sessions.update(session.id, { locationId: loc.id, locationNameSnapshot: loc.name, updatedAt: nowIso() })
    const sets = await db.sets.where('sessionId').equals(session.id).toArray()
    const affected = sets.filter((s) => input.scope === 'session' || !s.isCompleted)
    await db.sets.bulkPut(
      affected.map((s) => ({ ...s, locationId: loc.id, locationNameSnapshot: loc.name, updatedAt: nowIso() })),
    )
    if (loc.id) await updateSettings({ lastLocationId: loc.id })
  })
}

// ---------------------------------------------------------------------------
// Exercises within a session
// ---------------------------------------------------------------------------

export async function addExercise(input: {
  sessionId: string
  exerciseId: string
  plannedExerciseId?: string | null
}): Promise<WorkoutExercise> {
  return db.transaction('rw', TABLES(), async () => {
    const session = await requireActive(input.sessionId)
    const exercise = await db.exercises.get(input.exerciseId)
    if (!exercise) throw new Error('Exercise not found')
    const settings = await getSettings()
    const existing = await db.workoutExercises.where('sessionId').equals(session.id).toArray()
    const we: WorkoutExercise = {
      id: newId(),
      sessionId: session.id,
      plannedExerciseId: input.plannedExerciseId ?? null,
      performedExerciseId: exercise.id,
      plannedNameSnapshot: null,
      performedNameSnapshot: exercise.name,
      position: existing.length,
      status: 'planned',
      isForeign: await isForeignFor(session, exercise),
    }
    await db.workoutExercises.add(we)
    const defaults = await defaultsFor(exercise.id, session.locationId, session.id)
    await db.sets.add(
      blankSet({
        sessionId: session.id,
        workoutExerciseId: we.id,
        setNumber: 1,
        unit: settings.units,
        location: { id: session.locationId, name: session.locationNameSnapshot },
        defaults: {
          ...defaults,
          loadType: exercise.equipmentType === 'bodyweight' ? 'bodyweight' : defaults?.loadType,
        },
      }),
    )
    await touchSession(session.id)
    return we
  })
}

/**
 * Replace the exercise being performed (PRD F5). Completed sets are history and
 * stay attached to the exercise actually performed; the replacement becomes a
 * new instance right after it, still pointing at the original plan.
 * Without completed sets the instance is simply re-pointed.
 */
export async function substituteExercise(input: {
  workoutExerciseId: string
  performedExerciseId: string
  reason?: string
}): Promise<WorkoutExercise> {
  return db.transaction('rw', TABLES(), async () => {
    const we = await db.workoutExercises.get(input.workoutExerciseId)
    if (!we) throw new Error('Exercise instance not found')
    const session = await requireActive(we.sessionId)
    const next = await db.exercises.get(input.performedExerciseId)
    if (!next) throw new Error('Replacement exercise not found')
    if (we.performedExerciseId === next.id) return we

    const settings = await getSettings()
    const sets = (await db.sets.where('workoutExerciseId').equals(we.id).toArray()).sort(
      (a, b) => a.setNumber - b.setNumber,
    )
    const completed = sets.filter((s) => s.isCompleted)
    const pending = sets.filter((s) => !s.isCompleted)
    const defaults = await defaultsFor(next.id, session.locationId, session.id)
    const reason = input.reason?.trim() || undefined
    const reprefill = (s: SetRecord): SetRecord => ({
      ...s,
      weightValue: defaults?.weightValue ?? null,
      reps: defaults?.reps ?? s.reps,
      loadType: defaults?.loadType ?? (next.equipmentType === 'bodyweight' ? 'bodyweight' : 'weight'),
      weightUnit: defaults?.weightUnit ?? s.weightUnit,
      updatedAt: nowIso(),
    })

    if (completed.length === 0) {
      const updated: WorkoutExercise = {
        ...we,
        performedExerciseId: next.id,
        performedNameSnapshot: next.name,
        status: we.plannedExerciseId && we.plannedExerciseId !== next.id ? 'substituted' : 'planned',
        isForeign: await isForeignFor(session, next),
        substitutionReason: reason,
      }
      await db.workoutExercises.put(updated)
      await db.sets.bulkPut(pending.map(reprefill))
      await touchSession(session.id)
      return updated
    }

    // Make room right after the original, keep its completed sets untouched.
    const later = (await db.workoutExercises.where('sessionId').equals(session.id).toArray()).filter(
      (x) => x.position > we.position,
    )
    await db.workoutExercises.bulkPut(later.map((x) => ({ ...x, position: x.position + 1 })))
    await db.workoutExercises.put({ ...we, status: 'completed' })

    const replacement: WorkoutExercise = {
      id: newId(),
      sessionId: session.id,
      plannedExerciseId: we.plannedExerciseId,
      performedExerciseId: next.id,
      plannedNameSnapshot: we.plannedNameSnapshot,
      performedNameSnapshot: next.name,
      position: we.position + 1,
      status: we.plannedExerciseId ? 'substituted' : 'planned',
      isForeign: await isForeignFor(session, next),
      // Continues the same superset the original was part of.
      supersetGroupId: we.supersetGroupId ?? null,
      substitutionReason: reason,
    }
    await db.workoutExercises.add(replacement)
    if (pending.length) {
      await db.sets.bulkPut(
        pending.map((s, i) => ({ ...reprefill(s), workoutExerciseId: replacement.id, setNumber: i + 1 })),
      )
    } else {
      await db.sets.add(
        blankSet({
          sessionId: session.id,
          workoutExerciseId: replacement.id,
          setNumber: 1,
          unit: settings.units,
          location: { id: session.locationId, name: session.locationNameSnapshot },
          defaults,
        }),
      )
    }
    await renumberSets(we.id)
    await touchSession(session.id)
    return replacement
  })
}

export async function skipExercise(workoutExerciseId: string, skipped: boolean): Promise<void> {
  const we = await db.workoutExercises.get(workoutExerciseId)
  if (!we) return
  await requireActive(we.sessionId)
  const hasCompleted = (await db.sets.where('workoutExerciseId').equals(we.id).toArray()).some((s) => s.isCompleted)
  if (skipped && hasCompleted) throw new Error('Exercise already has completed sets')
  await db.workoutExercises.update(we.id, { status: skipped ? 'skipped' : 'planned' })
}

/** Re-establishes the superset invariants after anything moved or was removed. */
export async function normalizeGroups(sessionId: string): Promise<void> {
  const list = (await db.workoutExercises.where('sessionId').equals(sessionId).toArray()).sort(
    (a, b) => a.position - b.position,
  )
  const ids = normalizeGroupIds(
    list.map((w) => w.supersetGroupId),
    newId,
  )
  const changed = list.flatMap((w, i) =>
    (w.supersetGroupId ?? null) === ids[i] ? [] : [{ ...w, supersetGroupId: ids[i] }],
  )
  if (changed.length) await db.workoutExercises.bulkPut(changed)
}

/**
 * Moves an exercise up/down. A superset moves as one block, so its members always stay together
 * and nothing can be slotted into the middle of it.
 */
export async function moveExercise(workoutExerciseId: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId)
    if (!we) return
    await normalizePositions(we.sessionId)
    const list = (await db.workoutExercises.where('sessionId').equals(we.sessionId).toArray()).sort(
      (a, b) => a.position - b.position,
    )
    const i = list.findIndex((x) => x.id === we.id)
    const reordered = moveBlock(list, i, direction, (w) => w.supersetGroupId)
    const changed = reordered.flatMap((w, p) => (w.position === p ? [] : [{ ...w, position: p }]))
    if (changed.length) await db.workoutExercises.bulkPut(changed)
  })
}

export interface RemovedExercise {
  we: WorkoutExercise
  sets: SetRecord[]
  /** Other members of its superset at the time (a group of two dissolves when one is removed). */
  groupPeers: string[]
}

/** Only allowed while nothing was logged for it; otherwise use skip/substitute. Returns what is needed for undo. */
export async function removeExercise(workoutExerciseId: string): Promise<RemovedExercise | undefined> {
  return db.transaction('rw', TABLES(), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId)
    if (!we) return undefined
    await requireActive(we.sessionId)
    const sets = await db.sets.where('workoutExerciseId').equals(we.id).toArray()
    if (sets.some((s) => s.isCompleted)) throw new Error('Exercise has completed sets; skip it instead')
    const groupPeers = we.supersetGroupId
      ? (await db.workoutExercises.where('sessionId').equals(we.sessionId).toArray())
          .filter((x) => x.id !== we.id && x.supersetGroupId === we.supersetGroupId)
          .map((x) => x.id)
      : []
    await db.sets.bulkDelete(sets.map((s) => s.id))
    await db.workoutExercises.delete(we.id)
    await normalizePositions(we.sessionId)
    await normalizeGroups(we.sessionId)
    return { we, sets, groupPeers }
  })
}

/** Undo of `removeExercise`: puts the exercise back at its old position (and superset, if that still exists). */
export async function restoreExercise(removed: RemovedExercise): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    const { we, sets } = removed
    await requireActive(we.sessionId)
    const list = await db.workoutExercises.where('sessionId').equals(we.sessionId).toArray()
    const shifted = list.filter((x) => x.position >= we.position).map((x) => ({ ...x, position: x.position + 1 }))
    if (shifted.length) await db.workoutExercises.bulkPut(shifted)
    await db.workoutExercises.put({ ...we, position: Math.min(we.position, list.length) })
    if (sets.length) await db.sets.bulkPut(sets)
    if (we.supersetGroupId && removed.groupPeers.length) {
      const peers = await db.workoutExercises.bulkGet(removed.groupPeers)
      await db.workoutExercises.bulkPut(
        peers.filter((p): p is WorkoutExercise => !!p).map((p) => ({ ...p, supersetGroupId: we.supersetGroupId })),
      )
    }
    await normalizePositions(we.sessionId)
    await normalizeGroups(we.sessionId)
  })
}

/**
 * Pairs this exercise with the one directly below it into a superset (or extends an existing one,
 * giving a tri-set etc.). Sets are logged exactly as usual; the grouping is only a label plus an
 * "up next" hint in the UI.
 */
export async function linkSuperset(workoutExerciseId: string): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId)
    if (!we) return
    await requireActive(we.sessionId)
    await normalizePositions(we.sessionId)
    const list = (await db.workoutExercises.where('sessionId').equals(we.sessionId).toArray()).sort(
      (a, b) => a.position - b.position,
    )
    const i = list.findIndex((x) => x.id === we.id)
    const next = list[i + 1]
    if (!next) throw new Error('There is no exercise below to pair with')
    if (we.supersetGroupId && we.supersetGroupId === next.supersetGroupId) return // already together
    const gid = we.supersetGroupId ?? next.supersetGroupId ?? newId()
    const joining = new Set([we.id, next.id])
    // Pull in the whole group of the next exercise so groups merge instead of splitting.
    for (const w of list) if (next.supersetGroupId && w.supersetGroupId === next.supersetGroupId) joining.add(w.id)
    await db.workoutExercises.bulkPut(
      list.filter((w) => joining.has(w.id)).map((w) => ({ ...w, supersetGroupId: gid })),
    )
    await normalizeGroups(we.sessionId)
  })
}

/** Takes this exercise out of its superset (a group of two dissolves). */
export async function unlinkSuperset(workoutExerciseId: string): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId)
    if (!we) return
    await requireActive(we.sessionId)
    await db.workoutExercises.update(we.id, { supersetGroupId: null })
    await normalizeGroups(we.sessionId)
  })
}

// ---------------------------------------------------------------------------
// Sets
// ---------------------------------------------------------------------------

export async function addSet(workoutExerciseId: string): Promise<SetRecord> {
  return db.transaction('rw', TABLES(), async () => {
    const we = await db.workoutExercises.get(workoutExerciseId)
    if (!we) throw new Error('Exercise instance not found')
    const session = await requireActive(we.sessionId)
    const settings = await getSettings()
    const sets = (await db.sets.where('workoutExerciseId').equals(we.id).toArray()).sort(
      (a, b) => a.setNumber - b.setNumber,
    )
    const prev = [...sets].reverse().find((s) => s.setType !== 'warmup') ?? sets.at(-1)
    const set = blankSet({
      sessionId: session.id,
      workoutExerciseId: we.id,
      setNumber: sets.length + 1,
      unit: settings.units,
      location: { id: session.locationId, name: session.locationNameSnapshot },
      defaults: prev
        ? { weightValue: prev.weightValue, reps: prev.reps, loadType: prev.loadType, weightUnit: prev.weightUnit }
        : undefined,
    })
    await db.sets.add(set)
    if (we.status === 'skipped') await db.workoutExercises.update(we.id, { status: 'planned' })
    return set
  })
}

export type SetPatch = Partial<
  Pick<
    SetRecord,
    'weightValue' | 'reps' | 'setType' | 'loadType' | 'weightUnit' | 'rpe' | 'rir' | 'notes' | 'durationSeconds'
  >
>

export async function updateSet(setId: string, patch: SetPatch): Promise<void> {
  const set = await db.sets.get(setId)
  if (!set) return
  validatePatch(patch)
  await db.sets.update(setId, { ...patch, updatedAt: nowIso() })
}

function validatePatch(patch: SetPatch) {
  if (patch.weightValue != null && (!Number.isFinite(patch.weightValue) || patch.weightValue < 0))
    throw new Error('Invalid weight')
  if (patch.reps != null && (!Number.isInteger(patch.reps) || patch.reps < 0)) throw new Error('Invalid reps')
  if (patch.rpe != null && (patch.rpe < 1 || patch.rpe > 10)) throw new Error('RPE must be between 1 and 10')
  if (patch.rir != null && (patch.rir < 0 || patch.rir > 10)) throw new Error('RIR must be between 0 and 10')
}

export async function setSetType(setId: string, setType: SetType): Promise<void> {
  await updateSet(setId, { setType })
}

/**
 * Mark a set as done. Optional values are applied atomically so a half-typed
 * field is never lost. When the last set of an exercise is completed, the next
 * one is prepared (same values) so the following set is always visible.
 */
export async function completeSet(setId: string, values: SetPatch = {}): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    const set = await db.sets.get(setId)
    if (!set) throw new Error('Set not found')
    if (set.isCompleted) return // duplicate tap
    const session = await requireActive(set.sessionId)
    validatePatch(values)
    const loc = await locationInfo(session.locationId)
    const merged: SetRecord = {
      ...set,
      ...values,
      isCompleted: true,
      performedAt: nowIso(),
      locationId: loc.id,
      locationNameSnapshot: loc.name,
      updatedAt: nowIso(),
    }
    delete merged.sideDone // both sides are done now
    await db.sets.put(merged)
    await db.workoutExercises.update(set.workoutExerciseId, { status: 'active' })

    // Optional (Settings → Workout): finishing the last set adds a pre-filled next one. Off by default —
    // "Add set" does the same on purpose, and an exercise you are done with shouldn't leave an empty row behind.
    const settings = await getSettings()
    const siblings = await db.sets.where('workoutExerciseId').equals(set.workoutExerciseId).toArray()
    const isLast = !siblings.some((s) => s.setNumber > set.setNumber)
    if (isLast && settings.autoAddNextSet) {
      await db.sets.add(
        blankSet({
          sessionId: set.sessionId,
          workoutExerciseId: set.workoutExerciseId,
          setNumber: set.setNumber + 1,
          unit: settings.units,
          location: loc,
          defaults: {
            weightValue: merged.weightValue,
            reps: merged.reps,
            loadType: merged.loadType,
            weightUnit: merged.weightUnit,
          },
        }),
      )
    }
  })
}

/** `keepSide`: one-sided exercise, only the other side is undone. */
export async function uncompleteSet(setId: string, opts: { keepSide?: Side } = {}): Promise<void> {
  const set = await db.sets.get(setId)
  if (!set || !set.isCompleted) return
  await requireActive(set.sessionId)
  await db.sets.update(setId, {
    isCompleted: false,
    sideDone: opts.keepSide,
    performedAt: null,
    updatedAt: nowIso(),
  })
}

/**
 * Tick or untick one side of a one-sided exercise, in any order. The set is completed once both sides are
 * ticked; returns true then, so the caller can start the rest timer.
 */
export async function toggleSide(setId: string, side: Side): Promise<boolean> {
  const set = await db.sets.get(setId)
  if (!set) throw new Error('Set not found')
  const other: Side = side === 'left' ? 'right' : 'left'
  if (set.isCompleted) {
    await uncompleteSet(setId, { keepSide: other })
    return false
  }
  if (set.sideDone === other) {
    await completeSet(setId)
    return true
  }
  await requireActive(set.sessionId)
  await db.sets.update(setId, { sideDone: set.sideDone === side ? undefined : side, updatedAt: nowIso() })
  return false
}

/**
 * Returns the deleted record so the UI can offer undo via `restoreSet`.
 * Works for running and finished workouts alike (finished ones can be corrected in History).
 */
export async function deleteSet(setId: string): Promise<SetRecord | undefined> {
  return db.transaction('rw', TABLES(), async () => {
    const set = await db.sets.get(setId)
    if (!set) return undefined
    await db.sets.delete(setId)
    await renumberSets(set.workoutExerciseId)
    return set
  })
}

export async function restoreSet(set: SetRecord): Promise<void> {
  await db.transaction('rw', TABLES(), async () => {
    if (!(await db.workoutExercises.get(set.workoutExerciseId))) return
    // Slot it in just before whatever currently occupies its old position, then renumber.
    await db.sets.put({ ...set, setNumber: set.setNumber - 0.5, updatedAt: nowIso() })
    await renumberSets(set.workoutExerciseId)
  })
}

// ---------------------------------------------------------------------------
// Convenience for the UI
// ---------------------------------------------------------------------------

export interface WorkoutExerciseView {
  we: WorkoutExercise
  exercise: Exercise | undefined
  sets: SetRecord[]
}

export async function loadSessionView(sessionId: string): Promise<
  | {
      session: WorkoutSession
      location: Location | undefined
      exercises: WorkoutExerciseView[]
    }
  | undefined
> {
  const session = await db.sessions.get(sessionId)
  if (!session) return undefined
  const [unsorted, sets, location] = await Promise.all([
    db.workoutExercises.where('sessionId').equals(sessionId).toArray(),
    db.sets.where('sessionId').equals(sessionId).toArray(),
    session.locationId ? db.locations.get(session.locationId) : undefined,
  ])
  const wes = unsorted.sort((a, b) => a.position - b.position)
  const exercises = await db.exercises.bulkGet(wes.map((w) => w.performedExerciseId))
  return {
    session,
    location,
    exercises: wes.map((we, i) => ({
      we,
      exercise: exercises[i] ?? undefined,
      sets: sets.filter((s) => s.workoutExerciseId === we.id).sort((a, b) => a.setNumber - b.setNumber),
    })),
  }
}
