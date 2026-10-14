import { fitsDay, KNOWN_MUSCLES } from '../daytypes/dayTypeService'
import { useDayTypes } from '../data/hooks'
import type { DayType } from '../domain/types'

interface Props {
  muscles: string[]
  onMuscles: (muscles: string[]) => void
  /** Days the exercise is explicitly assigned to. */
  dayIds: string[]
  onDayIds: (ids: string[]) => void
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

/**
 * "Where does this exercise belong?" — used whenever an exercise is created or edited.
 *  - Muscle groups work in EVERY split (Push/Pull/Legs, Upper/Lower, …), so they keep the assignment complete
 *    even when the user switches split later.
 *  - Training days assign it explicitly (e.g. "Upper" and "Push"); days from other splits are listed too.
 */
export function ExerciseClassification({ muscles, onMuscles, dayIds, onDayIds }: Props) {
  const { active, archived } = useDayTypes()
  const muscleOptions = [...new Set([...KNOWN_MUSCLES, ...muscles])].sort()
  const probe = { id: '', muscleTags: muscles } as Parameters<typeof fitsDay>[0]

  const dayChip = (d: DayType) => {
    const viaMuscles = !d.matchAll && fitsDay(probe, d) && !dayIds.includes(d.id)
    const locked = d.matchAll || viaMuscles
    const pressed = locked || dayIds.includes(d.id)
    return (
      <button
        key={d.id}
        type="button"
        className="chip"
        aria-pressed={pressed}
        disabled={locked}
        title={
          d.matchAll
            ? 'Every exercise fits this day'
            : viaMuscles
              ? 'Fits through its muscle groups — change the muscle groups to remove it'
              : undefined
        }
        onClick={() => onDayIds(toggle(dayIds, d.id))}
      >
        {d.name}
        {d.matchAll ? ' · always' : viaMuscles ? ' · via muscles' : ''}
      </button>
    )
  }

  return (
    <div className="stack">
      <div className="field">
        <span className="field-label">Muscle groups</span>
        <div className="chip-row" role="group" aria-label="Muscle groups">
          {muscleOptions.map((m) => (
            <button
              key={m}
              type="button"
              className="chip"
              aria-pressed={muscles.includes(m)}
              onClick={() => onMuscles(toggle(muscles, m))}
            >
              {m}
            </button>
          ))}
        </div>
        <span className="hint">They work in every training split.</span>
      </div>
      <div className="field">
        <span className="field-label">Training days</span>
        {active.length === 0 ? (
          <span className="hint">No training days yet — add some under Settings.</span>
        ) : (
          <div className="chip-row" role="group" aria-label="Training days">
            {active.map(dayChip)}
          </div>
        )}
        {archived.length > 0 && (
          <details>
            <summary>Days from other splits ({archived.length})</summary>
            <div className="chip-row" role="group" aria-label="Days from other splits">
              {archived.map(dayChip)}
            </div>
          </details>
        )}
        <span className="hint">With neither a muscle group nor a day, it only appears under “Other exercises”.</span>
      </div>
    </div>
  )
}
