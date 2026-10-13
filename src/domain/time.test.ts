import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './time'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('produces v4 UUIDs', () => {
    expect(newId()).toMatch(UUID_V4)
  })

  it('still works where crypto.randomUUID is missing (plain-http pages, older browsers)', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) })
    const ids = new Set(Array.from({ length: 500 }, () => newId()))
    expect(ids.size).toBe(500)
    for (const id of ids) expect(id).toMatch(UUID_V4)
  })
})
