import { useState } from 'react'
import { useDayTypes, useExercises } from '../data/hooks'
import type { DayType } from '../domain/types'
import { IconArrowDown, IconArrowUp, IconChevronRight, IconPlus } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { SplitSheet } from './SplitSheet'
import { useToast } from '../ui/toastContext'
import {
  archiveDayType,
  createDayType,
  KNOWN_MUSCLES,
  moveDayType,
  removeExerciseFromDayType,
  unarchiveDayType,
  updateDayType,
} from './dayTypeService'

export function DayTypesPanel() {
  const { active, archived } = useDayTypes()
  const { guard } = useToast()
  const [editing, setEditing] = useState<DayType | 'new' | null>(null)
  const [splitOpen, setSplitOpen] = useState(false)

  return (
    <section className="card stack" aria-labelledby="days-title" id="days">
      <div className="card-head">
        <h2 id="days-title">Training days</h2>
        <button type="button" className="btn small" onClick={() => setEditing('new')}>
          <IconPlus />
          Add
        </button>
      </div>
      <p className="card-desc">
        The day you pick when starting a workout decides which exercises and presets are suggested. Name them however
        you split your training (Leg / Upper / Mix, Push / Pull / Legs, …).
      </p>
      <button type="button" className="btn block" onClick={() => setSplitOpen(true)}>
        Choose a training split…
      </button>
      <ul className="list">
        {active.map((d, i) => (
          <li key={d.id} className="row tight">
            <button type="button" className="list-btn grow" onClick={() => setEditing(d)}>
              <span className="grow">
                <span className="list-title">{d.name}</span>
                <span className="list-sub">
                  {d.matchAll ? 'All exercises' : d.muscleTags.length ? d.muscleTags.join(', ') : 'No muscles selected'}
                </span>
              </span>
              <span className="chev" aria-hidden="true">
                <IconChevronRight />
              </span>
            </button>
            <button
              type="button"
              className="btn ghost icon small"
              aria-label={`Move ${d.name} up`}
              disabled={i === 0}
              onClick={() => void guard(() => moveDayType(d.id, -1))}
            >
              <IconArrowUp />
            </button>
            <button
              type="button"
              className="btn ghost icon small"
              aria-label={`Move ${d.name} down`}
              disabled={i === active.length - 1}
              onClick={() => void guard(() => moveDayType(d.id, 1))}
            >
              <IconArrowDown />
            </button>
          </li>
        ))}
      </ul>
      {active.length === 0 && <p className="hint">No days yet — workouts will be “Free”.</p>}
      {archived.length > 0 && (
        <details>
          <summary>Archived ({archived.length})</summary>
          <ul className="list">
            {archived.map((d) => (
              <li key={d.id} className="list-row">
                <span className="muted">{d.name}</span>
                <button type="button" className="btn small" onClick={() => void guard(() => unarchiveDayType(d.id))}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <SplitSheet open={splitOpen} onClose={() => setSplitOpen(false)} />

      <Sheet
        open={editing !== null}
        title={editing === 'new' ? 'New day' : 'Edit day'}
        onClose={() => setEditing(null)}
      >
        <DayForm existing={typeof editing === 'object' ? editing : null} onDone={() => setEditing(null)} />
      </Sheet>
    </section>
  )
}

function DayForm({ existing, onDone }: { existing: DayType | null; onDone: () => void }) {
  const { guard } = useToast()
  const exercises = useExercises()
  const [name, setName] = useState(existing?.name ?? '')
  const [matchAll, setMatchAll] = useState(existing?.matchAll ?? false)
  const [muscles, setMuscles] = useState<string[]>(existing?.muscleTags ?? [])
  // Re-read so removals made below show up immediately.
  const live = useDayTypes().active.find((d) => d.id === existing?.id)
  const explicit = (live ?? existing)?.exerciseIds ?? []
  const nameOf = new Map(exercises.map((e) => [e.id, e.name]))
  const options = [...new Set([...KNOWN_MUSCLES, ...muscles])].sort()

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        void guard(async () => {
          if (existing) await updateDayType(existing.id, { name, matchAll, muscleTags: muscles })
          else await createDayType({ name, matchAll, muscleTags: muscles })
          onDone()
        })
      }}
    >
      <div className="field">
        <label htmlFor="d-name">Name</label>
        <input
          id="d-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
          placeholder="e.g. Push"
        />
      </div>
      <label className="check-row">
        <input type="checkbox" checked={matchAll} onChange={(e) => setMatchAll(e.target.checked)} />
        <span>Suggest all exercises (for mixed days)</span>
      </label>
      {!matchAll && (
        <div className="stack tight">
          <span className="field-label">Muscle groups that belong to this day</span>
          <div className="chip-row" role="group" aria-label="Muscle groups">
            {options.map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                aria-pressed={muscles.includes(m)}
                onClick={() => setMuscles((xs) => (xs.includes(m) ? xs.filter((x) => x !== m) : [...xs, m]))}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
      {existing && !matchAll && explicit.length > 0 && (
        <div className="stack tight">
          <span className="field-label">Individually assigned exercises</span>
          <ul className="list">
            {explicit.map((id) => (
              <li key={id} className="list-row">
                <span>{nameOf.get(id) ?? 'Unknown exercise'}</span>
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => void guard(() => removeExerciseFromDayType(existing.id, id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="submit" className="btn primary" disabled={!name.trim()}>
        Save
      </button>
      {existing && (
        <>
          <button
            type="button"
            className="btn ghost danger-text"
            onClick={() =>
              void guard(async () => {
                await archiveDayType(existing.id)
                onDone()
              })
            }
          >
            Archive day
          </button>
          <p className="hint">Archiving hides it from the start screen. Past workouts keep their day name.</p>
        </>
      )}
    </form>
  )
}
