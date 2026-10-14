import { db } from '../data/db'
import { instant, newId, nowIso } from '../domain/time'
import type { CardioEntry, CardioKind, CardioSlot } from '../domain/types'

export const isRunning = (e: CardioEntry) => e.endedAt === null

/** Starts the clock on a machine. Only one cardio block runs at a time, and only inside an active workout. */
export async function startCardio(input: {
  sessionId: string
  kind: CardioKind
  slot: CardioSlot
  now?: string
}): Promise<CardioEntry> {
  return db.transaction('rw', [db.cardio, db.sessions], async () => {
    const session = await db.sessions.get(input.sessionId)
    if (!session || session.status !== 'active') throw new Error('No workout in progress')
    const existing = await db.cardio.where('sessionId').equals(input.sessionId).toArray()
    if (existing.some(isRunning)) throw new Error('Stop the running cardio first')
    const now = input.now ?? nowIso()
    const entry: CardioEntry = {
      id: newId(),
      sessionId: input.sessionId,
      kind: input.kind,
      slot: input.slot,
      startedAt: now,
      endedAt: null,
      durationSeconds: null,
      createdAt: now,
      updatedAt: now,
    }
    await db.cardio.add(entry)
    return entry
  })
}

/**
 * Adds a block to a finished workout ("log a past workout"). Nothing is measured, so the duration starts empty and
 * the user types it; the block is placed at the start or end of the workout according to its slot.
 */
export async function addPastCardio(input: {
  sessionId: string
  kind: CardioKind
  slot: CardioSlot
}): Promise<CardioEntry> {
  return db.transaction('rw', [db.cardio, db.sessions], async () => {
    const session = await db.sessions.get(input.sessionId)
    if (!session) throw new Error('Workout not found')
    if (session.status === 'active') throw new Error('Use the live workout to add cardio')
    const at = input.slot === 'start' ? session.startedAt : (session.endedAt ?? session.startedAt)
    const now = nowIso()
    const entry: CardioEntry = {
      id: newId(),
      sessionId: session.id,
      kind: input.kind,
      slot: input.slot,
      startedAt: at,
      endedAt: at,
      durationSeconds: null,
      createdAt: now,
      updatedAt: now,
    }
    await db.cardio.add(entry)
    return entry
  })
}

const secondsBetween = (from: string, to: string) => Math.max(0, Math.round((instant(to) - instant(from)) / 1000))

/** Stops the clock and fixes the duration. Stopping something already stopped changes nothing. */
export async function stopCardio(id: string, now = nowIso()): Promise<void> {
  const e = await db.cardio.get(id)
  if (!e || e.endedAt) return
  await db.cardio.update(id, {
    endedAt: now,
    durationSeconds: secondsBetween(e.startedAt, now),
    updatedAt: now,
  })
}

/** Stops whatever is still running in a session (used when the workout is finished). */
export async function stopRunningCardio(sessionId: string, now = nowIso()): Promise<void> {
  const running = (await db.cardio.where('sessionId').equals(sessionId).toArray()).filter(isRunning)
  for (const e of running) await stopCardio(e.id, now)
}

export type CardioPatch = Partial<
  Pick<CardioEntry, 'durationSeconds' | 'distanceKm' | 'floors' | 'level' | 'inclinePct'>
>

export async function updateCardio(id: string, patch: CardioPatch): Promise<void> {
  await db.cardio.update(id, { ...patch, updatedAt: nowIso() })
}

export async function deleteCardio(id: string): Promise<void> {
  await db.cardio.delete(id)
}

/** Cardio of one workout in the order it was done. */
export async function loadCardio(sessionId: string): Promise<CardioEntry[]> {
  return (await db.cardio.where('sessionId').equals(sessionId).toArray()).sort(
    (a, b) => instant(a.startedAt) - instant(b.startedAt),
  )
}
