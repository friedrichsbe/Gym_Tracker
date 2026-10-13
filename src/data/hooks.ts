import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from './db'
import { DEFAULT_SETTINGS, getSettings } from './settings'
import { instant } from '../domain/time'
import type { AppSettings, DayType, Exercise, Location, Routine } from '../domain/types'

/** `undefined` while the first read is in flight. */
export function useSettingsLoaded(): AppSettings | undefined {
  return useLiveQuery(() => getSettings(), [])
}

export function useSettings(): AppSettings {
  return useSettingsLoaded() ?? DEFAULT_SETTINGS
}

export function useLocations(): { active: Location[]; archived: Location[] } {
  return (
    useLiveQuery(async () => {
      const all = (await db.locations.toArray()).sort((a, b) => a.name.localeCompare(b.name))
      return { active: all.filter((l) => !l.archivedAt), archived: all.filter((l) => l.archivedAt) }
    }, []) ?? { active: [], archived: [] }
  )
}

export function useDayTypes(): { active: DayType[]; archived: DayType[] } {
  return (
    useLiveQuery(async () => {
      const all = (await db.dayTypes.toArray()).sort((a, b) => a.position - b.position)
      return { active: all.filter((d) => !d.archivedAt), archived: all.filter((d) => d.archivedAt) }
    }, []) ?? { active: [], archived: [] }
  )
}

export function useRoutines(): { active: Routine[]; archived: Routine[] } {
  return (
    useLiveQuery(async () => {
      const all = (await db.routines.toArray()).sort((a, b) => a.name.localeCompare(b.name))
      return { active: all.filter((r) => !r.archivedAt), archived: all.filter((r) => r.archivedAt) }
    }, []) ?? { active: [], archived: [] }
  )
}

export function useExercises(): Exercise[] {
  return useLiveQuery(() => db.exercises.toArray(), []) ?? []
}

/** Most recently performed exercises, newest first. */
export function useRecentExerciseIds(limit = 8): string[] {
  return (
    useLiveQuery(async () => {
      const sessions = (await db.sessions.toArray())
        .filter((s) => s.status === 'completed' || s.status === 'active')
        .sort((a, b) => instant(b.startedAt) - instant(a.startedAt))
        .slice(0, 15)
      const seen: string[] = []
      for (const s of sessions) {
        const wes = (await db.workoutExercises.where('sessionId').equals(s.id).toArray()).sort(
          (a, b) => a.position - b.position,
        )
        for (const we of wes) if (!seen.includes(we.performedExerciseId)) seen.push(we.performedExerciseId)
        if (seen.length >= limit) break
      }
      return seen.slice(0, limit)
    }, []) ?? []
  )
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
