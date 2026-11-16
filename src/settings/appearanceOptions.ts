import type { AccentColor, Theme } from '../domain/types'

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

export const ACCENTS: { id: AccentColor; label: string }[] = [
  { id: 'orange', label: 'Orange' },
  { id: 'amber', label: 'Amber' },
  { id: 'teal', label: 'Teal' },
  { id: 'blue', label: 'Blue' },
  { id: 'orchid', label: 'Magenta' },
  { id: 'forest', label: 'Green' },
  { id: 'violet', label: 'Violet' },
  { id: 'rose', label: 'Red' },
  { id: 'bronze', label: 'Bronze' },
  { id: 'graphite', label: 'Neutral' },
]
