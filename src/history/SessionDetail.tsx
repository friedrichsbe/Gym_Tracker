import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { RecordsList } from '../analytics/RecordsList'
import { CardioSection } from '../cardio/CardioSection'
import { loadCardio } from '../cardio/cardioService'
import { useDayTypes, useRoutines } from '../data/hooks'
import { deliver, exportCsvZip, exportJsonFile } from '../portability/exportData'
import { createRoutineFromSession, saveRoutine, updateRoutineFromSession } from '../routines/routineService'
import { formatDate, formatDurationShort, formatTime, formatVolume } from '../ui/format'
import { SupersetFrame } from '../workout/SupersetFrame'
import { toBlocks } from '../workout/supersets'
import {
  IconCalendar,
  IconCheck,
  IconChevronLeft,
  IconClock,
  IconDumbbell,
  IconHeartPulse,
  IconMore,
  IconNote,
  IconPencil,
  IconPin,
  IconPlus,
  IconRefresh,
  IconRepeat,
  IconShare,
  IconStar,
  IconTrash,
  IconX,
} from '../ui/icons'
import { ExercisePicker } from '../exercises/ExercisePicker'
import type { WorkoutExercise } from '../domain/types'
import { PastSetRow } from './PastSetRow'
import { SessionDetailsForm } from './SessionDetailsForm'
import { minutesBetween } from './sessionTime'
import {
  addPastExercise,
  addPastSet,
  changePerformedExercise,
  removePastExercise,
  updateSessionDetails,
} from './sessionEditService'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import {
  deleteSession,
  getActiveSession,
  loadSessionView,
  startWorkout,
  summarizeSession,
  updateSessionNotes,
} from '../workout/workoutService'

export function SessionDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { guard, show } = useToast()
  const { active: days, archived: archivedDays } = useDayTypes()
  const view = useLiveQuery(() => loadSessionView(id), [id])
  const summary = useLiveQuery(() => summarizeSession(id), [id])
  const cardio = useLiveQuery(() => loadCardio(id), [id]) ?? []
  const { active: routines } = useRoutines()
  const [saving, setSaving] = useState(false)
  const [updatingPreset, setUpdatingPreset] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingDetails, setEditingDetails] = useState(false)
  const [pickingExercise, setPickingExercise] = useState(false)
  const [menuFor, setMenuFor] = useState<WorkoutExercise | null>(null)
  const [changingFor, setChangingFor] = useState<WorkoutExercise | null>(null)
  const [removingFor, setRemovingFor] = useState<WorkoutExercise | null>(null)
  const navState = location.state as { justFinished?: boolean; justCreated?: boolean } | null
  const [calloutDismissed, setCalloutDismissed] = useState(false)
  const justFinished = navState?.justFinished === true && !calloutDismissed
  const justCreated = navState?.justCreated === true && !calloutDismissed
  // Dismiss for good: also drop the flag from the history entry, so going back here doesn't bring it back.
  const dismissCallout = () => {
    setCalloutDismissed(true)
    navigate(location.pathname, { replace: true, state: null })
  }

  if (view === undefined) return null
  if (!view) {
    return (
      <main className="content">
        <p>This workout no longer exists.</p>
        <Link to="/history" className="btn">
          Back to history
        </Link>
      </main>
    )
  }
  const { session, exercises } = view
  const performed = exercises.filter((e) => e.sets.some((s) => s.isCompleted))
  // Everything that can still be edited: entries with sets, plus completed ones whose sets were all deleted.
  const shown = exercises.filter((e) => e.sets.length > 0 || e.we.status !== 'skipped')
  const sessionDay = [...days, ...archivedDays].find((d) => d.id === session.dayTypeId) ?? null
  const preCardio = cardio.filter((c) => c.slot === 'start').length
  const postCardio = cardio.filter((c) => c.slot === 'end').length

  return (
    <main className="content">
      <Link to="/history" className="link-subtle">
        <IconChevronLeft />
        History
      </Link>

      {justCreated && (
        <div className="card stack callout dismissible" role="status">
          <button
            type="button"
            className="btn ghost icon small callout-close"
            aria-label="Dismiss"
            onClick={dismissCallout}
          >
            <IconX />
          </button>
          <h2>Workout created</h2>
          <p className="secondary small">
            Add the exercises and sets you did. Set values stay empty until you type them — nothing is guessed.
          </p>
        </div>
      )}

      {justFinished && (
        <div className="card stack callout dismissible" role="status">
          <button
            type="button"
            className="btn ghost icon small callout-close"
            aria-label="Dismiss"
            onClick={dismissCallout}
          >
            <IconX />
          </button>
          <h2>Nice work. Save this as a preset?</h2>
          <p className="secondary small">
            Next time you train this day you can start from exactly this workout — and still change anything.
          </p>
          <button type="button" className="btn primary self-start" onClick={() => setSaving(true)}>
            Save as preset
          </button>
        </div>
      )}

      {/* 1 · The basics: when, where, which day — with its own edit button. */}
      <section className="card session-hero" aria-label="Workout details">
        <div className="hero-head">
          <div className="page-title">
            <span className="overline">
              {session.routineNameSnapshot ? `Preset · ${session.routineNameSnapshot}` : 'Workout'}
            </span>
            <h1>{formatDate(session.startedAt)}</h1>
          </div>
          <button type="button" className="btn small" onClick={() => setEditingDetails(true)}>
            <IconPencil />
            Edit
          </button>
        </div>
        <ul className="meta-pills plain-list" aria-label="Details">
          <li>
            <IconPin />
            {session.locationNameSnapshot ?? 'No location'}
          </li>
          <li>
            <IconCalendar />
            {session.dayTypeNameSnapshot ? `${session.dayTypeNameSnapshot} day` : 'Free workout'}
          </li>
          <li className="num">
            <IconClock />
            {formatTime(session.startedAt)}
          </li>
        </ul>
        {summary && (
          <div className="summary-grid three">
            <div className="metric">
              <span className="v num">{summary.completedSets}</span>
              <span className="l">sets</span>
            </div>
            <div className="metric">
              <span className="v num">
                {summary.durationSeconds != null ? formatDurationShort(summary.durationSeconds) : '–'}
              </span>
              <span className="l">duration</span>
            </div>
            <div className="metric">
              <span className="v num">
                {Object.keys(summary.volume).length > 0 ? formatVolume(summary.volume) : '–'}
              </span>
              <span className="l">volume</span>
            </div>
          </div>
        )}
      </section>

      <RecordsList sessionId={session.id} />

      {/* 2 · What was done: cardio before, strength, cardio after — each its own zone. */}
      <div className="zones">
        <section className="zone" data-zone="cardio" aria-labelledby="zone-pre">
          <header className="zone-head">
            <span className="zone-badge" aria-hidden="true">
              <IconHeartPulse />
            </span>
            <div className="grow">
              <h2 id="zone-pre">Cardio before</h2>
              <span className="zone-sub">Warm-up</span>
            </div>
            {preCardio > 0 && <span className="zone-count num">{preCardio}</span>}
          </header>
          <div className="zone-body">
            <CardioSection sessionId={session.id} slot="start" entries={cardio} past />
          </div>
        </section>

        <section className="zone" data-zone="strength" aria-labelledby="zone-strength">
          <header className="zone-head">
            <span className="zone-badge" aria-hidden="true">
              <IconDumbbell />
            </span>
            <div className="grow">
              <h2 id="zone-strength">Strength</h2>
              <span className="zone-sub num">
                {shown.length} {shown.length === 1 ? 'exercise' : 'exercises'}
                {summary ? ` · ${summary.completedSets} ${summary.completedSets === 1 ? 'set' : 'sets'}` : ''}
              </span>
            </div>
          </header>
          <div className="zone-body">
            {toBlocks(shown, (p) => p.we.supersetGroupId).map((block) => {
              const cards = block.map(({ we, sets }) => (
                <section
                  key={we.id}
                  className={`card stack exercise ${we.isForeign ? 'foreign' : ''}`}
                  aria-label={we.performedNameSnapshot}
                >
                  <div className="exercise-head">
                    <div className="stack tight grow">
                      <h3 className="exercise-name">{we.performedNameSnapshot}</h3>
                      <div className="chip-row">
                        {we.isForeign && (
                          <span className="tag foreign">Outside {session.dayTypeNameSnapshot ?? 'plan'}</span>
                        )}
                        {we.plannedExerciseId && we.plannedNameSnapshot !== we.performedNameSnapshot && (
                          <span className="tag sub">
                            Replaced {we.plannedNameSnapshot}
                            {we.substitutionReason ? ` · ${we.substitutionReason}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn ghost icon"
                      aria-label={`Options for ${we.performedNameSnapshot}`}
                      onClick={() => setMenuFor(we)}
                    >
                      <IconMore />
                    </button>
                  </div>
                  {sets.length > 0 ? (
                    <>
                      <div className="set-grid" aria-hidden="true">
                        <span className="set-grid-head">Set</span>
                        <span className="set-grid-head">{sets[0]?.weightUnit ?? 'kg'}</span>
                        <span className="set-grid-head">Reps</span>
                        <span />
                      </div>
                      <div className="set-grid">
                        {sets.map((st) => (
                          <PastSetRow key={st.id} set={st} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="hint">No sets left in this exercise.</p>
                  )}
                  <button
                    type="button"
                    className="btn ghost block small"
                    onClick={() => void guard(() => addPastSet(we.id))}
                  >
                    <IconPlus />
                    Add set
                  </button>
                </section>
              ))
              return block.length > 1 ? (
                <SupersetFrame key={block[0].we.id} size={block.length}>
                  {cards}
                </SupersetFrame>
              ) : (
                cards
              )
            })}
            {shown.length === 0 && <p className="hint zone-empty">No exercises yet — add the first one.</p>}
            <button type="button" className="btn block dashed" onClick={() => setPickingExercise(true)}>
              <IconPlus />
              Add exercise
            </button>
          </div>
        </section>

        <section className="zone" data-zone="cardio" aria-labelledby="zone-post">
          <header className="zone-head">
            <span className="zone-badge" aria-hidden="true">
              <IconHeartPulse />
            </span>
            <div className="grow">
              <h2 id="zone-post">Cardio after</h2>
              <span className="zone-sub">Cool-down</span>
            </div>
            {postCardio > 0 && <span className="zone-count num">{postCardio}</span>}
          </header>
          <div className="zone-body">
            <CardioSection sessionId={session.id} slot="end" entries={cardio} past />
          </div>
        </section>
      </div>

      {/* 3 · Wrap-up: notes and what to do with the workout. */}
      <div className="wrap-up">
        <section className="card stack" aria-labelledby="notes-title">
          <div className="card-head">
            <h2 id="notes-title" className="row tight">
              <span className="muted">
                <IconNote />
              </span>
              Notes
            </h2>
          </div>
          <textarea
            id="s-notes"
            aria-labelledby="notes-title"
            key={session.updatedAt}
            defaultValue={session.notes ?? ''}
            placeholder="How did it go? Anything to remember next time…"
            onBlur={(e) =>
              e.target.value !== (session.notes ?? '') &&
              void guard(() => updateSessionNotes(session.id, { notes: e.target.value }))
            }
          />
        </section>

        <button
          type="button"
          className="btn primary big"
          onClick={() => navigate('/history', { state: { highlight: session.id } })}
        >
          <IconCheck />
          Save &amp; finish
        </button>
        <p className="hint text-center">Everything is saved as you type — this takes you back to your history.</p>

        <div className="action-grid" role="group" aria-label="More actions">
          <button
            type="button"
            className="action-tile"
            disabled={performed.length === 0}
            onClick={() => setSaving(true)}
          >
            <span className="action-icon">
              <IconStar />
            </span>
            <span className="action-label">Save as preset</span>
            <span className="action-sub">Reuse this workout</span>
          </button>
          <button
            type="button"
            className="action-tile"
            disabled={performed.length === 0 || routines.length === 0}
            onClick={() => setUpdatingPreset(true)}
          >
            <span className="action-icon">
              <IconRefresh />
            </span>
            <span className="action-label">Update preset</span>
            <span className="action-sub">Overwrite with this</span>
          </button>
          <button
            type="button"
            className="action-tile"
            disabled={performed.length === 0}
            onClick={() =>
              void guard(async () => {
                if (await getActiveSession()) throw new Error('Finish your current workout first')
                await startWorkout({
                  dayTypeId: session.dayTypeId,
                  locationId: session.locationId,
                  ...repeatPlan(performed.map((p) => p.we)),
                })
                navigate('/')
              })
            }
          >
            <span className="action-icon">
              <IconRepeat />
            </span>
            <span className="action-label">Repeat</span>
            <span className="action-sub">Start it again now</span>
          </button>
          <button type="button" className="action-tile" onClick={() => setExporting(true)}>
            <span className="action-icon">
              <IconShare />
            </span>
            <span className="action-label">Export</span>
            <span className="action-sub">JSON or CSV</span>
          </button>
        </div>

        <button type="button" className="btn ghost danger-text small self-center" onClick={() => setDeleting(true)}>
          <IconTrash />
          Delete workout…
        </button>
      </div>

      <SaveAsPresetSheet
        open={saving}
        onClose={() => setSaving(false)}
        defaultName={`${session.dayTypeNameSnapshot ?? 'Workout'} ${formatDate(session.startedAt)}`}
        defaultDay={session.dayTypeId}
        days={days}
        onSave={(name, dayTypeId) =>
          void guard(async () => {
            const r = await createRoutineFromSession(session.id, { name, dayTypeId })
            show(`Preset “${r.name}” saved`, { actionLabel: 'Edit', onAction: () => navigate(`/routines/${r.id}`) })
            setSaving(false)
          })
        }
      />

      <Sheet open={updatingPreset} title="Update a preset" onClose={() => setUpdatingPreset(false)}>
        <p className="secondary small">
          The preset keeps its name and day, but its exercises become what you did here: order, set counts, rep range
          and supersets. You can undo right afterwards.
        </p>
        <ul className="list card flush">
          {[...routines]
            .sort((a, b) => Number(b.id === session.routineId) - Number(a.id === session.routineId))
            .map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="session-item"
                  onClick={() =>
                    void guard(async () => {
                      const previous = await updateRoutineFromSession(session.id, r.id)
                      setUpdatingPreset(false)
                      show(`Preset “${r.name}” updated`, {
                        actionLabel: 'Undo',
                        onAction: () =>
                          void guard(() =>
                            saveRoutine(r.id, {
                              name: r.name,
                              dayTypeId: r.dayTypeId,
                              notes: r.notes,
                              exercises: previous,
                            }),
                          ),
                      })
                    })
                  }
                >
                  <div>
                    <div className="session-title">{r.name}</div>
                    {r.id === session.routineId && <div className="small muted">Started from this preset</div>}
                  </div>
                </button>
              </li>
            ))}
        </ul>
      </Sheet>

      <Sheet open={exporting} title="Export this workout" onClose={() => setExporting(false)}>
        <p className="secondary small">
          Only this workout, with the exercises and gym it refers to. This is not a backup — it does not reset the
          backup reminder. The JSON file can be imported again (merge).
        </p>
        <button
          type="button"
          className="btn primary block"
          onClick={() =>
            void guard(async () => {
              await deliver(await exportJsonFile('gym-tracker-workout', { sessionId: session.id }), {
                share: true,
                isBackup: false,
              })
              setExporting(false)
            })
          }
        >
          JSON file
        </button>
        <button
          type="button"
          className="btn block"
          onClick={() =>
            void guard(async () => {
              await deliver(await exportCsvZip({ sessionId: session.id }), { share: true, isBackup: false })
              setExporting(false)
            })
          }
        >
          CSV (ZIP)
        </button>
      </Sheet>

      <Sheet open={editingDetails} title="Edit workout details" onClose={() => setEditingDetails(false)}>
        <p className="secondary small">
          Changing the date moves the whole workout. A new gym or day applies to every set and exercise of it.
        </p>
        <SessionDetailsForm
          initial={{
            startedAt: session.startedAt,
            durationMinutes: minutesBetween(session.startedAt, session.endedAt),
            locationId: session.locationId,
            dayTypeId: session.dayTypeId,
          }}
          submitLabel="Save changes"
          onSubmit={(v) =>
            void guard(async () => {
              const initialMinutes = minutesBetween(session.startedAt, session.endedAt)
              await updateSessionDetails(session.id, {
                ...(v.startedAt !== session.startedAt ? { startedAt: v.startedAt } : {}),
                ...(v.durationMinutes !== initialMinutes ? { durationMinutes: v.durationMinutes } : {}),
                ...(v.locationId !== session.locationId ? { locationId: v.locationId } : {}),
                ...(v.dayTypeId !== session.dayTypeId ? { dayTypeId: v.dayTypeId } : {}),
              })
              setEditingDetails(false)
            })
          }
        />
      </Sheet>

      <ExercisePicker
        open={pickingExercise}
        mode="add"
        day={sessionDay}
        onClose={() => setPickingExercise(false)}
        onPick={(exercise) => void guard(() => addPastExercise(session.id, exercise.id))}
      />
      <ExercisePicker
        open={changingFor !== null}
        mode="add"
        title="Change exercise"
        day={sessionDay}
        onClose={() => setChangingFor(null)}
        onPick={(exercise) => {
          const target = changingFor
          if (target) void guard(() => changePerformedExercise(target.id, exercise.id))
        }}
      />

      <Sheet open={menuFor !== null} title={menuFor?.performedNameSnapshot ?? ''} onClose={() => setMenuFor(null)}>
        <button
          type="button"
          className="btn block"
          onClick={() => {
            setChangingFor(menuFor)
            setMenuFor(null)
          }}
        >
          Change exercise (I picked the wrong one)
        </button>
        <button
          type="button"
          className="btn ghost danger-text block"
          onClick={() => {
            setRemovingFor(menuFor)
            setMenuFor(null)
          }}
        >
          Remove from this workout…
        </button>
      </Sheet>

      <Sheet open={removingFor !== null} title="Remove exercise?" onClose={() => setRemovingFor(null)}>
        <p>
          Remove <strong>{removingFor?.performedNameSnapshot}</strong> and all its sets from this workout? This can’t be
          undone.
        </p>
        <button
          type="button"
          className="btn danger solid block"
          onClick={() => {
            const target = removingFor
            setRemovingFor(null)
            if (target) void guard(() => removePastExercise(target.id))
          }}
        >
          Remove exercise
        </button>
        <button type="button" className="btn block" onClick={() => setRemovingFor(null)}>
          Cancel
        </button>
      </Sheet>

      <Sheet open={deleting} title="Delete this workout?" onClose={() => setDeleting(false)}>
        <p>
          This permanently removes the workout of {formatDate(session.startedAt)} with all its sets. It cannot be undone
          — export a backup first if you are unsure.
        </p>
        <button
          type="button"
          className="btn danger solid block"
          onClick={() =>
            void guard(async () => {
              await deleteSession(session.id)
              show('Workout deleted')
              navigate('/history')
            })
          }
        >
          Delete permanently
        </button>
        <button type="button" className="btn block" onClick={() => setDeleting(false)}>
          Cancel
        </button>
      </Sheet>
    </main>
  )
}

function SaveAsPresetSheet(props: {
  open: boolean
  onClose: () => void
  defaultName: string
  defaultDay: string | null
  days: { id: string; name: string }[]
  onSave: (name: string, dayTypeId: string | null) => void
}) {
  return (
    <Sheet open={props.open} title="Save as preset" onClose={props.onClose}>
      <PresetForm {...props} />
    </Sheet>
  )
}

function PresetForm({
  defaultName,
  defaultDay,
  days,
  onSave,
}: {
  defaultName: string
  defaultDay: string | null
  days: { id: string; name: string }[]
  onSave: (name: string, dayTypeId: string | null) => void
}) {
  const [name, setName] = useState(defaultName)
  const [day, setDay] = useState<string | null>(defaultDay)
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) onSave(name.trim(), day)
      }}
    >
      <p className="secondary small">
        Uses the exercises you actually did, with your set counts and rep range (warm-ups are not counted as sets).
      </p>
      <div className="field">
        <label htmlFor="p-name">Name</label>
        <input id="p-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="p-day">Day</label>
        <select id="p-day" value={day ?? ''} onChange={(e) => setDay(e.target.value || null)}>
          <option value="">Any day</option>
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn primary" disabled={!name.trim()}>
        Save preset
      </button>
    </form>
  )
}

/** Exercise ids in order (each once) plus their superset keys, so a repeated workout keeps its supersets. */
function repeatPlan(wes: { performedExerciseId: string; supersetGroupId?: string | null }[]) {
  const seen = new Set<string>()
  const exerciseIds: string[] = []
  const supersetKeys: (string | null)[] = []
  for (const we of wes) {
    if (seen.has(we.performedExerciseId)) continue
    seen.add(we.performedExerciseId)
    exerciseIds.push(we.performedExerciseId)
    supersetKeys.push(we.supersetGroupId ?? null)
  }
  return { exerciseIds, supersetKeys }
}
