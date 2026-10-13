import { useState } from 'react'
import { ActivityHeatmap } from './ActivityHeatmap'
import { ExerciseProgress } from './ExerciseProgress'

export function ProgressPage() {
  const [tab, setTab] = useState<'activity' | 'exercises'>('activity')
  return (
    <main className="content">
      <div className="page-head">
        <h1>Progress</h1>
      </div>
      <div className="tabs" role="tablist" aria-label="Progress sections">
        {(
          [
            ['activity', 'Activity'],
            ['exercises', 'Exercises'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'activity' ? <ActivityHeatmap /> : <ExerciseProgress />}
    </main>
  )
}
