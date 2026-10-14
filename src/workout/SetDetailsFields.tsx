import type { SetRecord } from '../domain/types'
import { useToast } from '../ui/toastContext'
import { updateSet } from './workoutService'

const RPE_VALUES = [6, 7, 8, 9, 10]
const RIR_VALUES = [0, 1, 2, 3, 4]

/** Optional effort and note for one set. Tapping the active chip clears it again. */
export function SetDetailsFields({ set }: { set: SetRecord }) {
  const { guard } = useToast()
  return (
    <>
      <div className="field-label">RPE (how hard, 10 = max)</div>
      <div className="chip-row" role="group" aria-label="RPE">
        {RPE_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            className="chip"
            aria-pressed={set.rpe === v}
            onClick={() => void guard(() => updateSet(set.id, { rpe: set.rpe === v ? null : v }))}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="field-label">RIR (reps left in the tank)</div>
      <div className="chip-row" role="group" aria-label="RIR">
        {RIR_VALUES.map((v) => (
          <button
            key={v}
            type="button"
            className="chip"
            aria-pressed={set.rir === v}
            onClick={() => void guard(() => updateSet(set.id, { rir: set.rir === v ? null : v }))}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor={`note-${set.id}`}>Note for this set</label>
        <input
          id={`note-${set.id}`}
          type="text"
          key={set.updatedAt}
          defaultValue={set.notes ?? ''}
          autoComplete="off"
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v !== (set.notes ?? '')) void guard(() => updateSet(set.id, { notes: v || undefined }))
          }}
        />
      </div>
    </>
  )
}
