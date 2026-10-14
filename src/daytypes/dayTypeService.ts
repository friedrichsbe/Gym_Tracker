import { db } from '../data/db'
import { getSettings, updateSettings } from '../data/settings'
import { newId, nowIso } from '../domain/time'
import type { DayType, Exercise } from '../domain/types'

import { DEFAULT_SPLIT_ID, SPLITS } from './splits'

/** Every muscle tag used by the starter catalogue (for the day-type editor chips). */
export const KNOWN_MUSCLES = [...new Set(SPLITS.flatMap((sp) => sp.days.flatMap((d) => d.muscleTags)))].sort()

/**
 * Does an exercise belong to a day? `extraIds` are exercises that count implicitly,
 * e.g. everything in the routine the session was started from.
 */
export function fitsDay(exercise: Exercise, day: DayType | null | undefined, extraIds?: ReadonlySet<string>): boolean {
  if (!day || day.matchAll) return true
  if (day.exerciseIds.includes(exercise.id) || extraIds?.has(exercise.id)) return true
  return exercise.muscleTags.some((t) => day.muscleTags.includes(t))
}

/**
 * Switches the training split. Days that exist already (even archived ones) are reused by name, so presets and
 * the user's own muscle mapping survive; days not part of the new split are archived, never deleted, and old
 * workouts keep their day name. Safe to switch back and forth.
 */
export async function applySplit(splitId: string): Promise<void> {
  const split = SPLITS.find((sp) => sp.id === splitId)
  if (!split) throw new Error('Unknown split')
  await db.transaction('rw', db.dayTypes, db.settings, async () => {
    const all = await db.dayTypes.toArray()
    const now = nowIso()
    const keep = new Set<string>()
    for (const [position, def] of split.days.entries()) {
      const existing = all.find((d) => d.name.toLowerCase() === def.name.toLowerCase())
      if (existing) {
        keep.add(existing.id)
        await db.dayTypes.update(existing.id, { archivedAt: null, position, updatedAt: now })
      } else {
        const id = newId()
        keep.add(id)
        await db.dayTypes.add({
          id,
          name: def.name,
          muscleTags: def.muscleTags,
          exerciseIds: [],
          matchAll: def.matchAll ?? false,
          position,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        })
      }
    }
    for (const d of all)
      if (!keep.has(d.id) && !d.archivedAt) await db.dayTypes.update(d.id, { archivedAt: now, updatedAt: now })
    await updateSettings({ dayTypesSeeded: true })
  })
}

/** First run: seeds the default split once. Deleting days later must not bring them back. */
export async function ensureDefaultDayTypes(): Promise<void> {
  const settings = await getSettings()
  if (settings.dayTypesSeeded) return
  if ((await db.dayTypes.count()) === 0) await applySplit(DEFAULT_SPLIT_ID)
  else await updateSettings({ dayTypesSeeded: true })
}

export async function createDayType(input: {
  name: string
  muscleTags?: string[]
  matchAll?: boolean
}): Promise<DayType> {
  const name = input.name.trim()
  if (!name) throw new Error('Name is required')
  const all = await db.dayTypes.toArray()
  if (all.some((d) => !d.archivedAt && d.name.toLowerCase() === name.toLowerCase()))
    throw new Error(`"${name}" already exists`)
  const now = nowIso()
  const day: DayType = {
    id: newId(),
    name,
    muscleTags: input.muscleTags ?? [],
    exerciseIds: [],
    matchAll: input.matchAll ?? false,
    position: Math.max(-1, ...all.map((d) => d.position)) + 1,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.dayTypes.add(day)
  return day
}

export async function updateDayType(
  id: string,
  patch: Partial<Pick<DayType, 'name' | 'muscleTags' | 'matchAll' | 'exerciseIds'>>,
): Promise<void> {
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('Name is required')
  await db.dayTypes.update(id, {
    ...patch,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    updatedAt: nowIso(),
  })
}

/** Archive rather than delete: old sessions keep their day-type snapshot anyway. */
export async function archiveDayType(id: string): Promise<void> {
  const now = nowIso()
  await db.dayTypes.update(id, { archivedAt: now, updatedAt: now })
}

export async function unarchiveDayType(id: string): Promise<void> {
  await db.dayTypes.update(id, { archivedAt: null, updatedAt: nowIso() })
}

export async function moveDayType(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.dayTypes, async () => {
    const list = (await db.dayTypes.toArray()).filter((d) => !d.archivedAt).sort((a, b) => a.position - b.position)
    const i = list.findIndex((d) => d.id === id)
    const j = i + direction
    if (i < 0 || j < 0 || j >= list.length) return
    await db.dayTypes.bulkPut([
      { ...list[i], position: list[j].position },
      { ...list[j], position: list[i].position },
    ])
  })
}

/** "Always count this exercise as <day>" — used after adding an outside exercise. */
export async function addExerciseToDayType(dayTypeId: string, exerciseId: string): Promise<void> {
  const day = await db.dayTypes.get(dayTypeId)
  if (!day || day.exerciseIds.includes(exerciseId)) return
  await db.dayTypes.update(dayTypeId, { exerciseIds: [...day.exerciseIds, exerciseId], updatedAt: nowIso() })
}

export async function removeExerciseFromDayType(dayTypeId: string, exerciseId: string): Promise<void> {
  const day = await db.dayTypes.get(dayTypeId)
  if (!day) return
  await db.dayTypes.update(dayTypeId, {
    exerciseIds: day.exerciseIds.filter((x) => x !== exerciseId),
    updatedAt: nowIso(),
  })
}

/**
 * Sets exactly which training days an exercise is assigned to (explicitly). Days not in the list lose the
 * assignment; days the exercise still fits through its muscle groups are unaffected by this. Works for archived
 * days too, so the assignment stays complete when the user later switches to another split.
 */
export async function setExerciseDays(exerciseId: string, dayTypeIds: string[]): Promise<void> {
  const want = new Set(dayTypeIds)
  await db.transaction('rw', db.dayTypes, async () => {
    for (const day of await db.dayTypes.toArray()) {
      if (day.matchAll) continue // fits everything anyway
      const has = day.exerciseIds.includes(exerciseId)
      if (has === want.has(day.id)) continue
      await db.dayTypes.update(day.id, {
        exerciseIds: has ? day.exerciseIds.filter((x) => x !== exerciseId) : [...day.exerciseIds, exerciseId],
        updatedAt: nowIso(),
      })
    }
  })
}
