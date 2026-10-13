import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UpdateBanner } from '../app/UpdateBanner'
import { db } from '../data/db'
import { useDayTypes, useLocations, useNow, useRoutines, useSettings } from '../data/hooks'
import { instant } from '../domain/time'
import type { Routine } from '../domain/types'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { LocationPicker } from '../locations/LocationPicker'
import { suggestedLocationId } from '../locations/locationService'
import { lastUsedByRoutine } from '../routines/routineService'
import { BackupReminder } from '../settings/BackupReminder'
import { formatDate, formatDurationShort, formatVolume } from '../ui/format'
import { IconChevronRight, IconInbox, IconPin, IconSliders } from '../ui/icons'
import { useToast } from '../ui/toastContext'
import { startWorkout, summarizeSession } from './workoutService'

export function WorkoutHome() {
  const { guard } = useToast()
  const settings = useSettings()
  const { active: locations } = useLocations()
  const { active: days } = useDayTypes()
  const { active: routines } = useRoutines()
  const [locationId, setLocationId] = useState<string | null>(null)
  const [pickedDay, setPickedDay] = useState<string | null | undefined>(undefined) // undefined = not chosen yet
  const [pickingLocation, setPickingLocation] = useState(false)
  const [pickingExercises, setPickingExercises] = useState(false)
  const now = useNow(60_000)

  useEffect(() => {
    void suggestedLocationId().then(setLocationId)
  }, [])

  // Day: explicit choice, else the last one used (if it still exists), else free.
  const dayId =
    pickedDay !== undefined
      ? pickedDay
      : days.some((d) => d.id === settings.lastDayTypeId)
        ? settings.lastDayTypeId
        : null
  const day = days.find((d) => d.id === dayId) ?? null
  const location = locations.find((l) => l.id === locationId)

  const meta = useLiveQuery(async () => {
    const counts = new Map<string, number>()
    for (const re of await db.routineExercises.toArray()) counts.set(re.routineId, (counts.get(re.routineId) ?? 0) + 1)
    return { counts, lastUsed: await lastUsedByRoutine() }
  }, [])

  const { forDay, forOtherDays } = useMemo(() => {
    if (!day) return { forDay: routines, forOtherDays: [] as Routine[] }
    return {
      forDay: routines.filter((r) => r.dayTypeId === day.id || r.dayTypeId === null),
      forOtherDays: routines.filter((r) => r.dayTypeId !== null && r.dayTypeId !== day.id),
    }
  }, [routines, day])

  const recent = useLiveQuery(
    async () =>
      (await db.sessions.where('status').equals('completed').toArray())
        .sort((a, b) => instant(b.startedAt) - instant(a.startedAt))
        .slice(0, 5),
    [],
  )

  const start = (extra: { routineId?: string; exerciseIds?: string[] }) =>
    void guard(() => startWorkout({ locationId, dayTypeId: day?.id ?? null, ...extra }))

  const presetRow = (r: Routine) => {
    const count = meta?.counts.get(r.id) ?? 0
    const last = meta?.lastUsed.get(r.id)
    return (
      <li key={r.id} className="preset">
        <div className="grow">
          <div className="preset-name">{r.name}</div>
          <div className="small muted">
            {count} {count === 1 ? 'exercise' : 'exercises'}
            {last ? ` · last ${formatDate(last)}` : ''}
          </div>
        </div>
        <button type="button" className="btn primary" disabled={count === 0} onClick={() => start({ routineId: r.id })}>
          Start
        </button>
      </li>
    )
  }

  return (
    <>
      <div className="page-head">
        <div className="page-title">
          <span className="overline">
            {new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(now)}
          </span>
          <h1>Workout</h1>
        </div>
      </div>
      <UpdateBanner />
      <BackupReminder />

      <div className="card stack loose">
        <div className="field">
          <span className="field-label">Location</span>
          <button
            type="button"
            className={`chip lg ${location ? '' : 'warn'}`}
            onClick={() => setPickingLocation(true)}
            aria-label={`Location: ${location?.name ?? 'not set'}. Change`}
          >
            <IconPin />
            <span>{location?.name ?? 'Not set — tap to choose'}</span>
          </button>
        </div>

        <div className="field">
          <span className="field-label" id="day-label">
            Training day
          </span>
          <div className="chip-row" role="group" aria-labelledby="day-label">
            {days.map((d) => (
              <button
                key={d.id}
                type="button"
                className="chip day"
                aria-pressed={dayId === d.id}
                onClick={() => setPickedDay(d.id)}
              >
                {d.name}
              </button>
            ))}
            <button type="button" className="chip day" aria-pressed={dayId === null} onClick={() => setPickedDay(null)}>
              Free
            </button>
            <Link
              to="/settings"
              state={{ scrollTo: 'days' }}
              className="chip day ghost"
              aria-label="Edit your training days and split"
            >
              <IconSliders />
              Edit
            </Link>
          </div>
        </div>
      </div>

      <section className="card stack" aria-labelledby="start-label">
        <div className="stack tight">
          <span className="overline">Start</span>
          <h2 id="start-label">{day ? `${day.name} day` : 'Free workout'}</h2>
        </div>

        {forDay.length > 0 ? (
          <>
            <p className="field-label">Your presets{day ? ` for ${day.name}` : ''}</p>
            <ul className="stack plain-list preset-list">{forDay.map(presetRow)}</ul>
          </>
        ) : (
          <p className="secondary">
            No presets{day ? ` for ${day.name}` : ''} yet. Pick exercises below — after the workout you can save it as a
            preset.
          </p>
        )}

        {forOtherDays.length > 0 && (
          <details>
            <summary>Presets from other days ({forOtherDays.length})</summary>
            <ul className="stack plain-list preset-list">{forOtherDays.map(presetRow)}</ul>
          </details>
        )}

        <button type="button" className="btn block dashed" onClick={() => setPickingExercises(true)}>
          Pick exercises{day && !day.matchAll ? ` for ${day.name}` : ''}…
        </button>
        <button type="button" className="btn primary big" onClick={() => start({})}>
          Start empty workout
        </button>
        <p className="hint">
          You can always add, reorder, replace or skip exercises while training — including ones outside the day (they
          get a coloured marker).
        </p>
      </section>

      <LocationPicker
        open={pickingLocation}
        currentId={locationId}
        onClose={() => setPickingLocation(false)}
        onSelect={(id) => setLocationId(id)}
      />

      <ExercisePicker
        open={pickingExercises}
        mode="multi"
        day={day}
        confirmLabel={(n) => `Start with ${n} exercise${n === 1 ? '' : 's'}`}
        onClose={() => setPickingExercises(false)}
        onConfirm={(ids) => start({ exerciseIds: ids })}
      />

      <section className="stack" aria-label="Recent sessions">
        <div className="section-head">
          <h2>Recent</h2>
          {recent && recent.length > 0 && (
            <Link to="/history" className="link-subtle">
              All workouts <IconChevronRight />
            </Link>
          )}
        </div>
        {recent === undefined && <div className="skeleton block" />}
        {recent && recent.length === 0 && (
          <div className="card empty">
            <span className="empty-icon">
              <IconInbox />
            </span>
            <p className="empty-title">No workouts yet</p>
            <p>Your history shows up here after your first completed workout.</p>
          </div>
        )}
        {recent && recent.length > 0 && (
          <ul className="list card flush">
            {recent.map((s) => (
              <RecentItem
                key={s.id}
                sessionId={s.id}
                date={formatDate(s.startedAt)}
                place={s.locationNameSnapshot}
                day={s.dayTypeNameSnapshot}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

function RecentItem(props: { sessionId: string; date: string; place: string | null; day: string | null }) {
  const summary = useLiveQuery(() => summarizeSession(props.sessionId), [props.sessionId])
  return (
    <li>
      <Link to={`/history/${props.sessionId}`} className="session-item">
        <div>
          <div className="session-title">{props.date}</div>
          <div className="small muted">{[props.day, props.place ?? 'No location'].filter(Boolean).join(' · ')}</div>
        </div>
        {summary && (
          <div className="meta num">
            {summary.completedSets} {summary.completedSets === 1 ? 'set' : 'sets'}
            <br />
            {summary.durationSeconds != null ? formatDurationShort(summary.durationSeconds) : ''}
            {Object.keys(summary.volume).length > 0 && <> · {formatVolume(summary.volume)}</>}
          </div>
        )}
      </Link>
    </li>
  )
}
