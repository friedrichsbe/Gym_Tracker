import { db } from '../data/db'
import { getSettings, updateSettings } from '../data/settings'
import { nowIso } from '../domain/time'
import type {
  CardioEntry,
  DayType,
  Exercise,
  Location,
  Routine,
  RoutineExercise,
  SetRecord,
  WorkoutExercise,
  WorkoutSession,
} from '../domain/types'
import { normalize } from '../exercises/exerciseService'
import { exportSchema, FORMAT_VERSION, type ExportFile } from './schema'

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024

export type ImportMode = 'merge' | 'replace'

export interface ImportCounts {
  incoming: number
  added: number
}

export interface ImportPlan {
  mode: ImportMode
  locations: Location[]
  exercises: Exercise[]
  dayTypes: DayType[]
  routines: Routine[]
  routineExercises: RoutineExercise[]
  sessions: WorkoutSession[]
  workoutExercises: WorkoutExercise[]
  sets: SetRecord[]
  cardio: CardioEntry[]
  settings: ExportFile['settings']
  counts: Record<'locations' | 'exercises' | 'dayTypes' | 'routines' | 'sessions' | 'sets', ImportCounts>
  /** Things that were repaired or skipped. Never silent. */
  warnings: string[]
}

export type ParseResult = { ok: true; file: ExportFile } | { ok: false; errors: string[] }

export function parseImportText(text: string, sizeBytes = text.length): ParseResult {
  if (sizeBytes > MAX_IMPORT_BYTES)
    return { ok: false, errors: [`File is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`] }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['This is not valid JSON. Use a Gym Tracker JSON export (gym-tracker-backup-….json).'] }
  }
  const parsed = exportSchema.safeParse(json)
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 15).map((i) => `${i.path.join('.') || '(file)'}: ${i.message}`)
    if (parsed.error.issues.length > 15) errors.push(`… and ${parsed.error.issues.length - 15} more problems`)
    return { ok: false, errors }
  }
  if (parsed.data.formatVersion > FORMAT_VERSION) {
    return {
      ok: false,
      errors: [
        `This export (format v${parsed.data.formatVersion}) was made by a newer version of the app. Update the app first.`,
      ],
    }
  }
  return { ok: true, file: parsed.data }
}

/** Works out what an import would do against the current database, without writing anything. */
export async function planImport(file: ExportFile, mode: ImportMode): Promise<ImportPlan> {
  const existing = {
    locations: new Set(mode === 'merge' ? await db.locations.toCollection().primaryKeys() : []),
    exercises: new Set(mode === 'merge' ? await db.exercises.toCollection().primaryKeys() : []),
    dayTypes: new Set(mode === 'merge' ? await db.dayTypes.toCollection().primaryKeys() : []),
    routines: new Set(mode === 'merge' ? await db.routines.toCollection().primaryKeys() : []),
    sessions: new Set(mode === 'merge' ? await db.sessions.toCollection().primaryKeys() : []),
    instances: new Set(mode === 'merge' ? await db.workoutExercises.toCollection().primaryKeys() : []),
    sets: new Set(mode === 'merge' ? await db.sets.toCollection().primaryKeys() : []),
    cardio: new Set(mode === 'merge' ? await db.cardio.toCollection().primaryKeys() : []),
    routineExercises: new Set(mode === 'merge' ? await db.routineExercises.toCollection().primaryKeys() : []),
  }
  const hasActive = mode === 'merge' && !!(await db.sessions.where('status').equals('active').first())
  const warnings: string[] = []
  const warn = (m: string) => warnings.push(m)

  const locations = file.locations.filter((l) => !existing.locations.has(l.id)) as Location[]
  const dayTypes = file.dayTypes.filter((d) => !existing.dayTypes.has(d.id)) as DayType[]
  const exercises: Exercise[] = file.exercises
    .filter((e) => !existing.exercises.has(e.id))
    .map((e) => ({ ...e, nameKey: normalize(e.name) }))

  const knownLocations = new Set([...existing.locations, ...file.locations.map((l) => l.id)])
  const knownDays = new Set([...existing.dayTypes, ...file.dayTypes.map((d) => d.id)])
  const knownExercises = new Set([...existing.exercises, ...file.exercises.map((e) => e.id)])

  // Routines
  const routines: Routine[] = []
  const routineExercises: RoutineExercise[] = []
  let routineRowsDropped = 0
  for (const { exercises: items, ...r } of file.routines) {
    if (existing.routines.has(r.id)) continue
    if (r.dayTypeId && !knownDays.has(r.dayTypeId)) {
      warn(`Preset "${r.name}" referred to an unknown day type; it is now usable on any day.`)
      r.dayTypeId = null
    }
    routines.push(r as Routine)
    for (const it of items) {
      if (!knownExercises.has(it.exerciseId) || existing.routineExercises.has(it.id)) {
        routineRowsDropped++
        continue
      }
      routineExercises.push({ ...it, routineId: r.id })
    }
  }
  if (routineRowsDropped)
    warn(`${routineRowsDropped} preset exercise(s) were skipped because their exercise is missing from the file.`)

  // Sessions, with exercise instances and sets
  const sessions: WorkoutSession[] = []
  const workoutExercises: WorkoutExercise[] = []
  const sets: SetRecord[] = []
  const cardio: CardioEntry[] = []
  const placeholders = new Map<string, Exercise>()
  let activeKept = hasActive
  let relinkedLocations = 0
  let clashes = 0

  for (const { exerciseInstances, cardio: cardioBlocks, ...s } of file.sessions) {
    if (existing.sessions.has(s.id)) continue
    if (s.status === 'active') {
      if (activeKept) {
        warn(
          `The active workout from ${s.startedAt.slice(0, 10)} was imported as "abandoned" because another workout is already in progress.`,
        )
        s.status = 'abandoned'
      }
      activeKept = true
    }
    if (s.locationId && !knownLocations.has(s.locationId)) {
      s.locationId = null
      relinkedLocations++
    }
    if (s.dayTypeId && !knownDays.has(s.dayTypeId)) s.dayTypeId = null
    sessions.push(s as WorkoutSession)
    for (const c of cardioBlocks) {
      if (existing.cardio.has(c.id)) clashes++
      else cardio.push({ ...c, sessionId: s.id } as CardioEntry)
    }

    for (const { sets: instanceSets, ...we } of exerciseInstances) {
      if (existing.instances.has(we.id)) {
        clashes++
        continue
      }
      if (!knownExercises.has(we.performedExerciseId)) {
        // Keep the data: recreate the exercise from the name snapshot instead of dropping sets.
        if (!placeholders.has(we.performedExerciseId)) {
          const now = nowIso()
          placeholders.set(we.performedExerciseId, {
            id: we.performedExerciseId,
            name: we.performedNameSnapshot,
            nameKey: normalize(we.performedNameSnapshot),
            aliases: [],
            equipmentType: 'other',
            muscleTags: [],
            isCustom: true,
            archivedAt: null,
            createdAt: now,
            updatedAt: now,
          })
        }
      }
      if (we.plannedExerciseId && !knownExercises.has(we.plannedExerciseId) && !placeholders.has(we.plannedExerciseId))
        we.plannedExerciseId = null
      workoutExercises.push({ ...we, sessionId: s.id } as WorkoutExercise)
      for (const set of instanceSets) {
        if (existing.sets.has(set.id)) {
          clashes++
          continue
        }
        if (set.locationId && !knownLocations.has(set.locationId)) {
          set.locationId = null
          relinkedLocations++
        }
        sets.push({ ...set, sessionId: s.id, workoutExerciseId: we.id } as SetRecord)
      }
    }
  }
  for (const p of placeholders.values()) {
    exercises.push(p)
    warn(`Exercise "${p.name}" was missing from the file's catalogue and was recreated from the workout data.`)
  }
  if (relinkedLocations)
    warn(`${relinkedLocations} record(s) pointed at an unknown location; they keep the location name but no link.`)
  if (clashes) warn(`${clashes} record(s) were skipped because they already exist.`)

  const count = (incoming: number, added: number): ImportCounts => ({ incoming, added })
  return {
    mode,
    locations,
    exercises,
    dayTypes,
    routines,
    routineExercises,
    sessions,
    workoutExercises,
    sets,
    cardio,
    settings: file.settings,
    counts: {
      locations: count(file.locations.length, locations.length),
      exercises: count(file.exercises.length, exercises.length),
      dayTypes: count(file.dayTypes.length, dayTypes.length),
      routines: count(file.routines.length, routines.length),
      sessions: count(file.sessions.length, sessions.length),
      sets: count(
        file.sessions.reduce((n, s) => n + s.exerciseInstances.reduce((m, i) => m + i.sets.length, 0), 0),
        sets.length,
      ),
    },
    warnings,
  }
}

/**
 * Writes the plan in a single transaction: either everything is imported or nothing is.
 * For 'replace' the caller must have offered/made a backup of the current data first.
 */
export async function applyImport(plan: ImportPlan): Promise<void> {
  const tables = [
    db.locations,
    db.exercises,
    db.dayTypes,
    db.routines,
    db.routineExercises,
    db.sessions,
    db.workoutExercises,
    db.sets,
    db.cardio,
    db.settings,
  ]
  await db.transaction('rw', tables, async () => {
    if (plan.mode === 'replace') {
      await Promise.all(
        [
          db.locations,
          db.exercises,
          db.dayTypes,
          db.routines,
          db.routineExercises,
          db.sessions,
          db.workoutExercises,
          db.sets,
          db.cardio,
        ].map((t) => t.clear()),
      )
    }
    await db.locations.bulkAdd(plan.locations)
    await db.exercises.bulkAdd(plan.exercises)
    await db.dayTypes.bulkAdd(plan.dayTypes)
    await db.routines.bulkAdd(plan.routines)
    await db.routineExercises.bulkAdd(plan.routineExercises)
    await db.sessions.bulkAdd(plan.sessions)
    await db.workoutExercises.bulkAdd(plan.workoutExercises)
    await db.sets.bulkAdd(plan.sets)
    await db.cardio.bulkAdd(plan.cardio)

    const current = await getSettings()
    const restored = plan.mode === 'replace' ? (plan.settings ?? {}) : {}
    await updateSettings({ ...current, ...restored, onboardingDone: true, dayTypesSeeded: true })
  })
}
