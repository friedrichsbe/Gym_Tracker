import { db } from '../data/db'
import { newId, nowIso } from '../domain/time'
import type { EquipmentType, Exercise } from '../domain/types'
import { STARTER_EXERCISES } from './seed'

/** Lowercase, strip diacritics (ä→a), collapse whitespace/punctuation. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function editDistanceAtMost1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else {
      i++
      j++
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/**
 * Score an exercise against a query; 0 = no match. Higher is better.
 * Matches name, aliases, muscles and equipment; tolerates one typo per token (len ≥ 4).
 */
export function scoreExercise(exercise: Exercise, query: string): number {
  const q = normalize(query)
  if (!q) return 1
  const name = exercise.nameKey
  const aliases = exercise.aliases.map(normalize)
  const meta = [...exercise.muscleTags, exercise.equipmentType, exercise.movementPattern ?? ''].map(normalize)
  if (name === q || aliases.includes(q)) return 100
  if (name.startsWith(q)) return 80
  if (aliases.some((a) => a.startsWith(q))) return 70

  let total = 0
  for (const token of q.split(' ')) {
    const words = [...name.split(' '), ...aliases.flatMap((a) => a.split(' '))]
    let s = 0
    if (words.some((w) => w.startsWith(token))) s = 30
    else if (name.includes(token) || aliases.some((a) => a.includes(token))) s = 20
    else if (meta.some((m) => m.includes(token))) s = 10
    else if (
      token.length >= 4 &&
      words.some((w) => editDistanceAtMost1(token, w.slice(0, token.length + 1)) || editDistanceAtMost1(token, w))
    )
      s = 8
    if (s === 0) return 0
    total += s
  }
  return total
}

export function searchExercises(all: Exercise[], query: string): Exercise[] {
  return all
    .filter((e) => !e.archivedAt)
    .map((e) => ({ e, s: scoreExercise(e, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name))
    .map((x) => x.e)
}

export async function listExercises(): Promise<Exercise[]> {
  return db.exercises.toArray()
}

/** Finds an existing active exercise whose name or alias equals `name` (duplicate guard). */
export async function findDuplicate(name: string): Promise<Exercise | undefined> {
  const key = normalize(name)
  if (!key) return undefined
  const all = await db.exercises.toArray()
  return all.find((e) => !e.archivedAt && (e.nameKey === key || e.aliases.some((a) => normalize(a) === key)))
}

export async function createCustomExercise(input: {
  name: string
  equipmentType?: EquipmentType
  aliases?: string[]
}): Promise<{ exercise: Exercise; created: boolean }> {
  const name = input.name.trim()
  if (!name) throw new Error('Exercise name is required')
  const duplicate = await findDuplicate(name)
  if (duplicate) return { exercise: duplicate, created: false }
  const now = nowIso()
  const exercise: Exercise = {
    id: newId(),
    name,
    nameKey: normalize(name),
    aliases: input.aliases ?? [],
    equipmentType: input.equipmentType ?? 'other',
    muscleTags: [],
    isCustom: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.exercises.add(exercise)
  return { exercise, created: true }
}

export async function renameExercise(id: string, name: string): Promise<void> {
  // History keeps working because sets reference the id and sessions snapshot the old name.
  await db.exercises.update(id, { name: name.trim(), nameKey: normalize(name), updatedAt: nowIso() })
}

export async function archiveExercise(id: string): Promise<void> {
  const now = nowIso()
  await db.exercises.update(id, { archivedAt: now, updatedAt: now })
}

/** Adds the starter catalogue, skipping anything that already exists by name. */
export async function seedStarterExercises(): Promise<number> {
  const existing = new Set((await db.exercises.toArray()).map((e) => e.nameKey))
  const now = nowIso()
  const rows: Exercise[] = STARTER_EXERCISES.filter(([name]) => !existing.has(normalize(name))).map(
    ([name, equipmentType, movementPattern, muscleTags, aliases]) => ({
      id: newId(),
      name,
      nameKey: normalize(name),
      aliases,
      equipmentType,
      movementPattern,
      muscleTags,
      isCustom: false,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }),
  )
  await db.exercises.bulkAdd(rows)
  return rows.length
}
