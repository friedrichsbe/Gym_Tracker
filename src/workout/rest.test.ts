import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../data/db'
import { updateSettings } from '../data/settings'
import { createCustomExercise, updateExercise } from '../exercises/exerciseService'
import { getRestSuggestion } from './restService'
import { adjustRest, formatClock, remainingSeconds, resetRestTimerForTests, startRest, stopRest } from './restTimer'
import {
  addExercise,
  addSet,
  completeSet,
  linkSuperset,
  loadSessionView,
  startWorkout,
  updateSet,
} from './workoutService'

const ex = async (name: string) => (await createCustomExercise({ name })).exercise

async function workout(names: string[]) {
  const exs = []
  for (const n of names) exs.push(await ex(n))
  const s = await startWorkout({})
  for (const e of exs) await addExercise({ sessionId: s.id, exerciseId: e.id })
  const view = async () => (await loadSessionView(s.id))!.exercises
  return { s, exs, view }
}

describe('rest suggestions', () => {
  it('uses the global default, a per-exercise override, and nothing after warm-ups', async () => {
    const t = await workout(['A', 'B'])
    await updateSettings({ restDefaultSeconds: 120 })
    await updateExercise(t.exs[1].id, { defaultRestSeconds: 45 })

    const a = (await t.view())[0].sets[0]
    await updateSet(a.id, { setType: 'warmup' })
    await completeSet(a.id, { weightValue: 20, reps: 10 })
    expect(await getRestSuggestion(a.id)).toBeNull()

    await addSet((await t.view())[0].we.id)
    const a2 = (await t.view())[0].sets[1]
    await completeSet(a2.id, { weightValue: 60, reps: 8 })
    expect(await getRestSuggestion(a2.id)).toEqual({ seconds: 120, label: 'A' })

    const b = (await t.view())[1].sets[0]
    await completeSet(b.id, { weightValue: 30, reps: 12 })
    expect(await getRestSuggestion(b.id)).toEqual({ seconds: 45, label: 'B' })
  })

  it('returns nothing for sets that are not completed', async () => {
    const t = await workout(['A'])
    expect(await getRestSuggestion((await t.view())[0].sets[0].id)).toBeNull()
    expect(await getRestSuggestion('nope')).toBeNull()
  })

  it('in a superset rests only after the last member of each round, using the longest rest', async () => {
    const t = await workout(['A', 'B', 'C'])
    await linkSuperset((await t.view())[0].we.id) // A + B
    await updateExercise(t.exs[0].id, { defaultRestSeconds: 60 })
    await updateExercise(t.exs[1].id, { defaultRestSeconds: 100 })

    // Round 1: A first -> partner is up next, no rest.
    const a1 = (await t.view())[0].sets[0]
    await completeSet(a1.id, { weightValue: 20, reps: 10 })
    expect(await getRestSuggestion(a1.id)).toBeNull()
    // B completes the round -> rest for the pair.
    const b1 = (await t.view())[1].sets[0]
    await completeSet(b1.id, { weightValue: 30, reps: 10 })
    expect(await getRestSuggestion(b1.id)).toEqual({ seconds: 100, label: 'A + B' })
    // Round 2 starts with A again: still no rest.
    await addSet((await t.view())[0].we.id)
    const a2 = (await t.view())[0].sets[1]
    await completeSet(a2.id, { weightValue: 20, reps: 10 })
    expect(await getRestSuggestion(a2.id)).toBeNull()
    // The exercise outside the superset behaves normally.
    const c = (await t.view())[2].sets[0]
    await completeSet(c.id, { weightValue: 10, reps: 10 })
    expect((await getRestSuggestion(c.id))?.label).toBe('C')
  })

  it('ignores skipped superset members', async () => {
    const t = await workout(['A', 'B'])
    await linkSuperset((await t.view())[0].we.id)
    await db.workoutExercises.update((await t.view())[1].we.id, { status: 'skipped' })
    const a1 = (await t.view())[0].sets[0]
    await completeSet(a1.id, { weightValue: 20, reps: 10 })
    expect((await getRestSuggestion(a1.id))?.seconds).toBeGreaterThan(0) // partner skipped: nobody to alternate with
    await beforeEachSettings()
  })
})

async function beforeEachSettings() {
  await updateSettings({ restDefaultSeconds: 90 })
}

describe('rest timer state', () => {
  beforeEach(() => resetRestTimerForTests())

  it('counts down from an absolute end time, rounding up', () => {
    startRest(90, 'Leg Press', 1_000_000)
    const state = JSON.parse(localStorage.getItem('gt-rest-timer')!)
    expect(state).toMatchObject({ endsAt: 1_090_000, durationSec: 90, label: 'Leg Press' })
    expect(remainingSeconds(state, 1_000_000)).toBe(90)
    expect(remainingSeconds(state, 1_000_001)).toBe(90) // 89.999 s left shows 90
    expect(remainingSeconds(state, 1_089_100)).toBe(1)
    expect(remainingSeconds(state, 1_090_000)).toBe(0)
    expect(remainingSeconds(state, 2_000_000)).toBe(0) // never negative, even after a long sleep
  })

  it('adjusts by ±15 s but never below zero, and clears on stop', () => {
    startRest(20, 'x', 5_000)
    adjustRest(15, 6_000)
    expect(JSON.parse(localStorage.getItem('gt-rest-timer')!)).toMatchObject({ endsAt: 40_000, durationSec: 35 })
    adjustRest(-15, 6_000)
    adjustRest(-15, 6_000)
    adjustRest(-15, 6_000)
    const s = JSON.parse(localStorage.getItem('gt-rest-timer')!)
    expect(s.endsAt).toBeGreaterThanOrEqual(6_000)
    expect(s.durationSec).toBeGreaterThanOrEqual(1)
    stopRest()
    expect(localStorage.getItem('gt-rest-timer')).toBeNull()
    adjustRest(15) // no timer: nothing happens
    expect(localStorage.getItem('gt-rest-timer')).toBeNull()
  })

  it('formats the clock', () => {
    expect([formatClock(0), formatClock(9), formatClock(90), formatClock(600)]).toEqual([
      '0:00',
      '0:09',
      '1:30',
      '10:00',
    ])
  })
})
