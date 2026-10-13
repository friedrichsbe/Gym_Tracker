import type { IsoTimestamp } from './types'

const pad = (n: number, width = 2) => String(Math.trunc(Math.abs(n))).padStart(width, '0')

/** ISO 8601 in local time with explicit UTC offset (PRD Appendix B). */
export function toIso(date: Date = new Date()): IsoTimestamp {
  const offsetMin = -date.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  return (
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}` +
    `${sign}${pad(offsetMin / 60)}:${pad(offsetMin % 60)}`
  )
}

export const nowIso = (): IsoTimestamp => toIso(new Date())

/** Compare by real instant, not by string (offsets may differ across DST). */
export const instant = (iso: IsoTimestamp): number => Date.parse(iso)

/**
 * RFC 4122 v4 UUID. `crypto.randomUUID` only exists in secure contexts (HTTPS/localhost), so opening the app
 * over plain http on a LAN address — e.g. a phone testing the dev server — would crash every write.
 * `getRandomValues` is available everywhere, so it is the fallback.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40 // version 4
  b[8] = (b[8] & 0x3f) | 0x80 // variant 10
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}
