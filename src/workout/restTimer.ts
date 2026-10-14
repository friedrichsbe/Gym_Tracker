import { useSyncExternalStore } from 'react'

// Rest timer state. It stores the absolute END time, not a counter, so it stays correct when the phone
// sleeps, the tab is in the background or the app is reloaded (no timer drift). Persisted in localStorage
// because it is transient, per-device UI state — not training data.

export interface RestState {
  endsAt: number
  /** Planned length in seconds (grows/shrinks with the ±15 s buttons); used for the progress bar. */
  durationSec: number
  label: string
}

const KEY = 'gt-rest-timer'
const STALE_AFTER_MS = 30 * 60_000

function load(): RestState | null {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as RestState | null
    if (raw && typeof raw.endsAt === 'number' && Date.now() - raw.endsAt < STALE_AFTER_MS) return raw
  } catch {
    // unavailable or corrupt: start without a timer
  }
  return null
}

let state: RestState | null = load()
const listeners = new Set<() => void>()

function set(next: RestState | null) {
  state = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    // timer still works for this page load
  }
  listeners.forEach((l) => l())
}

export function startRest(seconds: number, label: string, now = Date.now()) {
  const durationSec = Math.max(1, Math.round(seconds))
  set({ endsAt: now + durationSec * 1000, durationSec, label })
}

/** Add or remove time (e.g. ±15 s). The timer never goes below zero length. */
export function adjustRest(deltaSec: number, now = Date.now()) {
  if (!state) return
  const endsAt = Math.max(now, state.endsAt + deltaSec * 1000)
  set({ ...state, endsAt, durationSec: Math.max(1, state.durationSec + deltaSec) })
}

export function stopRest() {
  if (state) set(null)
}

export const remainingSeconds = (s: RestState, now: number): number => Math.max(0, Math.ceil((s.endsAt - now) / 1000))

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  return `${m}:${String(totalSeconds % 60).padStart(2, '0')}`
}

export function useRestTimer(): RestState | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

/** Test helper: forget in-memory state. */
export function resetRestTimerForTests() {
  set(null)
}
