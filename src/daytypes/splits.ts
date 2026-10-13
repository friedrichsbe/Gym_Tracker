// Ready-made training splits. They only create/restore training days (see DayType); users stay free to rename
// them or change which muscle groups belong to a day afterwards.

const LEGS = ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'lower back', 'abs']
const PUSH = ['chest', 'shoulders', 'triceps']
const PULL = ['lats', 'upper back', 'biceps', 'rear delts', 'forearms']

export interface SplitDay {
  name: string
  muscleTags: string[]
  /** Every exercise fits (mixed / full-body days). */
  matchAll?: boolean
}

export interface SplitDef {
  id: string
  name: string
  description: string
  days: SplitDay[]
}

export const SPLITS: SplitDef[] = [
  {
    id: 'leg-upper-mix',
    name: 'Leg / Upper / Mix',
    description: 'Three flexible days: legs, upper body, and a mixed day where everything fits.',
    days: [
      { name: 'Leg', muscleTags: LEGS },
      { name: 'Upper', muscleTags: [...PUSH, ...PULL, 'abs'] },
      { name: 'Mix', muscleTags: [], matchAll: true },
    ],
  },
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: 'Pressing muscles, pulling muscles, legs — typically 3 or 6 days a week.',
    days: [
      { name: 'Push', muscleTags: PUSH },
      { name: 'Pull', muscleTags: PULL },
      { name: 'Legs', muscleTags: LEGS },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Upper / Lower',
    description: 'Two alternating days, usually 4 a week.',
    days: [
      { name: 'Upper', muscleTags: [...PUSH, ...PULL] },
      { name: 'Lower', muscleTags: LEGS },
    ],
  },
  {
    id: 'full-body',
    name: 'Full body',
    description: 'The whole body every session. One day type where every exercise fits.',
    days: [{ name: 'Full body', muscleTags: [], matchAll: true }],
  },
  {
    id: 'bro',
    name: 'Body-part split',
    description: 'One muscle group per day: chest, back, shoulders, arms, legs.',
    days: [
      { name: 'Chest', muscleTags: ['chest'] },
      { name: 'Back', muscleTags: ['lats', 'upper back'] },
      { name: 'Shoulders', muscleTags: ['shoulders', 'rear delts'] },
      { name: 'Arms', muscleTags: ['biceps', 'triceps', 'forearms'] },
      { name: 'Legs', muscleTags: LEGS },
    ],
  },
]

export const DEFAULT_SPLIT_ID = SPLITS[0].id
