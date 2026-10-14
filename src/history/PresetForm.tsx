import { useState } from 'react'

/** Name and day for a preset made from a finished workout. */
export function PresetForm({
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
