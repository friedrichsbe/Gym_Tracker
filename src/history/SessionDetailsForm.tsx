import { useState } from 'react'
import { DateField } from '../ui/DateField'
import { useDayTypes, useLocations, useNow } from '../data/hooks'
import { localParts } from './sessionTime'
import { instant, toIso } from '../domain/time'

export interface SessionDetailsValues {
  startedAt: string
  durationMinutes: number | null
  locationId: string | null
  dayTypeId: string | null
}

/** Date, time, duration, gym and day of a workout: shared by "edit details" and "log a past workout". */
export function SessionDetailsForm(props: {
  initial: SessionDetailsValues
  submitLabel: string
  onSubmit: (values: SessionDetailsValues) => void
}) {
  const { initial, submitLabel, onSubmit } = props
  const { active: locations, archived: archivedLocations } = useLocations()
  const { active: days, archived: archivedDays } = useDayTypes()
  const now = useNow(30_000)
  const start = localParts(initial.startedAt)
  const [date, setDate] = useState(start.date)
  const [time, setTime] = useState(start.time)
  const [minutes, setMinutes] = useState(initial.durationMinutes ? String(initial.durationMinutes) : '')
  const [locationId, setLocationId] = useState(initial.locationId ?? '')
  const [dayTypeId, setDayTypeId] = useState(initial.dayTypeId ?? '')

  const parsed = date && time ? new Date(`${date}T${time}`) : null
  const validStart = !!parsed && !Number.isNaN(parsed.getTime())
  const future = validStart && parsed!.getTime() > now + 5 * 60_000
  const mins = minutes.trim() === '' ? null : Number(minutes)
  const badDuration = mins !== null && (!Number.isInteger(mins) || mins < 1 || mins > 24 * 60)
  const ok = validStart && !future && !badDuration

  const locationOptions = [...locations, ...archivedLocations.filter((l) => l.id === initial.locationId)]
  const dayOptions = [...days, ...archivedDays.filter((d) => d.id === initial.dayTypeId)]

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (!ok) return
        onSubmit({
          startedAt: parsed!.getTime() === instant(initial.startedAt) ? initial.startedAt : toIso(parsed!),
          durationMinutes: mins,
          locationId: locationId || null,
          dayTypeId: dayTypeId || null,
        })
      }}
    >
      <div className="row top">
        <div className="grow">
          <DateField id="sd-date" label="Date" value={date} onChange={setDate} clearable={false} />
        </div>
        <div className="field grow">
          <label htmlFor="sd-time">Start time</label>
          <input id="sd-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      {future && <p className="hint danger-text">A workout can’t start in the future.</p>}
      <div className="field">
        <label htmlFor="sd-min">Duration (minutes, optional)</label>
        <input
          id="sd-min"
          type="text"
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))}
          aria-invalid={badDuration}
        />
        {badDuration && <span className="hint danger-text">Use 1–1440 minutes, or leave empty.</span>}
      </div>
      <div className="field">
        <label htmlFor="sd-loc">Gym</label>
        <select id="sd-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">Not set</option>
          {locationOptions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="sd-day">Day</label>
        <select id="sd-day" value={dayTypeId} onChange={(e) => setDayTypeId(e.target.value)}>
          <option value="">Free workout</option>
          {dayOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn primary" disabled={!ok}>
        {submitLabel}
      </button>
    </form>
  )
}
