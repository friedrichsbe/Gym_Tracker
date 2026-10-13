import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useDayTypes } from '../data/hooks'
import { createRoutineFromSession } from '../routines/routineService'
import { formatDate, formatDurationShort, formatVolume } from '../ui/format'
import { NumericField } from '../ui/NumericField'
import { SupersetFrame } from '../workout/SupersetFrame'
import { toBlocks } from '../workout/supersets'
import { IconChevronLeft } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import {
  deleteSession,
  getActiveSession,
  loadSessionView,
  startWorkout,
  summarizeSession,
  updateSessionNotes,
  updateSet,
} from '../workout/workoutService'

const TYPE_TAG: Record<string, string> = {
  warmup: 'Warm-up',
  drop: 'Drop',
  failure: 'Failure',
  other: 'Other',
  working: '',
}

export function SessionDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { guard, show } = useToast()
  const { active: days } = useDayTypes()
  const view = useLiveQuery(() => loadSessionView(id), [id])
  const summary = useLiveQuery(() => summarizeSession(id), [id])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const justFinished = (location.state as { justFinished?: boolean } | null)?.justFinished === true

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
  const title = [session.dayTypeNameSnapshot, session.routineNameSnapshot].filter(Boolean).join(' · ') || 'Workout'
  const performed = exercises.filter((e) => e.sets.some((s) => s.isCompleted))

  return (
    <main className="content">
      <Link to="/history" className="link-subtle">
        <IconChevronLeft />
        History
      </Link>

      {justFinished && (
        <div className="card stack callout" role="status">
          <h2>Nice work. Save this as a preset?</h2>
          <p className="secondary small">
            Next time you train this day you can start from exactly this workout — and still change anything.
          </p>
          <button type="button" className="btn primary" onClick={() => setSaving(true)}>
            Save as preset
          </button>
        </div>
      )}

      <div className="stack">
        <div className="page-title">
          <span className="overline">
            {title} · {session.locationNameSnapshot ?? 'No location'}
          </span>
          <h1>{formatDate(session.startedAt)}</h1>
        </div>
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
      </div>

      {toBlocks(performed, (p) => p.we.supersetGroupId).map((block) => {
        const cards = block.map(({ we, sets }) => (
          <section
            key={we.id}
            className={`card stack exercise ${we.isForeign ? 'foreign' : ''}`}
            aria-label={we.performedNameSnapshot}
          >
            <div className="stack tight">
              <h3 className="exercise-name">{we.performedNameSnapshot}</h3>
              <div className="chip-row">
                {we.isForeign && <span className="tag foreign">Outside {session.dayTypeNameSnapshot ?? 'plan'}</span>}
                {we.plannedExerciseId && we.plannedNameSnapshot !== we.performedNameSnapshot && (
                  <span className="tag sub">
                    Replaced {we.plannedNameSnapshot}
                    {we.substitutionReason ? ` · ${we.substitutionReason}` : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="set-grid" aria-hidden="true">
              <span className="set-grid-head">Set</span>
              <span className="set-grid-head">{sets[0]?.weightUnit ?? 'kg'}</span>
              <span className="set-grid-head">Reps</span>
              <span />
            </div>
            <div className="set-grid">
              {sets
                .filter((s) => s.isCompleted)
                .map((s) => (
                  <div key={s.id} className="set-row done">
                    <span
                      className={`set-badge num ${s.setType === 'warmup' ? 'warmup' : ''}`}
                      title={TYPE_TAG[s.setType] || 'Working set'}
                    >
                      {s.setType === 'warmup' ? 'W' : s.setNumber}
                    </span>
                    <NumericField
                      label={`Set ${s.setNumber} weight`}
                      value={s.weightValue}
                      onCommit={(v) => void guard(() => updateSet(s.id, { weightValue: v }))}
                    />
                    <NumericField
                      label={`Set ${s.setNumber} reps`}
                      integer
                      value={s.reps}
                      onCommit={(v) => void guard(() => updateSet(s.id, { reps: v }))}
                    />
                    <span className="set-type-label">{TYPE_TAG[s.setType]}</span>
                  </div>
                ))}
            </div>
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
      {performed.length === 0 && <p className="secondary">No completed sets in this workout.</p>}

      <div className="card stack">
        <div className="field">
          <label htmlFor="s-notes">Notes</label>
          <textarea
            id="s-notes"
            key={session.updatedAt}
            defaultValue={session.notes ?? ''}
            onBlur={(e) =>
              e.target.value !== (session.notes ?? '') &&
              void guard(() => updateSessionNotes(session.id, { notes: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="stack">
        <button type="button" className="btn block" disabled={performed.length === 0} onClick={() => setSaving(true)}>
          Save as preset
        </button>
        <button
          type="button"
          className="btn block"
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
          Repeat this workout
        </button>
        <button type="button" className="btn ghost danger-text block" onClick={() => setDeleting(true)}>
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
