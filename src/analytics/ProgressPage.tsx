import { useSearchParams } from 'react-router-dom'
import { TrophiesTab } from '../achievements/TrophiesTab'
import { ActivityHeatmap } from './ActivityHeatmap'
import { ExerciseProgress } from './ExerciseProgress'
import { Insights } from './Insights'

const TABS = [
  ['activity', 'Activity'],
  ['exercises', 'Exercises'],
  ['insights', 'Insights'],
  ['trophies', 'Trophies'],
] as const
type TabId = (typeof TABS)[number][0]

export function ProgressPage() {
  // In the URL, so a milestone tile can link straight to the trophies.
  const [params, setParams] = useSearchParams()
  const tab: TabId = TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'activity'
  const setTab = (id: TabId) => setParams(id === 'activity' ? {} : { tab: id }, { replace: true })
  return (
    <main className="content">
      <div className="page-head">
        <h1>Progress</h1>
      </div>
      <div className="tabs" role="tablist" aria-label="Progress sections">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'activity' ? (
        <ActivityHeatmap />
      ) : tab === 'exercises' ? (
        <ExerciseProgress />
      ) : tab === 'insights' ? (
        <Insights />
      ) : (
        <TrophiesTab />
      )}
    </main>
  )
}
