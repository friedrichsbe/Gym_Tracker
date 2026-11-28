import { db } from '../data/db'
import { instant } from '../domain/time'
import type { WeightUnit, WorkoutSession } from '../domain/types'
import { summarizeSession } from '../workout/workoutService'

/**
 * What the Android "last workout" widget shows. Plain data only (no Capacitor here) so it is testable on the web.
 * Bump `v` when the shape changes; the widget ignores payloads it does not understand.
 */
export interface LastWorkoutPayload {
  v: 1
  /** Title as History shows it: "Day type · Preset", or "Workout". */
  name: string
  /** End of the workout, epoch ms. The widget turns it into "2 days ago" at render time. */
  endedAt: number
  durationSeconds: number | null
  sets: number
  exercises: number
  /** Total volume in the unit with the most volume; null when no weighted sets. */
  volume: number | null
  unit: WeightUnit | null
}

const finishedAt = (s: WorkoutSession) => instant(s.endedAt ?? s.startedAt)

export async function lastCompletedSession(): Promise<WorkoutSession | undefined> {
  const done = await db.sessions.where('status').equals('completed').toArray()
  return done.sort((a, b) => finishedAt(b) - finishedAt(a))[0]
}

export async function buildWidgetPayload(): Promise<LastWorkoutPayload | null> {
  const session = await lastCompletedSession()
  if (!session) return null
  const summary = await summarizeSession(session.id)
  const [unit, volume] = (Object.entries(summary.volume) as [WeightUnit, number][]).sort((a, b) => b[1] - a[1])[0] ?? []
  return {
    v: 1,
    name: [session.dayTypeNameSnapshot, session.routineNameSnapshot].filter(Boolean).join(' · ') || 'Workout',
    endedAt: finishedAt(session),
    durationSeconds: summary.durationSeconds,
    sets: summary.completedSets,
    exercises: summary.exercisesDone,
    volume: volume != null ? Math.round(volume) : null,
    unit: unit ?? null,
  }
}
