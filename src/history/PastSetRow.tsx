import { useState } from 'react'
import type { LoadType, SetRecord, SetType } from '../domain/types'
import { NumericField } from '../ui/NumericField'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { deleteSet, restoreSet, updateSet } from '../workout/workoutService'

const TYPE_LABEL: Record<SetType, string> = {
  working: 'Working set',
  warmup: 'Warm-up',
  drop: 'Drop set',
  failure: 'To failure',
  other: 'Other',
}
const TYPE_SHORT: Record<SetType, string> = { working: '', warmup: 'W', drop: 'D', failure: 'F', other: '•' }
const LOAD_LABEL: Record<LoadType, string> = {
  weight: 'Added weight (machine / bar / dumbbell)',
  bodyweight: 'Bodyweight (+ optional extra weight)',
  assisted: 'Assisted (counterweight / band)',
}

/** One set of a finished workout: everything can be corrected, including type, load kind and deleting it. */
export function PastSetRow({ set }: { set: SetRecord }) {
  const { guard, show } = useToast()
  const [menu, setMenu] = useState(false)
  const label = `Set ${set.setNumber}`
  const hint =
    set.loadType === 'bodyweight'
      ? `BW +${set.weightUnit}`
      : set.loadType === 'assisted'
        ? `−${set.weightUnit}`
        : set.weightUnit
  const missing = set.weightValue == null && set.reps == null

  return (
    <>
      <div className={`set-row done ${missing ? 'incomplete' : ''}`}>
        <button
          type="button"
          className={`set-badge num ${set.setType === 'warmup' ? 'warmup' : ''}`}
          aria-label={`${label}, ${TYPE_LABEL[set.setType]}. Open set options`}
          onClick={() => setMenu(true)}
        >
          {TYPE_SHORT[set.setType] || set.setNumber}
        </button>
        <NumericField
          label={`${label} weight (${hint})`}
          value={set.weightValue}
          onCommit={(v) => void guard(() => updateSet(set.id, { weightValue: v }))}
        />
        <NumericField
          label={`${label} reps`}
          integer
          value={set.reps}
          onCommit={(v) => void guard(() => updateSet(set.id, { reps: v }))}
        />
        <span className="set-type-label">{set.setType === 'working' ? '' : TYPE_LABEL[set.setType]}</span>
      </div>

      <Sheet open={menu} title={label} onClose={() => setMenu(false)}>
        <div className="field-label">Set type</div>
        <div className="chip-row" role="group" aria-label="Set type">
          {(Object.keys(TYPE_LABEL) as SetType[]).map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={set.setType === t}
              onClick={() => void guard(() => updateSet(set.id, { setType: t }))}
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="field-label">Load</div>
        <div className="stack tight" role="group" aria-label="Load type">
          {(Object.keys(LOAD_LABEL) as LoadType[]).map((t) => (
            <button
              key={t}
              type="button"
              className="chip"
              aria-pressed={set.loadType === t}
              onClick={() => void guard(() => updateSet(set.id, { loadType: t }))}
            >
              {LOAD_LABEL[t]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn danger block"
          onClick={() => {
            setMenu(false)
            void guard(async () => {
              const removed = await deleteSet(set.id)
              if (removed) {
                show(`${label} deleted`, { actionLabel: 'Undo', onAction: () => void guard(() => restoreSet(removed)) })
              }
            })
          }}
        >
          Delete set
        </button>
      </Sheet>
    </>
  )
}
