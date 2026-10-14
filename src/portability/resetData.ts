import { db } from '../data/db'

/** Deletes every record and all settings; the app returns to first-run onboarding. */
export async function resetAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.locations,
      db.exercises,
      db.dayTypes,
      db.routines,
      db.routineExercises,
      db.sessions,
      db.workoutExercises,
      db.sets,
      db.cardio,
      db.settings,
    ],
    async () => {
      await Promise.all(
        [
          db.locations,
          db.exercises,
          db.dayTypes,
          db.routines,
          db.routineExercises,
          db.sessions,
          db.workoutExercises,
          db.sets,
          db.cardio,
          db.cardio,
          db.settings,
        ].map((t) => t.clear()),
      )
    },
  )
}
