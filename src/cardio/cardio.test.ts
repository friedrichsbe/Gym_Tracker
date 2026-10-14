import { describe, expect, it } from 'vitest'
import { db, GymTrackerDb, setDatabase } from '../data/db'
import { buildExport, exportCsvZip } from '../portability/exportData'
import { applyImport, parseImportText, planImport } from '../portability/importData'
import { finishWorkout, startWorkout, summarizeSession, deleteSession } from '../workout/workoutService'
import { createPastWorkout } from '../history/sessionEditService'
import { cardioName, cardioSummary } from './cardioKinds'
import { addPastCardio, deleteCardio, loadCardio, startCardio, stopCardio, updateCardio } from './cardioService'

const T0 = '2026-10-14T10:00:00.000+02:00'
const at = (min: number, sec = 0) => new Date(Date.parse(T0) + (min * 60 + sec) * 1000).toISOString()

describe('cardio blocks', () => {
  it('times a block from absolute timestamps and fixes the duration on stop', async () => {
    const s = await startWorkout({})
    const c = await startCardio({ sessionId: s.id, kind: 'treadmill', slot: 'start', now: T0 })
    expect(c.endedAt).toBeNull()
    await stopCardio(c.id, at(12, 34))
    const stored = (await loadCardio(s.id))[0]
    expect(stored.durationSeconds).toBe(12 * 60 + 34)
    await stopCardio(c.id, at(30)) // stopping twice changes nothing
    expect((await db.cardio.get(c.id))!.durationSeconds).toBe(12 * 60 + 34)
  })

  it('allows only one running block and needs an active workout', async () => {
    await expect(startCardio({ sessionId: 'nope', kind: 'bike', slot: 'end' })).rejects.toThrow(/No workout/)
    const s = await startWorkout({})
    const a = await startCardio({ sessionId: s.id, kind: 'bike', slot: 'start' })
    await expect(startCardio({ sessionId: s.id, kind: 'elliptical', slot: 'end' })).rejects.toThrow(/Stop the running/)
    await stopCardio(a.id)
    await startCardio({ sessionId: s.id, kind: 'elliptical', slot: 'end' })
    expect(await db.cardio.count()).toBe(2)
  })

  it('stores machine values, shows only the entered ones and keeps them out of the strength stats', async () => {
    const s = await startWorkout({})
    const c = await startCardio({ sessionId: s.id, kind: 'stairmaster', slot: 'end', now: T0 })
    await stopCardio(c.id, at(15))
    await updateCardio(c.id, { floors: 80, level: 7 })
    expect(cardioSummary((await db.cardio.get(c.id))!)).toBe('Stairmaster · 15 min · 80 floors · level 7')
    await updateCardio(c.id, { floors: null })
    expect(cardioSummary((await db.cardio.get(c.id))!)).toBe('Stairmaster · 15 min · level 7')
    const sum = await summarizeSession(s.id)
    expect(sum.cardioCount).toBe(1)
    expect(sum.cardioSeconds).toBe(15 * 60)
    expect(sum.completedSets).toBe(0)
    expect(sum.volume).toEqual({})
  })

  it('finishing the workout stops a forgotten timer; deleting the workout removes the cardio', async () => {
    const s = await startWorkout({})
    const c = await startCardio({ sessionId: s.id, kind: 'treadmill', slot: 'end', now: T0 })
    await finishWorkout({ sessionId: s.id, endedAt: at(20) })
    const stored = (await db.cardio.get(c.id))!
    expect(stored.endedAt).toBe(at(20))
    expect(stored.durationSeconds).toBe(20 * 60)
    await deleteSession(s.id)
    expect(await db.cardio.count()).toBe(0)
  })

  it('deletes a single block', async () => {
    const s = await startWorkout({})
    const c = await startCardio({ sessionId: s.id, kind: 'bike', slot: 'start' })
    await deleteCardio(c.id)
    expect(await loadCardio(s.id)).toEqual([])
  })

  it('survives an export → import round trip, including the CSV file', async () => {
    const s = await startWorkout({})
    const c = await startCardio({ sessionId: s.id, kind: 'treadmill', slot: 'start', now: T0 })
    await stopCardio(c.id, at(10))
    await updateCardio(c.id, { distanceKm: 1.8, inclinePct: 5 })
    await finishWorkout({ sessionId: s.id })
    const file = await buildExport()
    expect(file.sessions[0].cardio).toHaveLength(1)

    const parsed = parseImportText(JSON.stringify(file))
    expect(parsed.ok).toBe(true)
    setDatabase(new GymTrackerDb(`cardio-import-${Math.random()}`))
    if (!parsed.ok) return
    await applyImport(await planImport(parsed.file, 'replace'))
    const back = (await db.cardio.toArray())[0]
    expect(back).toMatchObject({
      kind: 'treadmill',
      slot: 'start',
      durationSeconds: 600,
      distanceKm: 1.8,
      inclinePct: 5,
    })
    expect(back.sessionId).toBe(s.id)

    const zip = await exportCsvZip()
    expect(zip.blob.size).toBeGreaterThan(0)
  })

  it('imports older files that have no cardio section', async () => {
    const s = await startWorkout({})
    await finishWorkout({ sessionId: s.id })
    const file = JSON.parse(JSON.stringify(await buildExport())) as { sessions: Record<string, unknown>[] }
    delete file.sessions[0].cardio
    expect(parseImportText(JSON.stringify(file)).ok).toBe(true)
  })

  it('adds untimed cardio to a past workout at its start or end, and refuses a live one', async () => {
    const past = await createPastWorkout({ startedAt: '2026-10-01T18:00:00.000+02:00', durationMinutes: 60 })
    const a = await addPastCardio({ sessionId: past.id, kind: 'bike', slot: 'start' })
    const b = await addPastCardio({ sessionId: past.id, kind: 'stairmaster', slot: 'end' })
    expect(a.startedAt).toBe(past.startedAt)
    expect(b.startedAt).toBe(past.endedAt)
    expect(a.durationSeconds).toBeNull()
    await updateCardio(a.id, { durationSeconds: 10 * 60, distanceKm: 4 })
    expect(cardioSummary((await db.cardio.get(a.id))!)).toBe('Indoor bike · 10 min · 4 km')
    const live = await startWorkout({})
    await expect(addPastCardio({ sessionId: live.id, kind: 'bike', slot: 'end' })).rejects.toThrow(/live workout/)
  })

  it('names machines in English with a German alias', () => {
    expect(cardioName('treadmill', 'en')).toBe('Treadmill')
    expect(cardioName('treadmill', 'de')).toBe('Laufband')
    expect(cardioName('elliptical', 'de')).toBe('Ellipsentrainer')
    expect(cardioName('bike', 'de')).toBe('Indoor-Fahrrad')
  })
})
