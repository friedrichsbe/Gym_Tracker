import type { IsoTimestamp, SetRecord } from '../domain/types'

const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

export function formatNumber(n: number | null | undefined): string {
  return n == null ? '' : numberFmt.format(n)
}

/** Parses user input, accepting both "62.5" and "62,5". Empty → null, garbage → undefined. */
export function parseNumber(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.')
  if (t === '') return null
  if (!/^\d*\.?\d*$/.test(t) || t === '.') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(h > 0 ? 2 : 1, '0')
  return h > 0 ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`
}

export function formatDurationShort(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

const dateFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
export function formatDate(iso: IsoTimestamp): string {
  return dateFmt.format(new Date(iso))
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })
export function formatTime(iso: IsoTimestamp): string {
  return timeFmt.format(new Date(iso))
}

export function formatSetShort(s: Pick<SetRecord, 'weightValue' | 'reps' | 'weightUnit' | 'loadType'>): string {
  const w =
    s.weightValue == null
      ? s.loadType === 'bodyweight'
        ? 'BW'
        : '?'
      : s.loadType === 'bodyweight'
        ? `BW+${formatNumber(s.weightValue)}`
        : s.loadType === 'assisted'
          ? `−${formatNumber(s.weightValue)}`
          : formatNumber(s.weightValue)
  return `${w}×${s.reps ?? '?'}`
}

export function formatVolume(volume: Partial<Record<string, number>>): string {
  const parts = Object.entries(volume).map(([unit, v]) => `${formatNumber(Math.round(v ?? 0))} ${unit}`)
  return parts.length ? parts.join(' + ') : '–'
}

/** "40×10 (warm-up) · 100×8 ×3 · 100×6": identical consecutive sets are folded into ×n. */
export function formatSetsCompact(
  sets: Pick<SetRecord, 'weightValue' | 'reps' | 'weightUnit' | 'loadType' | 'setType'>[],
): string {
  const groups: { text: string; count: number }[] = []
  for (const s of sets) {
    const text = formatSetShort(s) + (s.setType === 'warmup' ? ' (w)' : '')
    const last = groups[groups.length - 1]
    if (last?.text === text) last.count++
    else groups.push({ text, count: 1 })
  }
  return groups.map((g) => (g.count > 1 ? `${g.text} ×${g.count}` : g.text)).join(' · ')
}
