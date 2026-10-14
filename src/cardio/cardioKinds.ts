import type { CardioEntry, CardioKind } from '../domain/types'
import { formatDurationShort, formatNumber } from '../ui/format'
import type { NameLang } from '../ui/lang'

export type CardioMetricKey = 'distanceKm' | 'floors' | 'level' | 'inclinePct'

export interface CardioMetric {
  key: CardioMetricKey
  label: string
  /** How an entered value reads in a summary, e.g. "1.8 km" or "level 8". */
  show: (value: number) => string
  integer?: boolean
}

const DISTANCE: CardioMetric = { key: 'distanceKm', label: 'Distance (km)', show: (v) => `${formatNumber(v)} km` }
const LEVEL: CardioMetric = { key: 'level', label: 'Level', show: (v) => `level ${formatNumber(v)}`, integer: true }

/** The machines on offer, with the one or two values worth noting for each (besides the duration). */
export const CARDIO_KINDS: Record<CardioKind, { label: string; german: string; metrics: CardioMetric[] }> = {
  treadmill: {
    label: 'Treadmill',
    german: 'Laufband',
    metrics: [DISTANCE, { key: 'inclinePct', label: 'Incline (%)', show: (v) => `${formatNumber(v)} % incline` }],
  },
  stairmaster: {
    label: 'Stairmaster',
    german: 'Stairmaster',
    metrics: [{ key: 'floors', label: 'Floors', show: (v) => `${formatNumber(v)} floors`, integer: true }, LEVEL],
  },
  elliptical: { label: 'Elliptical', german: 'Ellipsentrainer', metrics: [DISTANCE, LEVEL] },
  bike: { label: 'Indoor bike', german: 'Indoor-Fahrrad', metrics: [DISTANCE, LEVEL] },
}

export const CARDIO_KIND_ORDER: CardioKind[] = ['treadmill', 'stairmaster', 'elliptical', 'bike']

/** Machine name in the chosen language (English is the default, German the alias). */
export const cardioName = (kind: CardioKind, lang: NameLang) =>
  lang === 'de' ? CARDIO_KINDS[kind].german : CARDIO_KINDS[kind].label

/** "Treadmill · 12 min · 1.8 km · 5 % incline" — only values that were entered. */
export function cardioSummary(e: CardioEntry, lang: NameLang = 'en'): string {
  const cfg = CARDIO_KINDS[e.kind]
  const values = cfg.metrics.flatMap((m) => {
    const v = e[m.key]
    return v == null ? [] : [m.show(v)]
  })
  return [
    cardioName(e.kind, lang),
    e.durationSeconds != null ? formatDurationShort(e.durationSeconds) : null,
    ...values,
  ]
    .filter(Boolean)
    .join(' · ')
}
