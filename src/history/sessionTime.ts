import { instant } from '../domain/time'

const pad = (n: number) => String(n).padStart(2, '0')

/** Date and time as the user sees them on their device (the stored timestamp keeps its own offset). */
export function localParts(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  }
}

export function minutesBetween(startedAt: string, endedAt: string | null): number | null {
  return endedAt ? Math.max(1, Math.round((instant(endedAt) - instant(startedAt)) / 60_000)) : null
}
