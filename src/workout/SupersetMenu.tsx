import { useState } from 'react'
import type { DayType } from '../domain/types'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { IconArrowDown, IconArrowUp, IconMore, IconPlay } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { supersetLabel } from './supersets'
import {
  moveExercise,
  moveExerciseNext,
  removeSuperset,
  restoreSuperset,
  skipSuperset,
  substituteExercise,
  type WorkoutExerciseView,
} from './workoutService'

/** The ⋯ menu of a superset frame: moves, skips or removes the superset as a whole. */
export function SupersetMenu(props: {
  block: WorkoutExerciseView[]
  isFirst: boolean
  isLast: boolean
  canDoNext: boolean
  day: DayType | null
  extraFitIds?: ReadonlySet<string>
}) {
  const { block, isFirst, isLast, canDoNext, day, extraFitIds } = props
  const { guard, show } = useToast()
  const [open, setOpen] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [replacing, setReplacing] = useState<WorkoutExerciseView | null>(null)
  const label = supersetLabel(block.length)
  const first = block[0].we.id
  const hasCompleted = block.some((v) => v.sets.some((s) => s.isCompleted))
  const allSkipped = block.every((v) => v.we.status === 'skipped')
  const close = () => {
    setOpen(false)
    setChoosing(false)
  }

  return (
    <>
      <button
        type="button"
        className="btn ghost icon small superset-more"
        aria-label={`Options for this ${label.toLowerCase()}`}
        onClick={() => setOpen(true)}
      >
        <IconMore />
      </button>

      <Sheet open={open} title={label} onClose={close}>
        <p className="small secondary">{block.map((v) => v.we.performedNameSnapshot).join(' + ')}</p>
        {choosing ? (
          <>
            <p className="field-label">Which exercise do you want to replace?</p>
            {block.map((v) => (
              <button
                key={v.we.id}
                type="button"
                className="btn block"
                onClick={() => {
                  close()
                  setReplacing(v)
                }}
              >
                {v.we.performedNameSnapshot}
              </button>
            ))}
            <button type="button" className="btn ghost block" onClick={() => setChoosing(false)}>
              Back
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn block" onClick={() => setChoosing(true)}>
              Replace an exercise…
            </button>
            <div className="row">
              <button
                type="button"
                className="btn grow"
                disabled={isFirst}
                onClick={() => void guard(() => moveExercise(first, -1))}
              >
                <IconArrowUp />
                Move up
              </button>
              <button
                type="button"
                className="btn grow"
                disabled={isLast}
                onClick={() => void guard(() => moveExercise(first, 1))}
              >
                <IconArrowDown />
                Move down
              </button>
              <button
                type="button"
                className="btn grow"
                disabled={!canDoNext}
                onClick={() => {
                  close()
                  void guard(() => moveExerciseNext(first))
                }}
              >
                <IconPlay />
                Do next
              </button>
            </div>
            <button
              type="button"
              className="btn block"
              disabled={hasCompleted && !allSkipped}
              onClick={() => {
                close()
                void guard(() => skipSuperset(first, !allSkipped))
              }}
            >
              {allSkipped ? `Unskip ${label.toLowerCase()}` : `Skip ${label.toLowerCase()}`}
            </button>
            {!hasCompleted && (
              <button
                type="button"
                className="btn danger block"
                onClick={() => {
                  close()
                  void guard(async () => {
                    const removed = await removeSuperset(first)
                    if (removed)
                      show(`${label} removed`, {
                        actionLabel: 'Undo',
                        onAction: () => void guard(() => restoreSuperset(removed)),
                      })
                  })
                }}
              >
                Remove {label.toLowerCase()} from workout
              </button>
            )}
            {hasCompleted && (
              <p className="hint">
                A {label.toLowerCase()} with logged sets can’t be removed or skipped — replace an exercise or delete the
                sets instead.
              </p>
            )}
          </>
        )}
      </Sheet>

      <ExercisePicker
        open={replacing !== null}
        mode="replace"
        day={day}
        extraFitIds={extraFitIds}
        replacing={replacing?.we.performedNameSnapshot}
        onClose={() => setReplacing(null)}
        onPick={(exercise, reason) => {
          const target = replacing
          if (target)
            void guard(() =>
              substituteExercise({ workoutExerciseId: target.we.id, performedExerciseId: exercise.id, reason }),
            )
        }}
      />
    </>
  )
}
