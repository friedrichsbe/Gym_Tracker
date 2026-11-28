import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

// Update availability, exposed to the UI. The new service worker is only
// activated when the user asks — never mid-workout.
let needRefresh = false
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null
const listeners = new Set<() => void>()

function setNeedRefresh(value: boolean) {
  needRefresh = value
  listeners.forEach((l) => l())
}

export function initPwa() {
  // The Android app ships its web assets inside the APK: no service worker there (updates come with the APK).
  if (import.meta.env.DEV || __NATIVE__) return
  applyUpdate = registerSW({ onNeedRefresh: () => setNeedRefresh(true) })
}

export function applyPwaUpdate() {
  void applyUpdate?.(true)
}

export function useUpdateAvailable(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => needRefresh,
  )
}
