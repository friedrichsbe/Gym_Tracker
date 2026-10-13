import { db } from '../data/db'
import { getSettings, updateSettings } from '../data/settings'
import { newId, nowIso } from '../domain/time'
import type { Location } from '../domain/types'

export async function createLocation(input: { name: string; notes?: string; address?: string }): Promise<Location> {
  const name = input.name.trim()
  if (!name) throw new Error('Location name is required')
  const now = nowIso()
  const location: Location = {
    id: newId(),
    name,
    notes: input.notes?.trim() || undefined,
    address: input.address?.trim() || undefined,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.locations.add(location)
  const settings = await getSettings()
  if (!settings.defaultLocationId) await updateSettings({ defaultLocationId: location.id })
  return location
}

/**
 * Renaming never touches history: sessions and sets keep their own name snapshot
 * (PRD F2), so old records stay interpretable.
 */
export async function updateLocation(
  id: string,
  patch: { name?: string; notes?: string; address?: string },
): Promise<void> {
  const next: Partial<Location> = { updatedAt: nowIso() }
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error('Location name is required')
    next.name = patch.name.trim()
  }
  if (patch.notes !== undefined) next.notes = patch.notes.trim() || undefined
  if (patch.address !== undefined) next.address = patch.address.trim() || undefined
  await db.locations.update(id, next)
}

/** Archive instead of delete: referenced records stay valid. */
export async function archiveLocation(id: string): Promise<void> {
  const now = nowIso()
  await db.locations.update(id, { archivedAt: now, updatedAt: now })
  const settings = await getSettings()
  await updateSettings({
    defaultLocationId: settings.defaultLocationId === id ? null : settings.defaultLocationId,
    lastLocationId: settings.lastLocationId === id ? null : settings.lastLocationId,
  })
}

export async function unarchiveLocation(id: string): Promise<void> {
  await db.locations.update(id, { archivedAt: null, updatedAt: nowIso() })
}

/** Location to pre-select when starting a workout: last used, else default, else none. */
export async function suggestedLocationId(): Promise<string | null> {
  const settings = await getSettings()
  for (const id of [settings.lastLocationId, settings.defaultLocationId]) {
    if (!id) continue
    const loc = await db.locations.get(id)
    if (loc && !loc.archivedAt) return id
  }
  return null
}
