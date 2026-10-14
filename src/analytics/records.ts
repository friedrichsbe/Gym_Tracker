import { db } from '../data/db'
import { getSettings } from '../data/settings'
import { instant } from '../domain/time'
import type { SetRecord, WeightUnit, WorkoutExercise } from '../domain/types'
import { toKg } from './analytics'

// Personal records of one workout. A record is only reported when there is earlier history to beat
// (the first time you do an exercise is a start, not a record) and only against sets from the same
// location, because loads on different machines are not directly comparable (PRD F7).

export type RecordKind = 'weight' | 'volume' | 'reps'

export interface PersonalRecord {
  exerciseId: string
  name: string
  kind: RecordKind
  /** The record-setting set, as entered. */
  weight: number | null
  unit: WeightUnit
  reps: number
  /** The value that was beaten (kg for weight/volume, reps for reps). */
  previous: number
}

export interface RecordSet {
  set: SetRecord
  exerciseId: string
  name: string
}

const weighted = (s: SetRecord) => s.loadType === 'weight' && s.weightValue != null && s.weightValue > 0

/** Pure core: `current` = sets of the workout, `prior` = earlier completed sets of the same exercises. */
export function findRecords(current: RecordSet[], prior: RecordSet[], opts: { includeWarmups: boolean }): PersonalRecord[] {
  const counts = (s: SetRecord) => s.isCompleted && (opts.includeWarmups || s.setType !== 'warmup') && (s.reps ?? 0) > 0
  const key = (r: RecordSet) => `${r.exerciseId}|${r.set.locationId ?? ''}`

  const best = new Map<string, { weight: number; volume: number; reps: number; any: boolean }>()
  for (const r of prior) {
    if (!counts(r.set)) continue
    const b = best.get(key(r)) ?? { weight: 0, volume: 0, reps: 0, any: false }
    b.any = true
    b.reps = Math.max(b.reps, r.set.reps ?? 0)
    if (weighted(r.set)) {
      const kg = toKg(r.set.weightValue!, r.set.weightUnit)
      b.weight = Math.max(b.weight, kg)
      b.volume = Math.max(b.volume, kg * (r.set.reps ?? 0))
    }
    best.set(key(r), b)
  }

  const out = new Map<string, { value: number; record: PersonalRecord }>()
  const EPS = 1e-6
  const bump = (r: RecordSet, kind: RecordKind, value: number, previous: number) => {
    const id = `${key(r)}|${kind}`
    if ((out.get(id)?.value ?? -1) >= value) return
    out.set(id, {
      value,
      record: {
        exerciseId: r.exerciseId,
        name: r.name,
        kind,
        weight: weighted(r.set) ? r.set.weightValue : null,
        unit: r.set.weightUnit,
        reps: r.set.reps ?? 0,
        previous,
      },
    })
  }

  for (const r of current) {
    if (!counts(r.set)) continue
    const b = best.get(key(r))
    if (!b?.any) continue // no earlier performance at this location: nothing to beat
    if (weighted(r.set)) {
      const kg = toKg(r.set.weightValue!, r.set.weightUnit)
      const volume = kg * (r.set.reps ?? 0)
      // A heavier set is the headline; a volume record is only reported when the weight itself was not beaten.
      if (b.weight > 0 && kg > b.weight + EPS) bump(r, 'weight', kg, b.weight)
      else if (b.volume > 0 && volume > b.volume + EPS) bump(r, 'volume', volume, b.volume)
    } else if ((r.set.reps ?? 0) > b.reps) {
      bump(r, 'reps', r.set.reps ?? 0, b.reps)
    }
  }
  return [...out.values()]
    .map((o) => o.record)
    .sort((x, y) => x.name.localeCompare(y.name) || x.kind.localeCompare(y.kind))
}

/** Records set in the given workout (running or finished) against everything logged before it. */
export async function sessionRecords(sessionId: string): Promise<PersonalRecord[]> {
  const session = await db.sessions.get(sessionId)
  if (!session) return []
  const { includeWarmupsInStats } = await getSettings()
  const instances = await db.workoutExercises.where('sessionId').equals(sessionId).toArray()
  const exerciseIds = new Set(instances.map((i) => i.performedExerciseId))
  const mine = (await db.sets.where('sessionId').equals(sessionId).toArray()).filter((s) => s.isCompleted)
  if (mine.length === 0) return []

  const instanceOf = new Map<string, WorkoutExercise>(instances.map((i) => [i.id, i]))
  const current: RecordSet[] = mine.flatMap((set) => {
    const we = instanceOf.get(set.workoutExerciseId)
    return we ? [{ set, exerciseId: we.performedExerciseId, name: we.performedNameSnapshot }] : []
  })

  const earlier = (await db.sessions.where('status').equals('completed').toArray()).filter(
    (s) => s.id !== sessionId && instant(s.startedAt) < instant(session.startedAt),
  )
  const earlierIds = new Set(earlier.map((s) => s.id))
  const priorInstances = (await db.workoutExercises.where('performedExerciseId').anyOf([...exerciseIds]).toArray()).filter(
    (i) => earlierIds.has(i.sessionId),
  )
  const priorOf = new Map(priorInstances.map((i) => [i.id, i]))
  const prior: RecordSet[] = []
  for (const i of priorInstances) {
    for (const set of await db.sets.where('workoutExerciseId').equals(i.id).toArray()) {
      const we = priorOf.get(set.workoutExerciseId)!
      prior.push({ set, exerciseId: we.performedExerciseId, name: we.performedNameSnapshot })
    }
  }
  return findRecords(current, prior, { includeWarmups: includeWarmupsInStats })
}

export const describeRecord = (r: PersonalRecord): string => {
  const load = r.weight != null ? `${r.weight} ${r.unit} × ${r.reps}` : `${r.reps} reps`
  return r.kind === 'weight' ? `Heaviest set · ${load}` : r.kind === 'volume' ? `Best set volume · ${load}` : `Most reps · ${load}`
}
