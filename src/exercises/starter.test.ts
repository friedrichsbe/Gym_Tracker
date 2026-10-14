import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { createDayType, ensureDefaultDayTypes, fitsDay, setExerciseDays } from '../daytypes/dayTypeService'
import {
  createCustomExercise,
  normalize,
  refreshStarterAliases,
  searchExercises,
  seedStarterExercises,
  updateExercise,
} from './exerciseService'
import { STARTER_EXERCISES, starterAliases } from './seed'

describe('standard exercises carry German and English names', () => {
  it('every starter exercise has at least one German and one further name, all unique', () => {
    const seen = new Map<string, string>()
    for (const row of STARTER_EXERCISES) {
      const [name, , , , german, english] = row
      expect(german.length, `${name}: German name missing`).toBeGreaterThanOrEqual(1)
      expect(starterAliases(row).length, `${name}: too few aliases`).toBeGreaterThanOrEqual(3)
      for (const key of [name, ...starterAliases(row)].map(normalize)) {
        const owner = seen.get(key)
        expect(owner === undefined || owner === name, `"${key}" is used by both ${owner} and ${name}`).toBe(true)
        seen.set(key, name)
      }
      expect(english.every((e) => normalize(e) !== normalize(name))).toBe(true)
    }
  })

  it('finds an exercise by its German or its English name, with or without umlauts', async () => {
    await seedStarterExercises()
    const all = await db.exercises.toArray()
    const first = (q: string) => searchExercises(all, q)[0]?.name
    expect(first('Beinpresse')).toBe('Leg Press')
    expect(first('leg press')).toBe('Leg Press')
    expect(first('Rumaenisches Kreuzheben')).toBe('Romanian Deadlift')
    expect(first('Klimmzug')).toBe('Pull-Up')
    expect(first('Brustpresse')).toBe('Chest Press Machine')
    expect(first('butterfly')).toBe('Pec Deck')
    expect(first('Kniebeuge')).toBe('Back Squat')
  })

  it('refresh adds missing names to an older install without touching the user’s own aliases', async () => {
    await seedStarterExercises()
    const leg = (await db.exercises.toArray()).find((e) => e.name === 'Leg Press')!
    // Simulate an older seed: only one alias, plus an alias the user added.
    await db.exercises.update(leg.id, { aliases: ['Beinpresse', 'Meine Presse'] })
    expect(await refreshStarterAliases()).toBeGreaterThanOrEqual(1)
    const after = (await db.exercises.get(leg.id))!
    expect(after.aliases).toContain('Meine Presse')
    expect(after.aliases).toContain('Beinpresse Maschine')
    expect(after.aliases.filter((a) => normalize(a) === 'beinpresse')).toHaveLength(1)
    expect(await refreshStarterAliases()).toBe(0) // idempotent
  })

  it('refresh never steals an alias another exercise already uses, and skips custom or renamed ones', async () => {
    await seedStarterExercises()
    const custom = (await createCustomExercise({ name: 'My Curl', aliases: ['Hammercurls'] })).exercise
    const hammer = (await db.exercises.toArray()).find((e) => e.name === 'Hammer Curl')!
    await db.exercises.update(hammer.id, { aliases: [] })
    await refreshStarterAliases()
    expect((await db.exercises.get(hammer.id))!.aliases.map(normalize)).not.toContain('hammercurls')
    expect((await db.exercises.get(custom.id))!.aliases).toEqual(['Hammercurls'])

    const renamed = (await db.exercises.toArray()).find((e) => e.name === 'Plank')!
    await updateExercise(renamed.id, { name: 'My Plank', aliases: [] })
    await refreshStarterAliases()
    expect((await db.exercises.get(renamed.id))!.aliases).toEqual([])
  })
})

describe('assigning an exercise to training days', () => {
  it('sets, replaces and clears assignments, including days from other splits', async () => {
    await ensureDefaultDayTypes()
    const push = await createDayType({ name: 'Push' })
    const pull = await createDayType({ name: 'Pull' })
    const upper = (await db.dayTypes.toArray()).find((d) => d.name === 'Upper')!
    const mix = (await db.dayTypes.toArray()).find((d) => d.name === 'Mix')!
    const { exercise } = await createCustomExercise({ name: 'Brustpresse2' })

    await setExerciseDays(exercise.id, [upper.id, push.id])
    const days = async () =>
      (await db.dayTypes.toArray())
        .filter((d) => d.exerciseIds.includes(exercise.id))
        .map((d) => d.name)
        .sort()
    expect(await days()).toEqual(['Push', 'Upper'])
    expect(fitsDay(exercise, (await db.dayTypes.get(upper.id))!)).toBe(true)
    expect(fitsDay(exercise, (await db.dayTypes.get(pull.id))!)).toBe(false)
    expect(fitsDay(exercise, mix)).toBe(true) // mixed day always fits

    await setExerciseDays(exercise.id, [pull.id]) // replaces
    expect(await days()).toEqual(['Pull'])

    await db.dayTypes.update(push.id, { archivedAt: '2026-01-01T00:00:00.000+01:00' })
    await setExerciseDays(exercise.id, [pull.id, push.id]) // archived (other-split) days can be assigned too
    expect(await days()).toEqual(['Pull', 'Push'])

    await setExerciseDays(exercise.id, [])
    expect(await days()).toEqual([])
    expect((await db.dayTypes.get(mix.id))!.exerciseIds).toEqual([]) // match-all days are never written to
  })

  it('does not touch other exercises’ assignments', async () => {
    const upper = await createDayType({ name: 'Upper2' })
    const a = (await createCustomExercise({ name: 'A' })).exercise
    const b = (await createCustomExercise({ name: 'B' })).exercise
    await setExerciseDays(a.id, [upper.id])
    await setExerciseDays(b.id, [upper.id])
    await setExerciseDays(a.id, [])
    expect((await db.dayTypes.get(upper.id))!.exerciseIds).toEqual([b.id])
  })
})

describe('alias refresh and archived duplicates', () => {
  it('archived exercises do not block names for the active one', async () => {
    await seedStarterExercises()
    const all = await db.exercises.toArray()
    const keep = all.find((e) => e.name === 'Leg Press')!
    // an archived twin that "owns" the extra names
    await db.exercises.add({ ...keep, id: 'old-twin', archivedAt: '2026-01-01T00:00:00.000+01:00' })
    await db.exercises.update(keep.id, { aliases: ['Beinpresse'] })
    await refreshStarterAliases()
    expect((await db.exercises.get(keep.id))!.aliases).toContain('Beinpresse Maschine')
  })
})
