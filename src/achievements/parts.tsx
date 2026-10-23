import type { CSSProperties } from 'react'
import type { WeightUnit } from '../domain/types'
import { formatTrackValue, type TrackId, type TrackProgress } from './achievements'
import { tierColors } from './Medal'

const longDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
export const milestoneDate = (iso: string) => longDate.format(new Date(iso))

/** CSS custom properties that paint a surface in the colours of a medal tier. */
export const tierStyle = (level: number): CSSProperties => {
  const [light, base, dark] = tierColors(level)
  return { ['--t-light' as string]: light, ['--t-base' as string]: base, ['--t-dark' as string]: dark }
}

export function ProgressBar({ fraction, track }: { fraction: number; track: TrackId }) {
  return (
    <span className={`trophy-bar track-${track}`} role="progressbar" aria-valuenow={Math.round(fraction * 100)}>
      <span style={{ width: `${Math.max(fraction > 0 ? 3 : 0, fraction * 100)}%` }} />
    </span>
  )
}

/** "212 / 250 · 38 to go"; streaks: "Streak 6 of 8 weeks · 1/2 this week". */
export function progressText(t: TrackProgress, unit: WeightUnit): string {
  const id = t.def.id
  if (t.def.streak) {
    const min = t.def.streak.minPerWeek
    const week = `${Math.min(t.thisWeek ?? 0, min)}/${min} this week`
    return t.next == null ? `Streak ${t.current} weeks · ${week}` : `Streak ${t.current} of ${t.next} weeks · ${week}`
  }
  if (t.next == null) return `${formatTrackValue(id, t.value, unit)} · top level reached`
  return `${formatTrackValue(id, t.value, unit)} / ${formatTrackValue(id, t.next, unit)} · ${formatTrackValue(id, t.next - t.value, unit)} to go`
}
