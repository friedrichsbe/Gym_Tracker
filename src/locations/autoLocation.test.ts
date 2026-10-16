import { describe, expect, it } from 'vitest'
import type { Location } from '../domain/types'
import { distanceKm, nearestLocation } from './locationService'

const loc = (id: string, lat?: number, lng?: number, archivedAt: string | null = null): Location => ({
  id,
  name: id,
  lat,
  lng,
  archivedAt,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

// Two gyms roughly 170 km apart (Berlin, Leipzig).
const berlin = loc('berlin', 52.52, 13.405)
const leipzig = loc('leipzig', 51.34, 12.375)

describe('auto location', () => {
  it('measures great-circle distance', () => {
    expect(distanceKm({ lat: 52.52, lng: 13.405 }, { lat: 51.34, lng: 12.375 })).toBeCloseTo(149, 0)
  })

  it('picks the nearest gym, even with a coarse fix a few km off', () => {
    expect(nearestLocation([berlin, leipzig], { lat: 52.55, lng: 13.35 })?.id).toBe('berlin')
    expect(nearestLocation([berlin, leipzig], { lat: 51.3, lng: 12.4 })?.id).toBe('leipzig')
  })

  it('returns null when no gym is within the radius', () => {
    expect(nearestLocation([berlin, leipzig], { lat: 48.14, lng: 11.58 })).toBeNull()
  })

  it('ignores archived locations and those without a position', () => {
    expect(
      nearestLocation([loc('old', 52.52, 13.405, '2026-02-01T00:00:00.000Z'), loc('none')], {
        lat: 52.52,
        lng: 13.405,
      }),
    ).toBeNull()
  })
})
