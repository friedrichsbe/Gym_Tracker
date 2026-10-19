import { describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { updateSettings } from '../data/settings'
import { createCustomExercise, searchExercises, seedStarterExercises } from '../exercises/exerciseService'
import { archiveLocation, createLocation, updateLocation } from '../locations/locationService'
import { newId, nowIso } from '../domain/time'
import {
  addExercise,
  addSet,
  changeSessionLocation,
  completeSet,
  deleteSet,
  discardWorkout,
  finishWorkout,
  getActiveSession,
  getLastPerformance,
  loadSessionView,
  moveExercise,
  removeExercise,
  restoreSet,
  startWorkout,
  substituteExercise,
  toggleSide,
  uncompleteSet,
  updateSet,
} from './workoutService'

async function ex(name: string) {
  return (await createCustomExercise({ name })).exercise
}

async function setsOf(sessionId: string) {
  const view = await loadSessionView(sessionId)
  return view!.exercises
}

describe('session lifecycle', () => {
  it('starts a blank workout and refuses a second active one', async () => {
    const gym = await createLocation({ name: 'Gym A' })
    const s = await startWorkout({ locationId: gym.id })
    expect(s.status).toBe('active')
    expect(s.locationNameSnapshot).toBe('Gym A')
    await expect(startWorkout({})).rejects.toThrow(/already in progress/)
    expect((await getActiveSession())?.id).toBe(s.id)
  })

  it('persists logged sets so an active workout can be recovered after reload', async () => {
    const press = await ex('Leg Press')
    const s = await startWorkout({})
    const we = await addExercise({ sessionId: s.id, exerciseId: press.id })
    const [first] = (await setsOf(s.id))[0].sets
    await completeSet(first.id, { weightValue: 100, reps: 8 })

    // "Reload": nothing in memory, only the database.
    const recovered = await getActiveSession()
    expect(recovered?.id).toBe(s.id)
    const view = await setsOf(s.id)
    expect(view[0].we.id).toBe(we.id)
    expect(view[0].sets[0]).toMatchObject({ isCompleted: true, weightValue: 100, reps: 8 })
  })

  it('finishing drops pending sets, marks untouched exercises skipped and summarises', async () => {
    const a = await ex('A')
    const b = await ex('B')
    const s = await startWorkout({})
    await addExercise({ sessionId: s.id, exerciseId: a.id })
    await addExercise({ sessionId: s.id, exerciseId: b.id })
    const view = await setsOf(s.id)
    await completeSet(view[0].sets[0].id, { weightValue: 50, reps: 10 })
    await updateSet((await setsOf(s.id))[0].sets[0].id, { setType: 'warmup' })

    const summary = await finishWorkout({ sessionId: s.id })
    expect(summary).toMatchObject({ completedSets: 1, workingSets: 0, exercisesDone: 1, exercisesSkipped: 1 })
    expect(summary.volume).toEqual({ kg: 500 }) // warm-ups count by default (setting: includeWarmupsInStats)

    const after = await setsOf(s.id)
    expect(after[0].we.status).toBe('completed')
    expect(after[1].we.status).toBe('skipped')
    expect(after.flatMap((e) => e.sets).every((x) => x.isCompleted)).toBe(true)
    expect((await db.sessions.get(s.id))!.status).toBe('completed')
    expect(await getActiveSession()).toBeUndefined()
  })

  it('computes volume only from completed external-load working sets', async () => {
    const a = await ex('A')
    const s = await startWorkout({})
    await addExercise({ sessionId: s.id, exerciseId: a.id })
    let sets = (await setsOf(s.id))[0].sets
    await completeSet(sets[0].id, { weightValue: 60, reps: 10 })
    await addSet((await setsOf(s.id))[0].we.id)
    sets = (await setsOf(s.id))[0].sets
    await completeSet(sets[1].id, { weightValue: 0, reps: 10 }) // zero is a real value
    const summary = await finishWorkout({ sessionId: s.id })
    expect(summary.volume).toEqual({ kg: 600 })
  })

  it('one-sided exercises: both sides in any order complete the set, volume counts both sides', async () => {
    const glute = (await createCustomExercise({ name: 'Glutaeus', unilateral: true })).exercise
    const s = await startWorkout({})
    await addExercise({ sessionId: s.id, exerciseId: glute.id })
    const [set] = (await setsOf(s.id))[0].sets
    await updateSet(set.id, { weightValue: 30, reps: 8 })
    expect(await toggleSide(set.id, 'right')).toBe(false)
    expect(await db.sets.get(set.id)).toMatchObject({ isCompleted: false, sideDone: 'right' })
    expect(await toggleSide(set.id, 'right')).toBe(false) // untick again
    expect(await db.sets.get(set.id)).toMatchObject({ isCompleted: false })
    expect((await db.sets.get(set.id))!.sideDone).toBeUndefined()
    await toggleSide(set.id, 'right')
    expect(await toggleSide(set.id, 'left')).toBe(true)
    expect(await db.sets.get(set.id)).toMatchObject({ isCompleted: true })
    expect((await db.sets.get(set.id))!.sideDone).toBeUndefined()
    // Unticking one side of a completed set keeps the other one ticked.
    expect(await toggleSide(set.id, 'left')).toBe(false)
    expect(await db.sets.get(set.id)).toMatchObject({ isCompleted: false, sideDone: 'right' })
    expect(await toggleSide(set.id, 'left')).toBe(true)
    const summary = await finishWorkout({ sessionId: s.id })
    expect(summary.completedSets).toBe(1)
    expect(summary.volume).toEqual({ kg: 480 })
  })

  it('discard keeps data but marks the session abandoned', async () => {
    const s = await startWorkout({})
    await discardWorkout(s.id)
    expect((await db.sessions.get(s.id))!.status).toBe('abandoned')
    expect(await getActiveSession()).toBeUndefined()
  })
})

describe('sets', () => {
  it('adds no extra row after the last set by default and ignores duplicate taps', async () => {
    const a = await ex('A')
    const s = await startWorkout({})
    await addExercise({ sessionId: s.id, exerciseId: a.id })
    const id = (await setsOf(s.id))[0].sets[0].id
    await completeSet(id, { weightValue: 40, reps: 12 })
    await completeSet(id, { weightValue: 999, reps: 1 }) // double tap must not change anything
    const sets = (await setsOf(s.id))[0].sets
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({ weightValue: 40, reps: 12, isCompleted: true })
  })

  it('prepares a pre-filled next set when "Add the next set automatically" is on', async () => {
    await updateSettings({ autoAddNextSet: true })
    const a = await ex('A')
    const s = await startWorkout({})
    await addExercise({ sessionId: s.id, exerciseId: a.id })
    await completeSet((await setsOf(s.id))[0].sets[0].id, { weightValue: 40, reps: 12 })
    const sets = (await setsOf(s.id))[0].sets
    expect(sets).toHaveLength(2)
    expect(sets[1]).toMatchObject({ weightValue: 40, reps: 12, isCompleted: false })
  })

  it('distinguishes zero from missing and rejects invalid values', async () => {
    const a = await ex('A')
    const s = await startWorkout({})
    await addExercise({ sessionId: s.id, exerciseId: a.id })
    const id = (await setsOf(s.id))[0].sets[0].id
    expect((await db.sets.get(id))!.weightValue).toBeNull()
    await updateSet(id, { weightValue: 0 })
    expect((await db.sets.get(id))!.weightValue).toBe(0)
    await expect(updateSet(id, { weightValue: -5 })).rejects.toThrow()
    await expect(updateSet(id, { reps: 2.5 })).rejects.toThrow()
    await expect(updateSet(id, { rpe: 11 })).rejects.toThrow()
  })

  it('uncomplete, delete and undo keep numbering consistent', async () => {
    const a = await ex('A')
    const s = await startWorkout({})
    await addExercise({ sessionId: s.id, exerciseId: a.id })
    const we = (await setsOf(s.id))[0].we
    await addSet(we.id)
    await addSet(we.id)
    let sets = (await setsOf(s.id))[0].sets
    expect(sets.map((x) => x.setNumber)).toEqual([1, 2, 3])

    await completeSet(sets[0].id, { weightValue: 10, reps: 5 })
    await uncompleteSet(sets[0].id)
    expect((await db.sets.get(sets[0].id))!.isCompleted).toBe(false)

    const removed = await deleteSet(sets[1].id)
    sets = (await setsOf(s.id))[0].sets
    expect(sets.map((x) => x.setNumber)).toEqual([1, 2])

    await restoreSet(removed!)
    sets = (await setsOf(s.id))[0].sets
    expect(sets.map((x) => x.setNumber)).toEqual([1, 2, 3])
    expect(sets[1].id).toBe(removed!.id)
  })
})

describe('location context', () => {
  it('stamps completed sets with the current location and keeps snapshots after rename/archive', async () => {
    const a = await createLocation({ name: 'Gym A' })
    const b = await createLocation({ name: 'Gym B' })
    const e = await ex('A')
    const s = await startWorkout({ locationId: a.id })
    await addExercise({ sessionId: s.id, exerciseId: e.id })
    await completeSet((await setsOf(s.id))[0].sets[0].id, { weightValue: 50, reps: 10 })
    await addSet((await setsOf(s.id))[0].we.id) // a pending set

    await changeSessionLocation({ sessionId: s.id, locationId: b.id, scope: 'fromNow' })
    const sets = (await setsOf(s.id))[0].sets
    expect(sets[0]).toMatchObject({ locationId: a.id, locationNameSnapshot: 'Gym A' }) // history untouched
    expect(sets[1]).toMatchObject({ locationId: b.id, locationNameSnapshot: 'Gym B' }) // pending set follows

    await completeSet(sets[1].id, { weightValue: 50, reps: 10 })
    expect((await db.sets.get(sets[1].id))!.locationId).toBe(b.id)

    await updateLocation(a.id, { name: 'Gym A (renamed)' })
    await archiveLocation(a.id)
    expect((await db.sets.get(sets[0].id))!.locationNameSnapshot).toBe('Gym A')
  })

  it("scope 'session' relabels the whole workout", async () => {
    const a = await createLocation({ name: 'Gym A' })
    const b = await createLocation({ name: 'Gym B' })
    const e = await ex('A')
    const s = await startWorkout({ locationId: a.id })
    await addExercise({ sessionId: s.id, exerciseId: e.id })
    await completeSet((await setsOf(s.id))[0].sets[0].id, { weightValue: 50, reps: 10 })
    await changeSessionLocation({ sessionId: s.id, locationId: b.id, scope: 'session' })
    const sets = (await setsOf(s.id))[0].sets
    expect(sets.every((x) => x.locationId === b.id)).toBe(true)
  })

  it('allows logging without a location (Unknown / not set)', async () => {
    const e = await ex('A')
    const s = await startWorkout({})
    await addExercise({ sessionId: s.id, exerciseId: e.id })
    await completeSet((await setsOf(s.id))[0].sets[0].id, { weightValue: 10, reps: 10 })
    expect((await setsOf(s.id))[0].sets[0].locationId).toBeNull()
  })
})

describe('substitution', () => {
  async function plannedRoutine() {
    const bench = await ex('Bench')
    const fly = await ex('Fly')
    const now = nowIso()
    const routineId = newId()
    await db.routines.add({
      id: routineId,
      name: 'Push',
      dayTypeId: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    await db.routineExercises.bulkAdd([
      { id: newId(), routineId, exerciseId: bench.id, position: 0, suggestedSets: 3, targetRepMin: 6, targetRepMax: 8 },
      {
        id: newId(),
        routineId,
        exerciseId: fly.id,
        position: 1,
        suggestedSets: 2,
        targetRepMin: null,
        targetRepMax: null,
      },
    ])
    return { bench, fly, routineId }
  }

  it('starts from a routine and snapshots the plan', async () => {
    const { bench, routineId } = await plannedRoutine()
    const s = await startWorkout({ routineId })
    const view = await setsOf(s.id)
    expect(view.map((v) => v.we.performedNameSnapshot)).toEqual(['Bench', 'Fly'])
    expect(view[0].sets).toHaveLength(3)
    expect(view[0].sets[0].reps).toBe(8) // from targetRepMax
    expect(s.routineNameSnapshot).toBe('Push')

    await db.routineExercises.where('routineId').equals(routineId).delete() // later routine edit
    expect((await setsOf(s.id))[0].we.plannedExerciseId).toBe(bench.id)
  })

  it('re-points an untouched exercise and records planned vs performed', async () => {
    const { bench, routineId } = await plannedRoutine()
    const cable = await ex('Cable Press')
    const s = await startWorkout({ routineId })
    const we = (await setsOf(s.id))[0].we
    await substituteExercise({ workoutExerciseId: we.id, performedExerciseId: cable.id, reason: 'occupied' })

    const first = (await setsOf(s.id))[0]
    expect(first.we).toMatchObject({
      plannedExerciseId: bench.id,
      plannedNameSnapshot: 'Bench',
      performedExerciseId: cable.id,
      performedNameSnapshot: 'Cable Press',
      status: 'substituted',
      substitutionReason: 'occupied',
    })
    expect(first.sets).toHaveLength(3)
  })

  it('keeps already logged sets on the original exercise and continues on a new instance', async () => {
    const { bench, routineId } = await plannedRoutine()
    const cable = await ex('Cable Press')
    const s = await startWorkout({ routineId })
    const first = (await setsOf(s.id))[0]
    await completeSet(first.sets[0].id, { weightValue: 80, reps: 8 })

    await substituteExercise({ workoutExerciseId: first.we.id, performedExerciseId: cable.id, reason: 'occupied' })
    const view = await setsOf(s.id)
    expect(view.map((v) => v.we.performedNameSnapshot)).toEqual(['Bench', 'Cable Press', 'Fly'])
    expect(view.map((v) => v.we.position)).toEqual([0, 1, 2])

    // History stays with what was actually performed.
    expect(view[0].sets.filter((x) => x.isCompleted)).toHaveLength(1)
    expect(view[0].sets.every((x) => x.isCompleted)).toBe(true)
    // Pending sets moved to the replacement, which still points at the original plan.
    expect(view[1].we).toMatchObject({ plannedExerciseId: bench.id, status: 'substituted' })
    expect(view[1].sets.length).toBeGreaterThan(0)
    expect(view[1].sets.every((x) => !x.isCompleted)).toBe(true)
    // Weight from the old machine is not carried over to the new exercise.
    expect(view[1].sets[0].weightValue).toBeNull()
  })

  it('removes only exercises without logged sets', async () => {
    const e = await ex('A')
    const s = await startWorkout({})
    const we = await addExercise({ sessionId: s.id, exerciseId: e.id })
    await completeSet((await setsOf(s.id))[0].sets[0].id, { weightValue: 1, reps: 1 })
    await expect(removeExercise(we.id)).rejects.toThrow(/skip/)
  })

  it('reorders exercises', async () => {
    const a = await ex('A')
    const b = await ex('B')
    const s = await startWorkout({})
    await addExercise({ sessionId: s.id, exerciseId: a.id })
    const second = await addExercise({ sessionId: s.id, exerciseId: b.id })
    await moveExercise(second.id, -1)
    expect((await setsOf(s.id)).map((v) => v.we.performedNameSnapshot)).toEqual(['B', 'A'])
  })
})

describe('history-aware defaults', () => {
  it('prefers the last performance at the same location', async () => {
    const a = await createLocation({ name: 'Gym A' })
    const b = await createLocation({ name: 'Gym B' })
    const e = await ex('Leg Press')

    async function workout(loc: string, weight: number) {
      const s = await startWorkout({ locationId: loc })
      await addExercise({ sessionId: s.id, exerciseId: e.id })
      await completeSet((await setsOf(s.id))[0].sets[0].id, { weightValue: weight, reps: 10 })
      await finishWorkout({ sessionId: s.id })
    }
    await workout(a.id, 100)
    await new Promise((r) => setTimeout(r, 5))
    await workout(b.id, 140) // most recent, but at a different gym

    expect((await getLastPerformance(e.id, { locationId: a.id }))!.sets[0].weightValue).toBe(100)
    expect((await getLastPerformance(e.id, { locationId: b.id }))!.sets[0].weightValue).toBe(140)
    expect((await getLastPerformance(e.id, { locationId: null }))!.sets[0].weightValue).toBe(140)

    // Next workout at Gym A pre-fills from Gym A, not from the heavier Gym B machine.
    const s = await startWorkout({ locationId: a.id })
    await addExercise({ sessionId: s.id, exerciseId: e.id })
    expect((await setsOf(s.id))[0].sets[0].weightValue).toBe(100)
  })
})

describe('exercise catalogue', () => {
  it('seeds once and finds exercises by alias, muscle and with a typo', async () => {
    const n = await seedStarterExercises()
    expect(n).toBeGreaterThan(30)
    expect(await seedStarterExercises()).toBe(0)
    const all = await db.exercises.toArray()
    expect(searchExercises(all, 'beinpresse')[0].name).toBe('Leg Press')
    expect(searchExercises(all, 'bankdrucken')[0].name).toBe('Barbell Bench Press')
    expect(searchExercises(all, 'lat pull')[0].name).toBe('Lat Pulldown')
    expect(searchExercises(all, 'bicep').map((e) => e.name)).toContain('Hammer Curl')
    expect(searchExercises(all, 'pulldwn')[0]?.name).toBe('Lat Pulldown')
  })

  it('does not create duplicates by name or alias', async () => {
    await seedStarterExercises()
    const dup = await createCustomExercise({ name: 'beinpresse' })
    expect(dup.created).toBe(false)
    expect(dup.exercise.name).toBe('Leg Press')
    expect((await createCustomExercise({ name: 'My Cable Thing' })).created).toBe(true)
  })
})
