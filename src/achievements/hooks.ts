import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useSyncExternalStore } from 'react'
import { db } from '../data/db'
import { useSettingsLoaded } from '../data/hooks'
import { instant } from '../domain/time'
import {
  allUnlocks,
  hallOfFame,
  loadAchievementData,
  sessionTotals,
  trackProgress,
  type HallOfFame,
  type TrackProgress,
  type Unlock,
} from './achievements'

export interface Achievements {
  tracks: TrackProgress[]
  /** Newest first. */
  unlocks: Unlock[]
  totalLevel: number
  hall: HallOfFame
}

/** `undefined` while loading. Recomputed whenever a workout changes. */
export function useAchievements(): Achievements | undefined {
  const settings = useSettingsLoaded()
  const data = useLiveQuery(loadAchievementData, [])
  const exercises = useLiveQuery(() => db.exercises.toArray(), [])
  return useMemo(() => {
    if (!settings || !data || !exercises) return undefined
    const opts = { includeWarmups: settings.includeWarmupsInStats }
    const tracks = trackProgress(sessionTotals(data, opts))
    return {
      tracks,
      unlocks: allUnlocks(tracks),
      totalLevel: tracks.reduce((n, t) => n + t.level, 0),
      hall: hallOfFame(data, exercises, opts),
    }
  }, [settings, data, exercises])
}

// Milestone tiles on the workout screen: shown for a week, at most two, each can be dismissed. Which ones were
// dismissed is a per-device display preference (like the name language), so it lives in localStorage.

export const TILE_DAYS = 7
export const MAX_TILES = 2
const KEY = 'gt-dismissed-milestones'
const listeners = new Set<() => void>()

function load(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

let dismissed: string[] = load()

export function dismissTile(id: string) {
  // Only the last few matter: older milestones have expired anyway.
  dismissed = [...dismissed.filter((d) => d !== id), id].slice(-60)
  try {
    localStorage.setItem(KEY, JSON.stringify(dismissed))
  } catch {
    // stays dismissed for this visit only
  }
  listeners.forEach((l) => l())
}

function useDismissed(): string[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => dismissed,
  )
}

/** Milestones of the last seven days that were not dismissed, newest first, at most two. */
export function useMilestoneTiles(now = Date.now()): Unlock[] {
  const achievements = useAchievements()
  const hidden = useDismissed()
  if (!achievements) return []
  return achievements.unlocks
    .filter((u) => !hidden.includes(u.id) && now - instant(u.at) < TILE_DAYS * 86_400_000)
    .slice(0, MAX_TILES)
}
