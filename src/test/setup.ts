import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { GymTrackerDb, setDatabase } from '../data/db'

// Every test gets a fresh, isolated IndexedDB.
let counter = 0
beforeEach(() => {
  setDatabase(new GymTrackerDb(`test-${++counter}-${Math.random()}`))
})

afterEach(async () => {
  cleanup()
})
