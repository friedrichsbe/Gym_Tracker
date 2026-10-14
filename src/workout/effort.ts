import type { SetRecord } from '../domain/types'

/** Short label such as "RPE 8 · RIR 2" for lists; empty when nothing was entered. */
export const effortLabel = (s: Pick<SetRecord, 'rpe' | 'rir' | 'notes'>): string =>
  [s.rpe != null ? `RPE ${s.rpe}` : '', s.rir != null ? `RIR ${s.rir}` : '', s.notes ? '📝' : '']
    .filter(Boolean)
    .join(' · ')
