import { useSyncExternalStore } from 'react'

// Which language exercise and machine names are shown in. A per-device display preference, shared by the exercise
// picker and the cardio picker (so one switch is enough), kept in localStorage — not training data.

export type NameLang = 'en' | 'de'

const KEY = 'gt-picker-lang'
const listeners = new Set<() => void>()

function load(): NameLang {
  try {
    return localStorage.getItem(KEY) === 'de' ? 'de' : 'en'
  } catch {
    return 'en'
  }
}

let current: NameLang = load()

export function setNameLang(next: NameLang) {
  current = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // preference just won't persist
  }
  listeners.forEach((l) => l())
}

export function useNameLang(): NameLang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
