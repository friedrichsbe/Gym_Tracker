import { useLiveQuery } from 'dexie-react-hooks'
import { ActiveWorkout } from './ActiveWorkout'
import { WorkoutHome } from './WorkoutHome'
import { getActiveSession } from './workoutService'

export function WorkoutPage() {
  // null = no active workout, undefined = still loading
  const active = useLiveQuery(async () => (await getActiveSession()) ?? null, [])
  if (active === undefined) return null
  return <main className="content">{active ? <ActiveWorkout sessionId={active.id} /> : <WorkoutHome />}</main>
}
