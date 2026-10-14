// Domain model — see docs/Gym_Tracker_PRD.md §12.
// A performed SetRecord is the canonical unit of training data. Routines are
// plans; sessions record what actually happened. Names are snapshotted so
// history stays interpretable after renames/archiving.

export type Uuid = string
/** ISO 8601 timestamp including the local UTC offset, e.g. 2026-10-13T17:00:00+02:00 */
export type IsoTimestamp = string

export type WeightUnit = 'kg' | 'lb'
/** Light/dark mode. 'system' follows the OS. */
export type Theme = 'system' | 'light' | 'dark'
/** Which palette is used whenever the light mode is active. */
export type LightStyle = 'light' | 'glow'
/** Which palette is used whenever the dark mode is active. */
export type DarkStyle = 'dark' | 'midnight'
export type AccentColor = 'teal' | 'blue' | 'orchid' | 'forest' | 'ember' | 'rose' | 'graphite'

export type EquipmentType = 'machine' | 'dumbbell' | 'barbell' | 'cable' | 'bodyweight' | 'other'

export type SetType = 'warmup' | 'working' | 'drop' | 'failure' | 'other'

/**
 * How the load of a set is expressed. Appendix B: zero load, bodyweight-only,
 * assisted load and unknown load are distinct and must not all be encoded as 0.
 *  - weight:     external load, `weightValue` (null = unknown)
 *  - bodyweight: bodyweight only; `weightValue` is optional added weight
 *  - assisted:   assistance subtracted from bodyweight; `weightValue` is the assistance
 */
export type LoadType = 'weight' | 'bodyweight' | 'assisted'

export type SessionStatus = 'active' | 'completed' | 'abandoned'
export type WorkoutExerciseStatus = 'planned' | 'active' | 'completed' | 'skipped' | 'substituted'

export interface Timestamps {
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}

export interface Exercise extends Timestamps {
  id: Uuid
  name: string
  /** Normalised name used for duplicate detection and search. */
  nameKey: string
  aliases: string[]
  equipmentType: EquipmentType
  movementPattern?: string
  muscleTags: string[]
  isCustom: boolean
  /** Rest after a set of this exercise in seconds; null/undefined = use the global default. */
  defaultRestSeconds?: number | null
  /** Starred by the user: listed first in the picker. */
  favorite?: boolean
  archivedAt: IsoTimestamp | null
}

export interface Location extends Timestamps {
  id: Uuid
  name: string
  notes?: string
  address?: string
  archivedAt: IsoTimestamp | null
}

/**
 * A user-defined kind of training day (Leg, Upper, Mix, Push, …). It decides which
 * exercises are suggested; anything else stays available but is marked as "outside".
 * An exercise fits a day if the day matches all, lists it explicitly, or shares a muscle tag.
 */
export interface DayType extends Timestamps {
  id: Uuid
  name: string
  muscleTags: string[]
  /** Exercises that count for this day regardless of their muscle tags. */
  exerciseIds: Uuid[]
  /** "Mix"-style day: every exercise fits. */
  matchAll: boolean
  position: number
  archivedAt: IsoTimestamp | null
}

export interface Routine extends Timestamps {
  id: Uuid
  name: string
  /** Day this preset belongs to; null = usable on any day. */
  dayTypeId: Uuid | null
  notes?: string
  archivedAt: IsoTimestamp | null
}

export interface RoutineExercise {
  id: Uuid
  routineId: Uuid
  exerciseId: Uuid
  position: number
  suggestedSets: number | null
  targetRepMin: number | null
  targetRepMax: number | null
  /** Exercises sharing this key are a superset in the preset. */
  supersetGroup?: string | null
  notes?: string
}

export interface WorkoutSession extends Timestamps {
  id: Uuid
  routineId: Uuid | null
  routineNameSnapshot: string | null
  /** Kind of day chosen at the start; null = free workout. */
  dayTypeId: Uuid | null
  dayTypeNameSnapshot: string | null
  /** Current/default location of the session; sets carry their own. */
  locationId: Uuid | null
  locationNameSnapshot: string | null
  startedAt: IsoTimestamp
  endedAt: IsoTimestamp | null
  status: SessionStatus
  focus?: string
  notes?: string
}

export interface WorkoutExercise {
  id: Uuid
  sessionId: Uuid
  /** Exercise as planned by the routine (null for ad-hoc additions). */
  plannedExerciseId: Uuid | null
  /** Exercise actually performed. */
  performedExerciseId: Uuid
  plannedNameSnapshot: string | null
  performedNameSnapshot: string
  position: number
  status: WorkoutExerciseStatus
  /** Added although it does not belong to the session's day type (shown highlighted). */
  isForeign: boolean
  /** Exercises sharing this id form a superset: adjacent, done alternately without rest. null = not in one. */
  supersetGroupId?: Uuid | null
  substitutionReason?: string
  notes?: string
}

export interface SetRecord extends Timestamps {
  id: Uuid
  sessionId: Uuid
  workoutExerciseId: Uuid
  setNumber: number
  setType: SetType
  loadType: LoadType
  /** null = not entered. Zero is a real value, distinct from null. */
  weightValue: number | null
  weightUnit: WeightUnit
  reps: number | null
  isCompleted: boolean
  performedAt: IsoTimestamp | null
  locationId: Uuid | null
  locationNameSnapshot: string | null
  rpe?: number | null
  rir?: number | null
  durationSeconds?: number | null
  distanceValue?: number | null
  notes?: string
}

export interface AppSettings {
  key: 'app'
  units: WeightUnit
  theme: Theme
  lightStyle: LightStyle
  darkStyle: DarkStyle
  accent: AccentColor
  defaultLocationId: Uuid | null
  /** Location used by the most recent workout; pre-selected on the next one. */
  lastLocationId: Uuid | null
  onboardingDone: boolean
  /** Day type chosen for the last workout; pre-selected on the start screen. null = free. */
  lastDayTypeId: Uuid | null
  /** Whether warm-up sets count in volume, heatmap and progress statistics. They are always stored. */
  includeWarmupsInStats: boolean
  dayTypesSeeded: boolean
  lastExportAt: IsoTimestamp | null
  /** Remind about a backup after this many days; null = never. */
  backupReminderDays: number | null
  /** Start the rest timer automatically after each completed set. */
  restAutoStart: boolean
  restDefaultSeconds: number
  restVibrate: boolean
  restSound: boolean
}

export interface SchemaMetadata {
  key: 'schema'
  schemaVersion: number
  exportFormatVersion: number
  lastMigratedAt: IsoTimestamp | null
}
