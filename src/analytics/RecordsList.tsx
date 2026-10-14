import { useLiveQuery } from 'dexie-react-hooks'
import { describeRecord, sessionRecords } from './records'

/** New personal records of a workout; renders nothing when there are none. */
export function RecordsList({ sessionId, active }: { sessionId: string; active?: boolean }) {
  const records = useLiveQuery(() => sessionRecords(sessionId), [sessionId, active])
  if (!records || records.length === 0) return null
  return (
    <div className="card stack callout" aria-label="New records">
      <h2>{records.length === 1 ? 'New record' : `${records.length} new records`}</h2>
      <ul className="records">
        {records.map((r) => (
          <li key={`${r.exerciseId}-${r.kind}`}>
            <span className="tag record">PR</span>
            <strong>{r.name}</strong>
            <span className="secondary small">{describeRecord(r)}</span>
          </li>
        ))}
      </ul>
      <p className="hint">Compared with your earlier workouts at the same location.</p>
    </div>
  )
}
