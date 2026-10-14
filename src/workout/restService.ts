import { db } from '../data/db'
import { getSettings } from '../data/settings'

export interface RestSuggestion {
  seconds: number
  /** What the rest follows, e.g. "Leg Press" or "Pec Deck + Bench Press" for a superset round. */
  label: string
}

/**
 * How long to rest after this completed set, or null if no rest is due.
 *  - No rest after warm-up sets.
 *  - Superset: no rest between the members; rest only after the LAST member of a round
 *    (every other member has done at least as many working sets), using the longest rest of the group.
 *  - Rest per exercise: its own default, else the global default.
 * The caller decides whether to auto-start it (setting) — this only computes the suggestion.
 */
export async function getRestSuggestion(setId: string): Promise<RestSuggestion | null> {
  const set = await db.sets.get(setId)
  if (!set || !set.isCompleted || set.setType === 'warmup') return null
  const we = await db.workoutExercises.get(set.workoutExerciseId)
  if (!we) return null
  const settings = await getSettings()

  const group = we.supersetGroupId
    ? (await db.workoutExercises.where('sessionId').equals(we.sessionId).toArray())
        .filter((w) => w.supersetGroupId === we.supersetGroupId && w.status !== 'skipped')
        .sort((a, b) => a.position - b.position)
    : [we]
  const members = group.some((m) => m.id === we.id) ? group : [we, ...group]

  if (members.length > 1) {
    const done = async (id: string) =>
      (await db.sets.where('workoutExerciseId').equals(id).toArray()).filter(
        (s) => s.isCompleted && s.setType !== 'warmup',
      ).length
    const mine = await done(we.id)
    for (const m of members) if (m.id !== we.id && (await done(m.id)) < mine) return null // partner is up next
  }

  const exercises = await db.exercises.bulkGet(members.map((m) => m.performedExerciseId))
  const seconds = Math.max(...exercises.map((e) => e?.defaultRestSeconds ?? settings.restDefaultSeconds))
  return { seconds, label: members.map((m) => m.performedNameSnapshot).join(' + ') }
}
