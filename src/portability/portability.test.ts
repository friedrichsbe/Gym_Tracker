import { describe, expect, it } from 'vitest'
import { db, GymTrackerDb, setDatabase } from '../data/db'
import { ensureDefaultDayTypes } from '../daytypes/dayTypeService'
import { seedStarterExercises } from '../exercises/exerciseService'
import { createLocation } from '../locations/locationService'
import { createRoutine } from '../routines/routineService'
import {
  addExercise,
  completeSet,
  finishWorkout,
  loadSessionView,
  startWorkout,
  substituteExercise,
  updateSet,
} from '../workout/workoutService'
import { buildExport, exportCsvZip } from './exportData'
import { applyImport, parseImportText, planImport } from './importData'
import { crc32 } from './zip'

async function populate() {
  await ensureDefaultDayTypes()
  await seedStarterExercises()
  const gymA = await createLocation({ name: 'Gym A, "main"', notes: 'line1\nline2' })
  const ex = async (n: string) => (await db.exercises.toArray()).find((e) => e.name === n)!
  const leg = (await db.dayTypes.toArray()).find((d) => d.name === 'Leg')!
  const press = await ex('Leg Press')
  await createRoutine({
    name: 'Leg A',
    dayTypeId: leg.id,
    exercises: [{ exerciseId: press.id, suggestedSets: 3, targetRepMin: 8, targetRepMax: 12 }],
  })

  const s = await startWorkout({ dayTypeId: leg.id, locationId: gymA.id, exerciseIds: [press.id] })
  let v = (await loadSessionView(s.id))!.exercises
  await updateSet(v[0].sets[0].id, { setType: 'warmup' })
  await completeSet(v[0].sets[0].id, { weightValue: 40, reps: 12 })
  await completeSet(v[0].sets[1].id, { weightValue: 62.5, reps: 10 })
  await substituteExercise({
    workoutExerciseId: v[0].we.id,
    performedExerciseId: (await ex('Pec Deck')).id,
    reason: 'occupied',
  })
  v = (await loadSessionView(s.id))!.exercises
  await completeSet(v[1].sets[0].id, { weightValue: 30, reps: 12 })
  await addExercise({ sessionId: s.id, exerciseId: (await ex('Lat Pulldown')).id })
  await finishWorkout({ sessionId: s.id, notes: 'felt "good"' })
  return s.id
}

const fresh = () => setDatabase(new GymTrackerDb(`restore-${Math.random()}`))

describe('JSON export / import', () => {
  it('round-trips everything into an empty database (replace)', async () => {
    const sessionId = await populate()
    const original = await buildExport()
    const json = JSON.stringify(original)

    fresh()
    const parsed = parseImportText(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const plan = await planImport(parsed.file, 'replace')
    expect(plan.warnings).toEqual([])
    await applyImport(plan)

    const again = await buildExport()
    // Everything except the export timestamp must be identical.
    expect({ ...again, exportedAt: '' }).toEqual({ ...original, exportedAt: '' })

    const s = (await db.sessions.get(sessionId))!
    expect(s).toMatchObject({ status: 'completed', notes: 'felt "good"', dayTypeNameSnapshot: 'Leg' })
    const view = (await loadSessionView(sessionId))!.exercises
    expect(view.map((x) => x.we.performedNameSnapshot)).toEqual(['Leg Press', 'Pec Deck', 'Lat Pulldown'])
    expect(view[1].we).toMatchObject({
      plannedNameSnapshot: 'Leg Press',
      substitutionReason: 'occupied',
      isForeign: true,
    })
    expect(view[0].sets[0]).toMatchObject({ setType: 'warmup', weightValue: 40 })
    expect((await db.settings.get('app'))?.onboardingDone).toBe(true)
  })

  it('merge skips what already exists and adds the rest', async () => {
    await populate()
    const file = await buildExport()
    const parsed = parseImportText(JSON.stringify(file))
    if (!parsed.ok) throw new Error('parse')

    const same = await planImport(parsed.file, 'merge')
    expect(same.counts.sessions).toEqual({ incoming: 1, added: 0 })
    expect(same.counts.sets.added).toBe(0)

    // An extra session in the file is added, the old one is not duplicated.
    const extra = structuredClone(parsed.file)
    extra.sessions.push({
      ...structuredClone(extra.sessions[0]),
      id: 'new-session',
      exerciseInstances: extra.sessions[0].exerciseInstances.map((i) => ({
        ...i,
        id: `${i.id}-x`,
        sets: i.sets.map((s) => ({ ...s, id: `${s.id}-x` })),
      })),
    })
    const plan = await planImport(extra, 'merge')
    expect(plan.counts.sessions.added).toBe(1)
    await applyImport(plan)
    expect(await db.sessions.count()).toBe(2)
    expect(await db.exercises.count()).toBe(file.exercises.length)
  })

  it('keeps sets whose exercise is missing from the catalogue by recreating it', async () => {
    await populate()
    const file = await buildExport()
    const lost = file.exercises.find((e) => e.name === 'Pec Deck')!
    file.exercises = file.exercises.filter((e) => e.id !== lost.id)
    fresh()
    const plan = await planImport(JSON.parse(JSON.stringify(file)), 'replace')
    expect(plan.warnings.some((w) => w.includes('Pec Deck'))).toBe(true)
    await applyImport(plan)
    expect((await db.exercises.get(lost.id))?.name).toBe('Pec Deck')
    expect(await db.sets.count()).toBe(file.sessions[0].exerciseInstances.reduce((n, i) => n + i.sets.length, 0))
  })

  it('downgrades a second active session instead of corrupting state', async () => {
    const running = await startWorkout({})
    const file = await buildExport()
    expect(file.sessions[0].status).toBe('active')
    const other = structuredClone(file)
    other.sessions[0].id = 'other-active'
    const plan = await planImport(other, 'merge')
    expect(plan.sessions[0].status).toBe('abandoned')
    expect(plan.warnings.join()).toMatch(/already in progress/)
    expect((await db.sessions.get(running.id))!.status).toBe('active')
  })

  it('rejects broken files with readable errors and writes nothing', async () => {
    expect(parseImportText('not json')).toMatchObject({ ok: false })
    const bad = parseImportText(
      JSON.stringify({
        format: 'gym-tracker-export',
        formatVersion: 1,
        exportedAt: '2026-01-01T00:00:00Z',
        sessions: [{ id: 'x', status: 'bogus' }],
      }),
    )
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.join('\n')).toMatch(/sessions\.0/)
    expect(parseImportText(JSON.stringify({ format: 'something-else' })).ok).toBe(false)
    expect(
      parseImportText(
        JSON.stringify({ format: 'gym-tracker-export', formatVersion: 99, exportedAt: '2026-01-01T00:00:00Z' }),
      ),
    ).toMatchObject({ ok: false })
    expect(parseImportText('x'.repeat(10), 60 * 1024 * 1024)).toMatchObject({ ok: false })
    expect(await db.sessions.count()).toBe(0)
  })
})

describe('CSV export', () => {
  it('produces a valid zip with documented, correctly quoted CSV files', async () => {
    await populate()
    const { blob, filename } = await exportCsvZip()
    expect(filename).toMatch(/^gym-tracker-csv-\d{4}-\d{2}-\d{2}\.zip$/)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)

    // Walk local headers, verify CRCs, collect files.
    const files = new Map<string, string>()
    let pos = 0
    while (view.getUint32(pos, true) === 0x04034b50) {
      const crc = view.getUint32(pos + 14, true)
      const size = view.getUint32(pos + 18, true)
      const nameLen = view.getUint16(pos + 26, true)
      const name = new TextDecoder().decode(bytes.slice(pos + 30, pos + 30 + nameLen))
      const data = bytes.slice(pos + 30 + nameLen, pos + 30 + nameLen + size)
      expect(crc32(data)).toBe(crc)
      files.set(name, new TextDecoder().decode(data))
      pos += 30 + nameLen + size
    }
    expect([...files.keys()].sort()).toEqual(
      [
        'README.txt',
        'day_types.csv',
        'exercises.csv',
        'locations.csv',
        'routine_exercises.csv',
        'routines.csv',
        'sessions.csv',
        'sets.csv',
        'workout_exercises.csv',
      ].sort(),
    )
    const sets = files.get('sets.csv')!.trim().split('\r\n')
    expect(sets[0]).toContain('weight_value,weight_unit')
    expect(sets.length - 1).toBe(await db.sets.count())
    expect(sets.some((l) => l.includes(',warmup,weight,40,kg,12,true,'))).toBe(true)
    expect(files.get('locations.csv')).toContain('"Gym A, ""main"""')
    expect(files.get('locations.csv')).toContain('"line1\nline2"')
    expect(files.get('README.txt')).toContain('The performed SET is the unit of record')
  })
})
