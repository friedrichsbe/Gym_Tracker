import { db } from '../data/db'
import { newId, nowIso } from '../domain/time'
import type { EquipmentType, Exercise } from '../domain/types'
import { STARTER_EXERCISES, starterAliases } from './seed'

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
  muscleTags?: string[]
  movementPattern?: string
  defaultRestSeconds?: number | null
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
    muscleTags: input.muscleTags ?? [],
    movementPattern: input.movementPattern,
    defaultRestSeconds: input.defaultRestSeconds ?? null,
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
  const rows: Exercise[] = STARTER_EXERCISES.filter(([name]) => !existing.has(normalize(name))).map((row) => {
    const [name, equipmentType, movementPattern, muscleTags] = row
    return {
      id: newId(),
      name,
      nameKey: normalize(name),
      aliases: starterAliases(row),
      equipmentType,
      movementPattern,
      muscleTags,
      isCustom: false,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }
  })
  await db.exercises.bulkAdd(rows)
  return rows.length
}

// ---------------------------------------------------------------------------
// Catalogue management
// ---------------------------------------------------------------------------

export interface ExerciseUsage {
  workouts: number
  sets: number
  presets: number
}

/** How often each exercise appears in workouts, completed sets and presets. */
export async function exerciseUsage(): Promise<Map<string, ExerciseUsage>> {
  const [instances, sets, routineExercises] = await Promise.all([
    db.workoutExercises.toArray(),
    db.sets.toArray(),
    db.routineExercises.toArray(),
  ])
  const out = new Map<string, ExerciseUsage>()
  const get = (id: string) => {
    let u = out.get(id)
    if (!u) out.set(id, (u = { workouts: 0, sets: 0, presets: 0 }))
    return u
  }
  const instanceExercise = new Map(instances.map((i) => [i.id, i.performedExerciseId]))
  const seen = new Set<string>()
  for (const i of instances) {
    const key = `${i.performedExerciseId}|${i.sessionId}`
    if (!seen.has(key)) {
      seen.add(key)
      get(i.performedExerciseId).workouts++
    }
  }
  for (const st of sets) {
    const ex = instanceExercise.get(st.workoutExerciseId)
    if (ex && st.isCompleted) get(ex).sets++
  }
  for (const r of routineExercises) get(r.exerciseId).presets++
  return out
}

function cleanAliases(aliases: string[], name: string): string[] {
  const seen = new Set([normalize(name)])
  const out: string[] = []
  for (const a of aliases.map((x) => x.trim()).filter(Boolean)) {
    const k = normalize(a)
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(a)
  }
  return out
}

/**
 * Edit an exercise. Past workouts keep working: sets point at the id and sessions keep their own name
 * snapshot, so a rename never rewrites history (use merge to unify two entries).
 */
export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  await db.exercises.update(id, { favorite: favorite || undefined, updatedAt: nowIso() })
}

export async function updateExercise(
  id: string,
  patch: {
    name?: string
    aliases?: string[]
    equipmentType?: EquipmentType
    muscleTags?: string[]
    movementPattern?: string | null
    defaultRestSeconds?: number | null
  },
): Promise<void> {
  await db.transaction('rw', db.exercises, async () => {
    const current = await db.exercises.get(id)
    if (!current) throw new Error('Exercise not found')
    const name = patch.name !== undefined ? patch.name.trim() : current.name
    if (!name) throw new Error('Exercise name is required')
    const key = normalize(name)
    // Only a NEW name can clash. Existing duplicates (e.g. after an import) must stay editable — merge fixes them.
    if (key !== current.nameKey) {
      const clash = (await db.exercises.toArray()).find(
        (e) => e.id !== id && !e.archivedAt && (e.nameKey === key || e.aliases.some((a) => normalize(a) === key)),
      )
      if (clash) throw new Error(`"${name}" already exists (as "${clash.name}"). Use merge to combine them.`)
    }
    const rest = patch.defaultRestSeconds
    if (rest != null && (!Number.isInteger(rest) || rest < 5 || rest > 1800)) {
      throw new Error('Rest must be 5–1800 seconds')
    }
    await db.exercises.update(id, {
      name,
      nameKey: key,
      aliases: cleanAliases(patch.aliases ?? current.aliases, name),
      equipmentType: patch.equipmentType ?? current.equipmentType,
      muscleTags: patch.muscleTags ?? current.muscleTags,
      movementPattern: patch.movementPattern === null ? undefined : (patch.movementPattern ?? current.movementPattern),
      defaultRestSeconds:
        patch.defaultRestSeconds === undefined ? (current.defaultRestSeconds ?? null) : patch.defaultRestSeconds,
      updatedAt: nowIso(),
    })
  })
}

export async function unarchiveExercise(id: string): Promise<void> {
  const ex = await db.exercises.get(id)
  if (!ex) return
  const clash = (await db.exercises.toArray()).find((e) => e.id !== id && !e.archivedAt && e.nameKey === ex.nameKey)
  if (clash) throw new Error(`An active exercise called "${clash.name}" exists already`)
  await db.exercises.update(id, { archivedAt: null, updatedAt: nowIso() })
}

export interface MergeImpact {
  instances: number
  sets: number
  presets: number
  days: number
}

export async function previewMerge(sourceId: string): Promise<MergeImpact> {
  const instances = await db.workoutExercises
    .filter((i) => i.performedExerciseId === sourceId || i.plannedExerciseId === sourceId)
    .toArray()
  const ids = new Set(instances.map((i) => i.id))
  const setCount = (await db.sets.toArray()).filter((s) => ids.has(s.workoutExerciseId)).length
  return {
    instances: instances.length,
    sets: setCount,
    presets: await db.routineExercises.filter((r) => r.exerciseId === sourceId).count(),
    days: (await db.dayTypes.toArray()).filter((d) => d.exerciseIds.includes(sourceId)).length,
  }
}

/**
 * Folds a duplicate into the exercise to keep: every workout, preset and training day that used the
 * duplicate now uses the target (their name snapshots follow, since it is the same exercise), the
 * duplicate's name and aliases become aliases of the target, and the duplicate is archived — never deleted.
 */
export async function mergeExercises(sourceId: string, targetId: string): Promise<MergeImpact> {
  if (sourceId === targetId) throw new Error('Choose a different exercise to merge into')
  const tables = [db.exercises, db.workoutExercises, db.sets, db.routineExercises, db.dayTypes]
  return db.transaction('rw', tables, async () => {
    const [source, target] = await Promise.all([db.exercises.get(sourceId), db.exercises.get(targetId)])
    if (!source || !target) throw new Error('Exercise not found')
    if (target.archivedAt) throw new Error('Cannot merge into an archived exercise')
    const impact = await previewMerge(sourceId)

    const instances = await db.workoutExercises
      .filter((i) => i.performedExerciseId === sourceId || i.plannedExerciseId === sourceId)
      .toArray()
    await db.workoutExercises.bulkPut(
      instances.map((i) => ({
        ...i,
        ...(i.performedExerciseId === sourceId
          ? { performedExerciseId: targetId, performedNameSnapshot: target.name }
          : {}),
        ...(i.plannedExerciseId === sourceId ? { plannedExerciseId: targetId, plannedNameSnapshot: target.name } : {}),
      })),
    )
    const items = await db.routineExercises.filter((r) => r.exerciseId === sourceId).toArray()
    await db.routineExercises.bulkPut(items.map((r) => ({ ...r, exerciseId: targetId })))
    for (const d of await db.dayTypes.toArray()) {
      if (!d.exerciseIds.includes(sourceId)) continue
      await db.dayTypes.update(d.id, {
        exerciseIds: [...new Set(d.exerciseIds.map((x) => (x === sourceId ? targetId : x)))],
        updatedAt: nowIso(),
      })
    }
    const now = nowIso()
    await db.exercises.update(targetId, {
      aliases: cleanAliases([...target.aliases, source.name, ...source.aliases], target.name),
      muscleTags: [...new Set([...target.muscleTags, ...source.muscleTags])],
      updatedAt: now,
    })
    await db.exercises.update(sourceId, { archivedAt: now, updatedAt: now })
    return impact
  })
}

/**
 * Brings the German/English names of the standard exercises up to date for installs that seeded an older list.
 * Purely additive: the user's own aliases stay, nothing is removed, and an alias that already belongs to another
 * exercise is skipped so searching never gets ambiguous. Returns how many exercises gained aliases.
 */
export async function refreshStarterAliases(): Promise<number> {
  return db.transaction('rw', db.exercises, async () => {
    const all = await db.exercises.toArray()
    const taken = new Map<string, string>() // normalized name/alias -> exercise id
    for (const e of all.filter((x) => !x.archivedAt))
      for (const k of [e.nameKey, ...e.aliases.map(normalize)]) if (!taken.has(k)) taken.set(k, e.id)
    let changed = 0
    for (const row of STARTER_EXERCISES) {
      const ex = all.find((e) => !e.isCustom && !e.archivedAt && e.nameKey === normalize(row[0]))
      if (!ex) continue
      const have = new Set(ex.aliases.map(normalize))
      const add = starterAliases(row).filter((a) => {
        const k = normalize(a)
        if (!k || k === ex.nameKey || have.has(k)) return false
        const owner = taken.get(k)
        return owner === undefined || owner === ex.id
      })
      if (add.length === 0) continue
      for (const a of add) taken.set(normalize(a), ex.id)
      await db.exercises.update(ex.id, { aliases: [...ex.aliases, ...add], updatedAt: nowIso() })
      changed++
    }
    return changed
  })
}
