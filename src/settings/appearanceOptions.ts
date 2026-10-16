import type { AccentColor, Theme } from '../domain/types'

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]

export const ACCENTS: { id: AccentColor; label: string }[] = [
  { id: 'teal', label: 'Teal' },
  { id: 'blue', label: 'Blue' },
  { id: 'orchid', label: 'Orchid' },
  { id: 'forest', label: 'Forest' },
  { id: 'ember', label: 'Ember' },
  { id: 'rose', label: 'Rose' },
  { id: 'graphite', label: 'Graphite' },
]
