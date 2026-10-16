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
  patch: { name?: string; notes?: string; address?: string; coords?: Coords | null },
): Promise<void> {
  const next: Partial<Location> = { updatedAt: nowIso() }
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error('Location name is required')
    next.name = patch.name.trim()
  }
  if (patch.notes !== undefined) next.notes = patch.notes.trim() || undefined
  if (patch.address !== undefined) next.address = patch.address.trim() || undefined
  if (patch.coords !== undefined) {
    next.lat = patch.coords?.lat
    next.lng = patch.coords?.lng
  }
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

export interface Coords {
  lat: number
  lng: number
}

/** Locations further away than this are never auto-selected. */
export const AUTO_LOCATION_RADIUS_KM = 25

/** Great-circle distance in km. */
export function distanceKm(a: Coords, b: Coords): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Nearest active location with coordinates within the radius, else null. */
export function nearestLocation(
  locations: Location[],
  here: Coords,
  radiusKm = AUTO_LOCATION_RADIUS_KM,
): Location | null {
  let best: Location | null = null
  let bestKm = radiusKm
  for (const l of locations) {
    if (l.archivedAt || l.lat === undefined || l.lng === undefined) continue
    const km = distanceKm(here, { lat: l.lat, lng: l.lng })
    if (km <= bestKm) {
      best = l
      bestKm = km
    }
  }
  return best
}

/**
 * Coarse device position (Wi-Fi / cell is plenty: the gyms are far apart). Rejects when
 * permission is denied, location is off or it takes too long. Never leaves the device.
 */
export function currentCoords(opts: { timeoutMs?: number; maxAgeMs?: number } = {}): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location is not available in this browser'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Location permission denied' : err.message)),
      { enableHighAccuracy: false, timeout: opts.timeoutMs ?? 8000, maximumAge: opts.maxAgeMs ?? 10 * 60_000 },
    )
  })
}

/** Location detected from the device position, or null when unknown / not possible. */
export async function detectLocationId(): Promise<string | null> {
  try {
    const here = await currentCoords()
    return nearestLocation(await db.locations.toArray(), here)?.id ?? null
  } catch {
    return null
  }
}

/**
 * Location to pre-select when starting a workout: detected (if auto is on), else last used,
 * else default, else none. `auto` tells whether it came from the device position.
 */
export async function suggestLocation(): Promise<{ id: string | null; auto: boolean }> {
  const settings = await getSettings()
  if (settings.autoLocation) {
    const id = await detectLocationId()
    if (id) return { id, auto: true }
  }
  return { id: await fallbackLocationId(), auto: false }
}

export async function suggestedLocationId(): Promise<string | null> {
  return (await suggestLocation()).id
}

async function fallbackLocationId(): Promise<string | null> {
  const settings = await getSettings()
  for (const id of [settings.lastLocationId, settings.defaultLocationId]) {
    if (!id) continue
    const loc = await db.locations.get(id)
    if (loc && !loc.archivedAt) return id
  }
  return null
}
