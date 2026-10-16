import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RecordsList } from '../analytics/RecordsList'
import { CardioSection } from '../cardio/CardioSection'
import { isRunning, loadCardio } from '../cardio/cardioService'
import { addExerciseToDayType, fitsDay } from '../daytypes/dayTypeService'
import { db } from '../data/db'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { LocationPicker } from '../locations/LocationPicker'
import { useNow } from '../data/hooks'
import { instant } from '../domain/time'
import { formatDuration, formatDurationShort, formatVolume } from '../ui/format'
import { IconDumbbell, IconPin, IconPlus } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { ExerciseCard } from './ExerciseCard'
import { RestTimerBar } from './RestTimerBar'
import { stopRest } from './restTimer'
import { SupersetFrame } from './SupersetFrame'
import { toBlocks } from './supersets'
import {
  addExercise,
  changeSessionLocation,
  discardWorkout,
  finishWorkout,
  loadSessionView,
  summarizeSession,
  type WorkoutSummary,
} from './workoutService'

export function ActiveWorkout({ sessionId }: { sessionId: string }) {
  const { guard, show } = useToast()
  const navigate = useNavigate()
  const data = useLiveQuery(() => loadSessionView(sessionId), [sessionId])
  const dayTypeId = data?.session.dayTypeId ?? null
  const routineId = data?.session.routineId ?? null
  const day =
    useLiveQuery(async () => (dayTypeId ? ((await db.dayTypes.get(dayTypeId)) ?? null) : null), [dayTypeId]) ?? null
  const routineExerciseIds = useLiveQuery(
    async () =>
      routineId
        ? (await db.routineExercises.where('routineId').equals(routineId).toArray()).map((r) => r.exerciseId)
        : [],
    [routineId],
  )
  const cardio = useLiveQuery(() => loadCardio(sessionId), [sessionId]) ?? []
  const extraFitIds = useMemo(() => new Set(routineExerciseIds ?? []), [routineExerciseIds])
  const now = useNow()
  const [pickingExercise, setPickingExercise] = useState(false)
  const [pickingLocation, setPickingLocation] = useState(false)
  const [finishing, setFinishing] = useState(false)

  if (!data) return null
  const { session, exercises } = data
  const logged = exercises.some((e) => e.sets.some((s) => s.isCompleted))
  const locationName = data.location?.name ?? session.locationNameSnapshot
  const blocks = toBlocks(exercises, (e) => e.we.supersetGroupId)

  return (
    <>
      <div className="workout-bar">
        <span className="elapsed" aria-label="Elapsed time">
          <span className="l" aria-hidden="true">
            <i className="live-dot" />
            Live
          </span>
          <span className="v num">{formatDuration((now - instant(session.startedAt)) / 1000)}</span>
        </span>
        <button
          type="button"
          className={`chip grow ${locationName ? '' : 'warn'}`}
          onClick={() => setPickingLocation(true)}
          aria-label={`Location: ${locationName ?? 'not set'}. Change`}
        >
          <IconPin />
          <span>{locationName ?? 'Location not set'}</span>
        </button>
        <button type="button" className="btn primary" onClick={() => setFinishing(true)}>
          Finish
        </button>
        <RestTimerBar />
      </div>

      <div className="page-title">
        <span className="overline">
          {session.routineNameSnapshot ? `Preset · ${session.routineNameSnapshot}` : 'Workout'}
        </span>
        <h1>{session.dayTypeNameSnapshot ? `${session.dayTypeNameSnapshot} day` : 'Free workout'}</h1>
      </div>

      <PartDivider label="Cardio before" />
      <CardioSection sessionId={session.id} slot="start" entries={cardio} canAdd={!logged} />

      <PartDivider label="Strength" />

      {exercises.length === 0 && (
        <div className="empty card">
          <span className="empty-icon">
            <IconDumbbell />
          </span>
          <p className="empty-title">No exercises yet</p>
          <p>Add your first exercise to start logging.</p>
        </div>
      )}

      {blocks.map((block, bi) => {
        const cards = block.map((view) => {
          const i = exercises.indexOf(view)
          const next = exercises[i + 1]
          const gid = view.we.supersetGroupId ?? null
          return (
            <ExerciseCard
              key={view.we.id}
              view={view}
              sessionId={session.id}
              locationId={session.locationId}
              isFirst={bi === 0}
              isLast={bi === blocks.length - 1}
              inSuperset={block.length > 1}
              canLinkNext={!!next && (gid === null || next.we.supersetGroupId !== gid)}
              day={day}
              extraFitIds={extraFitIds}
            />
          )
        })
        return block.length > 1 ? (
          <SupersetFrame key={block[0].we.id} size={block.length} hint={nextInSuperset(block)}>
            {cards}
          </SupersetFrame>
        ) : (
          cards
        )
      })}

      <button type="button" className="btn block dashed big" onClick={() => setPickingExercise(true)}>
        <IconPlus />
        Add exercise
      </button>

      <PartDivider label="Cardio after" />
      <CardioSection sessionId={session.id} slot="end" entries={cardio} />

      <ExercisePicker
        open={pickingExercise}
        mode="add"
        day={day}
        extraFitIds={extraFitIds}
        onClose={() => setPickingExercise(false)}
        onPick={(exercise) =>
          void guard(async () => {
            await addExercise({ sessionId: session.id, exerciseId: exercise.id })
            if (day && !fitsDay(exercise, day, extraFitIds)) {
              show(`${exercise.name} is outside ${day.name} day`, {
                actionLabel: `Count as ${day.name}`,
                onAction: () => void guard(() => addExerciseToDayType(day.id, exercise.id)),
              })
            }
          })
        }
      />

      <LocationPicker
        open={pickingLocation}
        currentId={session.locationId}
        askScope
        hasLoggedSets={logged}
        onClose={() => setPickingLocation(false)}
        onSelect={(locationId, scope) =>
          void guard(() => changeSessionLocation({ sessionId: session.id, locationId, scope }))
        }
      />

      <FinishSheet
        open={finishing}
        sessionId={session.id}
        cardioRunning={cardio.some(isRunning)}
        onClose={() => setFinishing(false)}
        onFinish={async (notes) => {
          const summary = await guard(() => finishWorkout({ sessionId: session.id, notes }))
          if (summary) {
            stopRest()
            show(`Workout saved · ${summary.completedSets} sets`)
            navigate(`/history/${session.id}`, { state: { justFinished: true } })
          }
        }}
        onDiscard={async () => {
          await guard(() => discardWorkout(session.id))
          stopRest()
          show('Workout discarded')
        }}
      />
    </>
  )
}

function FinishSheet(props: {
  open: boolean
  sessionId: string
  cardioRunning: boolean
  onClose: () => void
  onFinish: (notes: string) => Promise<void>
  onDiscard: () => Promise<void>
}) {
  const { open, sessionId, cardioRunning, onClose, onFinish, onDiscard } = props
  const [notes, setNotes] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const summary: WorkoutSummary | undefined = useLiveQuery(
    () => (open ? summarizeSession(sessionId) : undefined),
    [open, sessionId],
  )
  const empty = summary && summary.completedSets === 0 && summary.cardioCount === 0

  return (
    <Sheet open={open} title={empty ? 'Nothing logged yet' : 'Finish workout?'} onClose={onClose}>
      {summary && !empty && (
        <div className="summary-grid">
          <div className="metric">
            <div className="v num">{summary.completedSets}</div>
            <div className="l">sets completed</div>
          </div>
          <div className="metric">
            <div className="v num">{summary.exercisesDone}</div>
            <div className="l">
              exercises{summary.exercisesSkipped ? ` (${summary.exercisesSkipped} not done)` : ''}
            </div>
          </div>
          <div className="metric">
            <div className="v num">{formatVolume(summary.volume)}</div>
            <div className="l">volume (load × reps)</div>
          </div>
          <div className="metric">
            <div className="v num">{summary.workingSets}</div>
            <div className="l">working sets</div>
          </div>
        </div>
      )}
      {summary && !empty && summary.cardioCount > 0 && (
        <p className="secondary small">
          Cardio: {summary.cardioCount} {summary.cardioCount === 1 ? 'block' : 'blocks'} ·{' '}
          {formatDurationShort(summary.cardioSeconds)}
          {cardioRunning ? ' (the running timer stops when you save)' : ''}
        </p>
      )}
      {!empty && <RecordsList sessionId={sessionId} active={open} />}
      {summary && !empty && summary.exercisesSkipped > 0 && (
        <p className="hint">Exercises without completed sets are saved as skipped; unfilled sets are dropped.</p>
      )}
      {empty && <p className="secondary">There are no completed sets. You can keep going or discard this workout.</p>}

      {!empty && (
        <div className="field">
          <label htmlFor="notes">Notes (optional)</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}

      {!empty && (
        <button
          type="button"
          className="btn primary big"
          onClick={async () => {
            await onFinish(notes)
            onClose()
          }}
        >
          Save workout
        </button>
      )}
      <button type="button" className="btn block" onClick={onClose}>
        Keep going
      </button>

      {!confirmDiscard ? (
        <button type="button" className="btn ghost block" onClick={() => setConfirmDiscard(true)}>
          Discard workout…
        </button>
      ) : (
        <div className="banner error stack">
          <p>Discard this workout? It will be hidden from your history.</p>
          <button
            type="button"
            className="btn danger solid block"
            onClick={async () => {
              await onDiscard()
              setConfirmDiscard(false)
              onClose()
            }}
          >
            Yes, discard
          </button>
        </div>
      )}
    </Sheet>
  )
}

/**
 * Which exercise of a superset is up: the one with the fewest completed sets (first one on ties),
 * so it alternates A, B, A, B … Skipped members and finished plans are ignored.
 */
function nextInSuperset(
  block: { we: { performedNameSnapshot: string; status: string }; sets: { isCompleted: boolean }[] }[],
): string | undefined {
  const open = block.filter((m) => m.we.status !== 'skipped')
  if (open.length === 0) return undefined
  const done = (m: (typeof open)[number]) => m.sets.filter((s) => s.isCompleted).length
  const target = open.reduce((best, m) => (done(m) < done(best) ? m : best))
  const pending = target.sets.filter((s) => !s.isCompleted).length
  if (pending === 0 && done(target) === 0) return undefined
  return `${target.we.performedNameSnapshot} · set ${done(target) + 1}`
}

/** Thin labelled rule between the parts of a workout: cardio before, strength, cardio after. */
function PartDivider({ label }: { label: string }) {
  return (
    <div className="part-divider" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
  )
}
