import { useState } from 'react'
import type { LoadType, SetRecord, SetType } from '../domain/types'
import { NumericField } from '../ui/NumericField'
import { IconCheck } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { useSettings } from '../data/hooks'
import { getRestSuggestion } from './restService'
import { startRest } from './restTimer'
import { SetDetailsFields } from './SetDetailsFields'
import { completeSet, deleteSet, restoreSet, toggleSide, uncompleteSet, updateSet } from './workoutService'

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

export function SetRow({ set, label, unilateral = false }: { set: SetRecord; label: string; unilateral?: boolean }) {
  const { guard, show } = useToast()
  const settings = useSettings()
  const [menu, setMenu] = useState(false)
  const unit = set.weightUnit
  // Rest timer: only after working sets, and in a superset only after the last member of the round.
  const startRestAfter = async () => {
    if (!settings.restAutoStart) return
    const rest = await getRestSuggestion(set.id)
    if (rest) startRest(rest.seconds, rest.label)
  }
  const weightHint = set.loadType === 'bodyweight' ? `BW +${unit}` : set.loadType === 'assisted' ? `−${unit}` : unit

  return (
    <>
      <div className={`set-row ${set.isCompleted ? 'done' : ''}`}>
        <button
          type="button"
          className={`set-badge num ${set.setType === 'warmup' ? 'warmup' : ''} ${set.rpe != null || set.rir != null || set.notes ? 'has-detail' : ''}`}
          aria-label={`${label}, ${TYPE_LABEL[set.setType]}. Open set options`}
          onClick={() => setMenu(true)}
        >
          {TYPE_SHORT[set.setType] || set.setNumber}
        </button>
        <NumericField
          label={`${label} weight (${weightHint})`}
          value={set.weightValue}
          onCommit={(v) => void guard(() => updateSet(set.id, { weightValue: v }))}
        />
        <NumericField
          label={`${label} reps`}
          integer
          value={set.reps}
          onCommit={(v) => void guard(() => updateSet(set.id, { reps: v }))}
        />
        {unilateral ? (
          <span className="side-btns">
            {(['left', 'right'] as const).map((side) => {
              const on = set.isCompleted || set.sideDone === side
              return (
                <button
                  key={side}
                  type="button"
                  className={`complete-btn side ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  aria-label={`${label} ${side} side`}
                  onClick={() =>
                    void guard(async () => {
                      // Rest only starts once both sides are ticked.
                      if (await toggleSide(set.id, side)) await startRestAfter()
                    })
                  }
                >
                  {on && <IconCheck />}
                </button>
              )
            })}
          </span>
        ) : (
          <button
            type="button"
            className="complete-btn"
            aria-pressed={set.isCompleted}
            aria-label={set.isCompleted ? `${label} completed. Tap to undo` : `Complete ${label}`}
            onClick={() =>
              void guard(async () => {
                if (set.isCompleted) return uncompleteSet(set.id)
                await completeSet(set.id)
                await startRestAfter()
              })
            }
          >
            {set.isCompleted && <IconCheck />}
          </button>
        )}
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
        <SetDetailsFields set={set} />
        <button
          type="button"
          className="btn danger block"
          onClick={() => {
            setMenu(false)
            void guard(async () => {
              const removed = await deleteSet(set.id)
              if (removed) {
                show(`${label} deleted`, {
                  actionLabel: 'Undo',
                  onAction: () => void guard(() => restoreSet(removed)),
                })
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
