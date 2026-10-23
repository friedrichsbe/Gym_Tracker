import { describe, expect, it } from 'vitest'
import { db, GymTrackerDb, setDatabase } from '../data/db'
import { applySplit, ensureDefaultDayTypes, updateDayType } from '../daytypes/dayTypeService'
import { SPLITS } from '../daytypes/splits'
import { createCustomExercise } from '../exercises/exerciseService'
import { buildExport } from '../portability/exportData'
import { applyImport, parseImportText, planImport } from '../portability/importData'
import {
  createRoutine,
  createRoutineFromSession,
  duplicateRoutine,
  getRoutineExercises,
} from '../routines/routineService'
import {
  addExercise,
  completeSet,
  finishWorkout,
  linkSuperset,
  loadSessionView,
  moveExercise,
  removeExercise,
  startWorkout,
  substituteExercise,
  unlinkSuperset,
} from './workoutService'
import { exerciseStats, loadStatsData } from '../analytics/analytics'
import { moveBlock, moveBlockNext, normalizeGroupIds, supersetLabel, toBlocks } from './supersets'

let n = 0
const ids = () => `new-${++n}`

describe('superset helpers', () => {
  it('keeps only adjacent groups of two or more', () => {
    expect(normalizeGroupIds(['a', 'a', null, 'b'], ids)).toEqual(['a', 'a', null, null])
    expect(normalizeGroupIds(['a', null, 'a'], ids)).toEqual([null, null, null])
    expect(normalizeGroupIds([null, null], ids)).toEqual([null, null])
  })

  it('gives a group id appearing in two separate runs a fresh id for the later run', () => {
    const out = normalizeGroupIds(['a', 'a', null, 'a', 'a'], ids)
    expect(out[0]).toBe('a')
    expect(out[1]).toBe('a')
    expect(out[3]).toBe(out[4])
    expect(out[3]).not.toBe('a')
  })

  it('moves a whole block and labels sizes', () => {
    const items = [
      { k: 'A', g: null },
      { k: 'B', g: 'x' },
      { k: 'C', g: 'x' },
      { k: 'D', g: null },
    ]
    expect(toBlocks(items, (i) => i.g).map((b) => b.map((i) => i.k).join(''))).toEqual(['A', 'BC', 'D'])
    expect(moveBlock(items, 2, -1, (i) => i.g).map((i) => i.k)).toEqual(['B', 'C', 'A', 'D'])
    expect(moveBlock(items, 0, 1, (i) => i.g).map((i) => i.k)).toEqual(['B', 'C', 'A', 'D'])
    expect(moveBlock(items, 0, -1, (i) => i.g).map((i) => i.k)).toEqual(['A', 'B', 'C', 'D'])
    expect([supersetLabel(2), supersetLabel(3), supersetLabel(4)]).toEqual(['Superset', 'Tri-set', 'Giant set'])
  })

  it('moves an exercise or superset up to "next": below the started ones, above everything else', () => {
    const items = [
      { k: 'A', g: null, s: true },
      { k: 'B', g: null, s: true },
      { k: 'C', g: null, s: false },
      { k: 'D', g: 'x', s: false },
      { k: 'E', g: 'x', s: false },
      { k: 'F', g: null, s: false },
    ]
    const next = (i: number, list = items) =>
      moveBlockNext(
        list,
        i,
        (x) => x.g,
        (x) => x.s,
      )
        .map((x) => x.k)
        .join('')
    expect(next(5)).toBe('ABFCDE')
    expect(next(4)).toBe('ABDECF') // the whole superset moves
    expect(next(2)).toBe('ABCDEF') // already next
    expect(next(0)).toBe('ABCDEF') // started: stays
    // Done out of order: it goes below the last started exercise.
    expect(next(1, [items[2], items[5], items[1]])).toBe('CBF')
    // Nothing started yet: to the top.
    expect(next(2, [items[2], items[3], items[5]])).toBe('FCD')
  })
})

async function session(names: string[]) {
  const exs = []
  for (const name of names) exs.push((await createCustomExercise({ name })).exercise)
  const s = await startWorkout({})
  for (const e of exs) await addExercise({ sessionId: s.id, exerciseId: e.id })
  return { s, exs, view: async () => (await loadSessionView(s.id))!.exercises }
}
const groups = async (v: () => Promise<{ we: { supersetGroupId?: string | null } }[]>) =>
  (await v()).map((x) => x.we.supersetGroupId ?? null)

describe('supersets in a workout', () => {
  it('links with the next exercise, extends to a tri-set and dissolves when broken', async () => {
    const { v } = await (async () => {
      const t = await session(['A', 'B', 'C'])
      return { v: t.view }
    })()
    const first = (await v())[0].we.id
    const second = (await v())[1].we.id
    await linkSuperset(first)
    let g = await groups(v)
    expect(g[0]).toBeTruthy()
    expect(g[0]).toBe(g[1])
    expect(g[2]).toBeNull()

    await linkSuperset(second) // B is in the group, C is below: tri-set
    g = await groups(v)
    expect(new Set(g).size).toBe(1)

    await unlinkSuperset(second) // middle member leaves: A and C are no longer adjacent
    expect(await groups(v)).toEqual([null, null, null])
  })

  it('refuses to link the last exercise', async () => {
    const t = await session(['A', 'B'])
    const last = (await t.view())[1].we.id
    await expect(linkSuperset(last)).rejects.toThrow(/below/)
  })

  it('moves a superset as one block and keeps it intact', async () => {
    const t = await session(['A', 'B', 'C', 'D'])
    await linkSuperset((await t.view())[0].we.id) // A+B
    const names = async () => (await t.view()).map((x) => x.we.performedNameSnapshot).join('')

    await moveExercise((await t.view())[2].we.id, -1) // C up: jumps over the whole block
    expect(await names()).toBe('CABD')
    await moveExercise((await t.view())[1].we.id, 1) // A (in the group) down: moves the block
    expect(await names()).toBe('CDAB')
    const g = await groups(t.view)
    expect(g[2]).toBe(g[3])
    expect(g[2]).toBeTruthy()
  })

  it('removing a member dissolves a pair; substituting keeps the superset', async () => {
    const t = await session(['A', 'B', 'C'])
    await linkSuperset((await t.view())[0].we.id)
    const alt = (await createCustomExercise({ name: 'B2' })).exercise

    // Log a set on B, then substitute: replacement stays in the group (now three members).
    const b = (await t.view())[1]
    await completeSet(b.sets[0].id, { weightValue: 10, reps: 10 })
    await substituteExercise({ workoutExerciseId: b.we.id, performedExerciseId: alt.id })
    const g = await groups(t.view)
    expect(g.slice(0, 3).every((x) => x === g[0] && x)).toBe(true)

    // A fresh pair loses a member before anything was logged (only one workout may run at a time).
    await finishWorkout({ sessionId: t.s.id })
    const t2 = await session(['X', 'Y'])
    await linkSuperset((await t2.view())[0].we.id)
    await removeExercise((await t2.view())[1].we.id)
    expect(await groups(t2.view)).toEqual([null])
  })
})

describe('supersets in presets and backups', () => {
  it('saving a workout as preset keeps the superset and starting it recreates it', async () => {
    const t = await session(['A', 'B', 'C'])
    await linkSuperset((await t.view())[0].we.id)
    for (const x of await t.view()) await completeSet(x.sets[0].id, { weightValue: 20, reps: 8 })
    await finishWorkout({ sessionId: t.s.id })

    const routine = await createRoutineFromSession(t.s.id, { name: 'With superset', dayTypeId: null })
    const items = await getRoutineExercises(routine.id)
    expect(items[0].supersetGroup).toBeTruthy()
    expect(items[0].supersetGroup).toBe(items[1].supersetGroup)
    expect(items[2].supersetGroup).toBeNull()

    const copy = await duplicateRoutine(routine.id)
    expect((await getRoutineExercises(copy.id))[0].supersetGroup).toBeTruthy()

    const s2 = await startWorkout({ routineId: routine.id })
    const g = (await loadSessionView(s2.id))!.exercises.map((x) => x.we.supersetGroupId ?? null)
    expect(g[0]).toBeTruthy()
    expect(g[0]).toBe(g[1])
    expect(g[2]).toBeNull()
    expect(g[0]).not.toBe(items[0].supersetGroup) // fresh id per workout
  })

  it('drops broken groups when saving a preset', async () => {
    const a = (await createCustomExercise({ name: 'A' })).exercise
    const b = (await createCustomExercise({ name: 'B' })).exercise
    const c = (await createCustomExercise({ name: 'C' })).exercise
    const r = await createRoutine({
      name: 'x',
      exercises: [a, b, c].map((e, i) => ({
        exerciseId: e.id,
        suggestedSets: 3,
        targetRepMin: 8,
        targetRepMax: 12,
        supersetGroup: i === 1 ? null : 'g',
      })),
    })
    expect((await getRoutineExercises(r.id)).map((i) => i.supersetGroup ?? null)).toEqual([null, null, null])
  })

  it('survives a JSON export/import round trip', async () => {
    const t = await session(['A', 'B'])
    await linkSuperset((await t.view())[0].we.id)
    for (const x of await t.view()) await completeSet(x.sets[0].id, { weightValue: 5, reps: 5 })
    await finishWorkout({ sessionId: t.s.id })
    const file = await buildExport()

    setDatabase(new GymTrackerDb(`ss-${Math.random()}`))
    const parsed = parseImportText(JSON.stringify(file))
    if (!parsed.ok) throw new Error(parsed.errors.join())
    await applyImport(await planImport(parsed.file, 'replace'))
    const g = (await loadSessionView(t.s.id))!.exercises.map((x) => x.we.supersetGroupId ?? null)
    expect(g[0]).toBeTruthy()
    expect(g[0]).toBe(g[1])
  })
})

describe('training splits', () => {
  const active = async () =>
    (await db.dayTypes.toArray())
      .filter((d) => !d.archivedAt)
      .sort((a, b) => a.position - b.position)
      .map((d) => d.name)

  it('switches split, archives unused days and restores them (with custom tags) when switching back', async () => {
    await ensureDefaultDayTypes()
    expect(await active()).toEqual(['Leg', 'Upper', 'Mix'])
    const leg = (await db.dayTypes.toArray()).find((d) => d.name === 'Leg')!
    await updateDayType(leg.id, { muscleTags: ['quads'] }) // user customised

    await applySplit('ppl')
    expect(await active()).toEqual(['Push', 'Pull', 'Legs'])
    expect((await db.dayTypes.get(leg.id))!.archivedAt).not.toBeNull()

    await applySplit('leg-upper-mix')
    expect(await active()).toEqual(['Leg', 'Upper', 'Mix'])
    expect((await db.dayTypes.get(leg.id))!.muscleTags).toEqual(['quads']) // same record, customisation kept
    expect(await db.dayTypes.count()).toBe(6) // nothing duplicated or lost
  })

  it('offers sensible built-in splits and rejects unknown ones', async () => {
    expect(SPLITS.map((s) => s.id)).toEqual(['leg-upper-mix', 'ppl', 'upper-lower', 'full-body', 'bro'])
    expect(SPLITS.find((s) => s.id === 'full-body')!.days[0].matchAll).toBe(true)
    await expect(applySplit('nope')).rejects.toThrow()
    await applySplit('bro')
    expect(await active()).toEqual(['Chest', 'Back', 'Shoulders', 'Arms', 'Legs'])
  })
})

describe('supersets in statistics', () => {
  it('flags superset sessions and can leave them out', async () => {
    const t = await session(['A', 'B'])
    await linkSuperset((await t.view())[0].we.id)
    for (const x of await t.view()) await completeSet(x.sets[0].id, { weightValue: 50, reps: 10 })
    await finishWorkout({ sessionId: t.s.id })

    // A later straight-sets workout with the same exercise.
    const s2 = await startWorkout({})
    await addExercise({ sessionId: s2.id, exerciseId: t.exs[0].id })
    await completeSet((await loadSessionView(s2.id))!.exercises[0].sets[0].id, { weightValue: 60, reps: 8 })
    await finishWorkout({ sessionId: s2.id })

    const data = await loadStatsData()
    const opts = { location: 'all', includeWarmups: true, unit: 'kg' } as const
    const all = exerciseStats(data, t.exs[0].id, opts)
    expect(all.points.map((p) => p.superset)).toEqual([true, false])
    const without = exerciseStats(data, t.exs[0].id, { ...opts, supersets: 'exclude' })
    expect(without.points).toHaveLength(1)
    expect(without.points[0].topWeight).toBe(60)
  })
})

describe('starting with picked exercises', () => {
  it('recreates supersets from keys and drops invalid groups', async () => {
    const a = (await createCustomExercise({ name: 'A' })).exercise
    const b = (await createCustomExercise({ name: 'B' })).exercise
    const c = (await createCustomExercise({ name: 'C' })).exercise
    const s = await startWorkout({ exerciseIds: [a.id, b.id, c.id], supersetKeys: ['x', 'x', 'lonely'] })
    const g = (await loadSessionView(s.id))!.exercises.map((e) => e.we.supersetGroupId ?? null)
    expect(g[0]).toBeTruthy()
    expect(g[0]).toBe(g[1])
    expect(g[2]).toBeNull() // a single member is not a superset
  })
})
