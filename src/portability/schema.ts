import { z } from 'zod'

// Export format v1. The CSV export ships its own README.txt describing every column; this schema is the JSON contract.
// Import validates everything: imported files are untrusted input.

export const FORMAT_NAME = 'gym-tracker-export'
export const FORMAT_VERSION = 1

const iso = z.string().min(10).max(40)
const id = z.string().min(1).max(100)
const text = z.string().max(5000)
const unit = z.enum(['kg', 'lb'])
const nullableId = id.nullable().default(null)
const stamps = { createdAt: iso, updatedAt: iso }

export const locationSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  notes: text.optional(),
  address: text.optional(),
  archivedAt: iso.nullable().default(null),
  ...stamps,
})

export const exerciseSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  nameKey: z.string().max(200).optional(),
  aliases: z.array(z.string().max(200)).max(50).default([]),
  equipmentType: z.enum(['machine', 'dumbbell', 'barbell', 'cable', 'bodyweight', 'other']).default('other'),
  movementPattern: z.string().max(100).optional(),
  muscleTags: z.array(z.string().max(100)).max(50).default([]),
  isCustom: z.boolean().default(false),
  archivedAt: iso.nullable().default(null),
  ...stamps,
})

export const dayTypeSchema = z.object({
  id,
  name: z.string().min(1).max(100),
  muscleTags: z.array(z.string().max(100)).max(50).default([]),
  exerciseIds: z.array(id).max(2000).default([]),
  matchAll: z.boolean().default(false),
  position: z.number().int().default(0),
  archivedAt: iso.nullable().default(null),
  ...stamps,
})

export const routineExerciseSchema = z.object({
  id,
  exerciseId: id,
  position: z.number().int().min(0),
  suggestedSets: z.number().int().min(1).nullable().default(null),
  targetRepMin: z.number().int().min(1).nullable().default(null),
  targetRepMax: z.number().int().min(1).nullable().default(null),
  supersetGroup: z.string().max(100).nullable().default(null),
  notes: text.optional(),
})

export const routineSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  dayTypeId: nullableId,
  notes: text.optional(),
  archivedAt: iso.nullable().default(null),
  ...stamps,
  exercises: z.array(routineExerciseSchema).max(500).default([]),
})

export const setSchema = z.object({
  id,
  setNumber: z.number().min(0),
  setType: z.enum(['warmup', 'working', 'drop', 'failure', 'other']).default('working'),
  loadType: z.enum(['weight', 'bodyweight', 'assisted']).default('weight'),
  weightValue: z.number().min(0).nullable().default(null),
  weightUnit: unit,
  reps: z.number().int().min(0).nullable().default(null),
  isCompleted: z.boolean(),
  performedAt: iso.nullable().default(null),
  locationId: nullableId,
  locationNameSnapshot: z.string().max(200).nullable().default(null),
  rpe: z.number().min(1).max(10).nullable().optional(),
  rir: z.number().min(0).max(10).nullable().optional(),
  durationSeconds: z.number().min(0).nullable().optional(),
  distanceValue: z.number().min(0).nullable().optional(),
  notes: text.optional(),
  ...stamps,
})

export const exerciseInstanceSchema = z.object({
  id,
  plannedExerciseId: nullableId,
  performedExerciseId: id,
  plannedNameSnapshot: z.string().max(200).nullable().default(null),
  performedNameSnapshot: z.string().min(1).max(200),
  position: z.number().int().min(0),
  status: z.enum(['planned', 'active', 'completed', 'skipped', 'substituted']).default('completed'),
  isForeign: z.boolean().default(false),
  supersetGroupId: nullableId,
  substitutionReason: text.optional(),
  notes: text.optional(),
  sets: z.array(setSchema).max(500).default([]),
})

export const sessionSchema = z.object({
  id,
  routineId: nullableId,
  routineNameSnapshot: z.string().max(200).nullable().default(null),
  dayTypeId: nullableId,
  dayTypeNameSnapshot: z.string().max(100).nullable().default(null),
  locationId: nullableId,
  locationNameSnapshot: z.string().max(200).nullable().default(null),
  startedAt: iso,
  endedAt: iso.nullable().default(null),
  status: z.enum(['active', 'completed', 'abandoned']),
  focus: z.string().max(200).optional(),
  notes: text.optional(),
  ...stamps,
  exerciseInstances: z.array(exerciseInstanceSchema).max(200).default([]),
})

export const settingsSchema = z
  .object({
    units: unit,
    // 'midnight' was briefly a theme of its own; it is now a dark style.
    theme: z.preprocess((v) => (v === 'midnight' ? 'dark' : v), z.enum(['system', 'light', 'dark'])),
    lightStyle: z.enum(['light', 'glow']),
    darkStyle: z.enum(['dark', 'midnight']),
    accent: z.enum(['teal', 'blue', 'orchid', 'forest', 'ember', 'rose', 'graphite']),
    defaultLocationId: nullableId,
    lastLocationId: nullableId,
    lastDayTypeId: nullableId,
    includeWarmupsInStats: z.boolean(),
    backupReminderDays: z.number().int().min(1).max(365).nullable(),
  })
  .partial()

export const exportSchema = z.object({
  format: z.literal(FORMAT_NAME),
  formatVersion: z.number().int().min(1),
  schemaVersion: z.number().int().optional(),
  appVersion: z.string().optional(),
  exportedAt: iso,
  units: z.object({ weight: unit }).optional(),
  settings: settingsSchema.optional(),
  locations: z.array(locationSchema).max(5000).default([]),
  exercises: z.array(exerciseSchema).max(20000).default([]),
  dayTypes: z.array(dayTypeSchema).max(200).default([]),
  routines: z.array(routineSchema).max(5000).default([]),
  sessions: z.array(sessionSchema).max(100000).default([]),
})

export type ExportFile = z.infer<typeof exportSchema>
