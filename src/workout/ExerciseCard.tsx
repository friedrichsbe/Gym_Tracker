import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import type { DayType } from '../domain/types'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { formatDate, formatSetsCompact } from '../ui/format'
import { IconArrowDown, IconArrowUp, IconMore, IconPlus } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { SetRow } from './SetRow'
import {
  addSet,
  getLastPerformance,
  linkSuperset,
  unlinkSuperset,
  moveExercise,
  removeExercise,
  skipExercise,
  substituteExercise,
  type WorkoutExerciseView,
} from './workoutService'

interface Props {
  view: WorkoutExerciseView
  sessionId: string
  locationId: string | null
  isFirst: boolean
  isLast: boolean
  /** Part of a superset (then up/down move the whole superset). */
  inSuperset: boolean
  /** The exercise below could be paired with this one. */
  canLinkNext: boolean
  day: DayType | null
  extraFitIds?: ReadonlySet<string>
}

export function ExerciseCard({
  view,
  sessionId,
  locationId,
  isFirst,
  isLast,
  inSuperset,
  canLinkNext,
  day,
  extraFitIds,
}: Props) {
  const { we, sets } = view
  const { guard } = useToast()
  const [menu, setMenu] = useState(false)
  const [replacing, setReplacing] = useState(false)

  const last = useLiveQuery(
    () => getLastPerformance(we.performedExerciseId, { locationId, excludeSessionId: sessionId }),
    [we.performedExerciseId, locationId, sessionId],
  )
  const hasCompleted = sets.some((s) => s.isCompleted)
  const skipped = we.status === 'skipped'
  const substituted = we.plannedExerciseId && we.plannedExerciseId !== we.performedExerciseId

  return (
    <section
      className={`card exercise ${skipped ? 'skipped' : ''} ${we.isForeign ? 'foreign' : ''}`}
      aria-label={we.performedNameSnapshot}
    >
      <div className="exercise-head">
        <div className="grow stack tight">
          <h3 className="exercise-name">{we.performedNameSnapshot}</h3>
          {(substituted || we.isForeign || skipped) && (
            <div className="chip-row">
              {substituted && (
                <span className="tag sub">
                  Replaces {we.plannedNameSnapshot}
                  {we.substitutionReason ? ` · ${we.substitutionReason}` : ''}
                </span>
              )}
              {we.isForeign && <span className="tag foreign">Outside {day?.name ?? 'plan'}</span>}
              {skipped && <span className="tag">Skipped</span>}
            </div>
          )}
          {last && (
            <p className="last-line num">
              Last: {formatSetsCompact(last.sets)} {last.sets[0]?.weightUnit} · {formatDate(last.startedAt)}
              {!last.sameLocation && locationId && (
                <>
                  {' '}
                  · <strong>{last.locationName ?? 'other location'}</strong> (not comparable)
                </>
              )}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn ghost icon"
          aria-label={`Options for ${we.performedNameSnapshot}`}
          onClick={() => setMenu(true)}
        >
          <IconMore />
        </button>
      </div>

      {!skipped && (
        <>
          <div className="set-grid" aria-hidden="true">
            <span className="set-grid-head">Set</span>
            <span className="set-grid-head">{sets[0]?.weightUnit ?? 'kg'}</span>
            <span className="set-grid-head">Reps</span>
            <span />
          </div>
          <div className="set-grid">
            {sets.map((s) => (
              <SetRow key={s.id} set={s} label={`Set ${s.setNumber}`} />
            ))}
          </div>
          <button type="button" className="btn ghost block small" onClick={() => void guard(() => addSet(we.id))}>
            <IconPlus />
            Add set
          </button>
        </>
      )}

      <Sheet open={menu} title={we.performedNameSnapshot} onClose={() => setMenu(false)}>
        <button
          type="button"
          className="btn block"
          onClick={() => {
            setMenu(false)
            setReplacing(true)
          }}
        >
          Replace exercise
        </button>
        {canLinkNext && !skipped && (
          <button
            type="button"
            className="btn block"
            onClick={() => {
              setMenu(false)
              void guard(() => linkSuperset(we.id))
            }}
          >
            Superset with the next exercise
          </button>
        )}
        {inSuperset && (
          <button
            type="button"
            className="btn block"
            onClick={() => {
              setMenu(false)
              void guard(() => unlinkSuperset(we.id))
            }}
          >
            Take out of superset
          </button>
        )}
        <div className="row">
          <button
            type="button"
            className="btn grow"
            disabled={isFirst}
            onClick={() => void guard(() => moveExercise(we.id, -1))}
          >
            <IconArrowUp />
            Move {inSuperset ? 'superset ' : ''}up
          </button>
          <button
            type="button"
            className="btn grow"
            disabled={isLast}
            onClick={() => void guard(() => moveExercise(we.id, 1))}
          >
            <IconArrowDown />
            Move {inSuperset ? 'superset ' : ''}down
          </button>
        </div>
        <button
          type="button"
          className="btn block"
          disabled={hasCompleted && !skipped}
          onClick={() => {
            setMenu(false)
            void guard(() => skipExercise(we.id, !skipped))
          }}
        >
          {skipped ? 'Unskip exercise' : 'Skip exercise'}
        </button>
        {!hasCompleted && (
          <button
            type="button"
            className="btn danger block"
            onClick={() => {
              setMenu(false)
              void guard(() => removeExercise(we.id))
            }}
          >
            Remove from workout
          </button>
        )}
        {hasCompleted && (
          <p className="hint">
            Exercises with logged sets can’t be removed or skipped — replace it or delete the sets instead.
          </p>
        )}
      </Sheet>

      <ExercisePicker
        open={replacing}
        mode="replace"
        day={day}
        extraFitIds={extraFitIds}
        replacing={we.performedNameSnapshot}
        onClose={() => setReplacing(false)}
        onPick={(exercise, reason) =>
          void guard(() => substituteExercise({ workoutExerciseId: we.id, performedExerciseId: exercise.id, reason }))
        }
      />
    </section>
  )
}
