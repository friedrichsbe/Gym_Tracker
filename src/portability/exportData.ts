import { db, SCHEMA_VERSION } from '../data/db'
import { getSettings, updateSettings } from '../data/settings'
import { groupBy } from '../domain/collections'
import { nowIso } from '../domain/time'
import { FORMAT_NAME, FORMAT_VERSION, type ExportFile } from './schema'
import { buildZip, csvLine } from './zip'

/** Builds the complete, documented JSON export (formatVersion 1). */
export async function buildExport(): Promise<ExportFile> {
  const [
    locations,
    exercises,
    dayTypes,
    routines,
    routineExercises,
    sessions,
    workoutExercises,
    sets,
    cardio,
    settings,
  ] = await Promise.all([
    db.locations.toArray(),
    db.exercises.toArray(),
    db.dayTypes.toArray(),
    db.routines.toArray(),
    db.routineExercises.toArray(),
    db.sessions.toArray(),
    db.workoutExercises.toArray(),
    db.sets.toArray(),
    db.cardio.toArray(),
    getSettings(),
  ])
  const setsByInstance = groupBy(sets, (s) => s.workoutExerciseId)
  const instancesBySession = groupBy(workoutExercises, (w) => w.sessionId)
  const cardioBySession = groupBy(cardio, (c) => c.sessionId)
  const exercisesByRoutine = groupBy(routineExercises, (r) => r.routineId)

  return {
    format: FORMAT_NAME,
    formatVersion: FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    units: { weight: settings.units },
    settings: {
      units: settings.units,
      theme: settings.theme,
      lightStyle: settings.lightStyle,
      darkStyle: settings.darkStyle,
      accent: settings.accent,
      navLabels: settings.navLabels,
      defaultLocationId: settings.defaultLocationId,
      lastLocationId: settings.lastLocationId,
      lastDayTypeId: settings.lastDayTypeId,
      includeWarmupsInStats: settings.includeWarmupsInStats,
      backupReminderDays: settings.backupReminderDays,
      restAutoStart: settings.restAutoStart,
      restDefaultSeconds: settings.restDefaultSeconds,
      restVibrate: settings.restVibrate,
      restSound: settings.restSound,
      autoAddNextSet: settings.autoAddNextSet,
      swipeHistoryLeft: settings.swipeHistoryLeft,
      swipeHistoryRight: settings.swipeHistoryRight,
      swipePresetLeft: settings.swipePresetLeft,
      swipePresetRight: settings.swipePresetRight,
    },
    locations,
    exercises,
    dayTypes,
    routines: routines.map((r) => ({
      ...r,
      exercises: (exercisesByRoutine.get(r.id) ?? [])
        .sort((a, b) => a.position - b.position)
        .map(({ routineId: _routineId, ...rest }) => ({ ...rest, supersetGroup: rest.supersetGroup ?? null })),
    })),
    sessions: sessions
      .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
      .map((s) => ({
        ...s,
        exerciseInstances: (instancesBySession.get(s.id) ?? [])
          .sort((a, b) => a.position - b.position)
          .map(({ sessionId: _sessionId, ...we }) => ({
            ...we,
            supersetGroupId: we.supersetGroupId ?? null,
            sets: (setsByInstance.get(we.id) ?? [])
              .sort((a, b) => a.setNumber - b.setNumber)
              .map(({ sessionId: _s, workoutExerciseId: _w, ...set }) => set),
          })),
        cardio: (cardioBySession.get(s.id) ?? [])
          .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
          .map(({ sessionId: _sessionId, ...c }) => c),
      })),
  }
}

/** The same file format, reduced to one workout plus the exercises, locations and day it refers to. */
export function onlySession(d: ExportFile, sessionId: string): ExportFile {
  const sessions = d.sessions.filter((s) => s.id === sessionId)
  const instances = sessions.flatMap((s) => s.exerciseInstances)
  const exerciseIds = new Set(instances.flatMap((i) => [i.performedExerciseId, i.plannedExerciseId ?? '']))
  const locationIds = new Set([
    ...sessions.map((s) => s.locationId ?? ''),
    ...instances.flatMap((i) => i.sets.map((x) => x.locationId ?? '')),
  ])
  const dayIds = new Set(sessions.map((s) => s.dayTypeId ?? ''))
  return {
    ...d,
    exercises: d.exercises.filter((e) => exerciseIds.has(e.id)),
    locations: d.locations.filter((l) => locationIds.has(l.id)),
    dayTypes: d.dayTypes.filter((t) => dayIds.has(t.id)),
    routines: [],
    sessions,
  }
}

const stamp = () => nowIso().slice(0, 10)

export async function exportJsonFile(
  prefix = 'gym-tracker-backup',
  opts: { sessionId?: string } = {},
): Promise<{ blob: Blob; filename: string }> {
  const full = await buildExport()
  const data = opts.sessionId ? onlySession(full, opts.sessionId) : full
  return {
    blob: new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    filename: `${prefix}-${stamp()}.json`,
  }
}

const CSV_README = `Gym Tracker — CSV export (format version ${FORMAT_VERSION})
=====================================================

Encoding UTF-8, comma separated, RFC 4180 quoting (fields with comma/quote/newline are wrapped in "" and quotes doubled).
Decimal separator is always ".". Empty field = null / not set. Booleans are "true" / "false".
Timestamps are ISO 8601 with the local UTC offset at the time of logging, e.g. 2026-10-13T17:00:00.000+02:00.
All ids are stable UUIDs; use them to join the files. The JSON export contains exactly the same data in nested form.

The performed SET is the unit of record. Weight is stored exactly as entered together with its unit; units are never converted.

Files
-----
sets.csv               one row per set (the file you usually want)
  set_id, session_id, workout_exercise_id, session_started_at, set_number,
  set_type            warmup | working | drop | failure | other
  load_type           weight | bodyweight | assisted   (bodyweight: weight_value = optional added weight; assisted: weight_value = assistance)
  weight_value        number or empty (empty = unknown, 0 = really zero)
  weight_unit         kg | lb
  reps, is_completed, performed_at, location_id, location_name (name at the time of the set),
  exercise_id, exercise_name (performed exercise), planned_exercise_id, planned_exercise_name,
  rpe, rir, notes
sessions.csv           one row per workout: id, started_at, ended_at, status (active|completed|abandoned), day_type_id, day_type_name,
                       routine_id, routine_name, location_id, location_name, focus, notes
workout_exercises.csv  exercise instances within a workout: id, session_id, position, planned_exercise_id, performed_exercise_id,
                       planned_name, performed_name, status (planned|active|completed|skipped|substituted),
                       is_foreign (true = added although outside the workout's day type),
                       superset_group_id (exercises with the same id were done as a superset: alternating sets, no rest between), substitution_reason, notes
cardio.csv             cardio blocks: id, session_id, session_started_at, kind (treadmill|stairmaster|elliptical|bike), slot (start|end = before/after the strength part),
                       started_at, ended_at, duration_seconds, distance_km, floors, level (machine level/resistance), incline_pct; empty = not entered
exercises.csv          catalogue: id, name, aliases (separated by "|"), equipment_type, movement_pattern, muscle_tags ("|"), is_custom, default_rest_seconds (rest timer, empty = global default), archived_at
locations.csv          id, name, notes, address, archived_at
day_types.csv          id, name, muscle_tags ("|"), exercise_ids ("|"), match_all, position, archived_at
routines.csv           id, name, day_type_id, notes, archived_at
routine_exercises.csv  id, routine_id, exercise_id, position, suggested_sets, target_rep_min, target_rep_max, superset_group, notes
`

export async function exportCsvZip(opts: { sessionId?: string } = {}): Promise<{ blob: Blob; filename: string }> {
  const full = await buildExport()
  const d = opts.sessionId ? onlySession(full, opts.sessionId) : full
  const exName = new Map(d.exercises.map((e) => [e.id, e.name]))
  const rows = (header: string[], body: unknown[][]) => [csvLine(header), ...body.map(csvLine)].join('\r\n') + '\r\n'
  const enc = new TextEncoder()

  const sessions = d.sessions
  const instances = sessions.flatMap((s) => s.exerciseInstances.map((we) => ({ s, we })))
  const files: Record<string, string> = {
    'README.txt': CSV_README,
    'sets.csv': rows(
      [
        'set_id',
        'session_id',
        'workout_exercise_id',
        'session_started_at',
        'set_number',
        'set_type',
        'load_type',
        'weight_value',
        'weight_unit',
        'reps',
        'is_completed',
        'performed_at',
        'location_id',
        'location_name',
        'exercise_id',
        'exercise_name',
        'planned_exercise_id',
        'planned_exercise_name',
        'rpe',
        'rir',
        'notes',
      ],
      instances.flatMap(({ s, we }) =>
        we.sets.map((x) => [
          x.id,
          s.id,
          we.id,
          s.startedAt,
          x.setNumber,
          x.setType,
          x.loadType,
          x.weightValue,
          x.weightUnit,
          x.reps,
          x.isCompleted,
          x.performedAt,
          x.locationId,
          x.locationNameSnapshot,
          we.performedExerciseId,
          we.performedNameSnapshot,
          we.plannedExerciseId,
          we.plannedNameSnapshot,
          x.rpe,
          x.rir,
          x.notes,
        ]),
      ),
    ),
    'sessions.csv': rows(
      [
        'id',
        'started_at',
        'ended_at',
        'status',
        'day_type_id',
        'day_type_name',
        'routine_id',
        'routine_name',
        'location_id',
        'location_name',
        'focus',
        'notes',
      ],
      sessions.map((s) => [
        s.id,
        s.startedAt,
        s.endedAt,
        s.status,
        s.dayTypeId,
        s.dayTypeNameSnapshot,
        s.routineId,
        s.routineNameSnapshot,
        s.locationId,
        s.locationNameSnapshot,
        s.focus,
        s.notes,
      ]),
    ),
    'workout_exercises.csv': rows(
      [
        'id',
        'session_id',
        'position',
        'planned_exercise_id',
        'performed_exercise_id',
        'planned_name',
        'performed_name',
        'status',
        'is_foreign',
        'superset_group_id',
        'substitution_reason',
        'notes',
      ],
      instances.map(({ s, we }) => [
        we.id,
        s.id,
        we.position,
        we.plannedExerciseId,
        we.performedExerciseId,
        we.plannedNameSnapshot,
        we.performedNameSnapshot,
        we.status,
        we.isForeign,
        we.supersetGroupId,
        we.substitutionReason,
        we.notes,
      ]),
    ),
    'cardio.csv': rows(
      [
        'id',
        'session_id',
        'session_started_at',
        'kind',
        'slot',
        'started_at',
        'ended_at',
        'duration_seconds',
        'distance_km',
        'floors',
        'level',
        'incline_pct',
      ],
      sessions.flatMap((s) =>
        s.cardio.map((c) => [
          c.id,
          s.id,
          s.startedAt,
          c.kind,
          c.slot,
          c.startedAt,
          c.endedAt,
          c.durationSeconds,
          c.distanceKm,
          c.floors,
          c.level,
          c.inclinePct,
        ]),
      ),
    ),
    'exercises.csv': rows(
      [
        'id',
        'name',
        'aliases',
        'equipment_type',
        'movement_pattern',
        'muscle_tags',
        'is_custom',
        'default_rest_seconds',
        'archived_at',
      ],
      d.exercises.map((e) => [
        e.id,
        e.name,
        e.aliases.join('|'),
        e.equipmentType,
        e.movementPattern,
        e.muscleTags.join('|'),
        e.isCustom,
        e.defaultRestSeconds,
        e.archivedAt,
      ]),
    ),
    'locations.csv': rows(
      ['id', 'name', 'notes', 'address', 'archived_at'],
      d.locations.map((l) => [l.id, l.name, l.notes, l.address, l.archivedAt]),
    ),
    'day_types.csv': rows(
      ['id', 'name', 'muscle_tags', 'exercise_ids', 'match_all', 'position', 'archived_at'],
      d.dayTypes.map((t) => [
        t.id,
        t.name,
        t.muscleTags.join('|'),
        t.exerciseIds.join('|'),
        t.matchAll,
        t.position,
        t.archivedAt,
      ]),
    ),
    'routines.csv': rows(
      ['id', 'name', 'day_type_id', 'notes', 'archived_at'],
      d.routines.map((r) => [r.id, r.name, r.dayTypeId, r.notes, r.archivedAt]),
    ),
    'routine_exercises.csv': rows(
      [
        'id',
        'routine_id',
        'exercise_id',
        'position',
        'suggested_sets',
        'target_rep_min',
        'target_rep_max',
        'superset_group',
        'notes',
        'exercise_name',
      ],
      d.routines.flatMap((r) =>
        r.exercises.map((x) => [
          x.id,
          r.id,
          x.exerciseId,
          x.position,
          x.suggestedSets,
          x.targetRepMin,
          x.targetRepMax,
          x.supersetGroup,
          x.notes,
          exName.get(x.exerciseId),
        ]),
      ),
    ),
  }
  const zip = buildZip(Object.entries(files).map(([name, content]) => ({ name, data: enc.encode(content) })))
  return {
    blob: new Blob([zip as BlobPart], { type: 'application/zip' }),
    filename: `${opts.sessionId ? 'gym-tracker-workout' : 'gym-tracker-csv'}-${stamp()}.zip`,
  }
}

/** Hands the file to the browser. Records the export date only after the file was actually produced. */
export async function deliver(
  file: { blob: Blob; filename: string },
  opts: {
    share?: boolean
    /** false for partial exports: they must not silence the backup reminder. */ isBackup?: boolean
  } = {},
): Promise<'shared' | 'downloaded'> {
  const f = new File([file.blob], file.filename, { type: file.blob.type })
  let result: 'shared' | 'downloaded' = 'downloaded'
  if (opts.share && navigator.canShare?.({ files: [f] })) {
    await navigator.share({ files: [f], title: file.filename })
    result = 'shared'
  } else {
    const url = URL.createObjectURL(file.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  if (opts.isBackup !== false) await updateSettings({ lastExportAt: nowIso() })
  return result
}
