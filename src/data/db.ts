import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings,
  DayType,
  Exercise,
  Location,
  Routine,
  RoutineExercise,
  SchemaMetadata,
  SetRecord,
  WorkoutExercise,
  WorkoutSession,
} from '../domain/types'

/** Bump together with a new `db.version(n)` block. Distinct from the export formatVersion. */
export const SCHEMA_VERSION = 2
export const EXPORT_FORMAT_VERSION = 1

export class GymTrackerDb extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  dayTypes!: EntityTable<DayType, 'id'>
  locations!: EntityTable<Location, 'id'>
  routines!: EntityTable<Routine, 'id'>
  routineExercises!: EntityTable<RoutineExercise, 'id'>
  sessions!: EntityTable<WorkoutSession, 'id'>
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>
  sets!: EntityTable<SetRecord, 'id'>
  settings!: EntityTable<AppSettings, 'key'>
  meta!: EntityTable<SchemaMetadata, 'key'>

  constructor(name = 'gym-tracker') {
    super(name)
    this.version(1).stores({
      exercises: 'id, nameKey, archivedAt',
      locations: 'id, archivedAt',
      routines: 'id, archivedAt',
      routineExercises: 'id, routineId, position',
      sessions: 'id, startedAt, status, locationId',
      workoutExercises: 'id, sessionId, performedExerciseId, position',
      sets: 'id, sessionId, workoutExerciseId, performedAt, locationId',
      settings: 'key',
      meta: 'key',
    })
    // v2: day types (new table) + day-type indexes on routines and sessions.
    this.version(2).stores({
      dayTypes: 'id, archivedAt, position',
      routines: 'id, archivedAt, dayTypeId',
      sessions: 'id, startedAt, status, locationId, dayTypeId',
    })
  }
}

export let db = new GymTrackerDb()

/** Tests swap in an isolated database. */
export function setDatabase(instance: GymTrackerDb) {
  db = instance
}
