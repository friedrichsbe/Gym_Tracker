import { useState } from 'react'
import { useLocations, useSettings } from '../data/hooks'
import { updateSettings } from '../data/settings'
import type { Location } from '../domain/types'
import {
  archiveLocation,
  createLocation,
  currentCoords,
  unarchiveLocation,
  updateLocation,
  type Coords,
} from '../locations/locationService'
import { IconChevronRight, IconPlus } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'

export function LocationsPanel() {
  const { active, archived } = useLocations()
  const settings = useSettings()
  const { guard } = useToast()
  const withCoords = active.filter((l) => l.lat !== undefined).length
  const [editing, setEditing] = useState<Location | 'new' | null>(null)

  return (
    <section className="card stack" aria-labelledby="locs">
      <div className="card-head">
        <h2 id="locs">Your locations</h2>
        <button type="button" className="btn small" onClick={() => setEditing('new')}>
          <IconPlus />
          Add
        </button>
      </div>
      {active.length === 0 && (
        <p className="hint">No locations yet. Add your gym so every set knows where it was done.</p>
      )}
      <ul className="list">
        {active.map((l) => (
          <li key={l.id}>
            <button type="button" className="list-btn" onClick={() => setEditing(l)}>
              <span className="grow">
                <span className="list-title">{l.name}</span>
                {(l.notes || (settings.autoLocation && l.lat !== undefined)) && (
                  <span className="list-sub">
                    {[settings.autoLocation && l.lat !== undefined ? 'Position saved' : null, l.notes]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </span>
              <span className="chev" aria-hidden="true">
                <IconChevronRight />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="field">
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.autoLocation}
            onChange={(e) => void guard(() => updateSettings({ autoLocation: e.target.checked }))}
          />
          <span>Detect location automatically</span>
        </label>
        <span className="hint">
          Picks the nearest location from your phone’s approximate position when you start a workout. The position is
          only compared on this device and never stored or sent. Save each gym’s position once while you are there (tap
          a location).
          {settings.autoLocation && withCoords === 0 && ' No location has a saved position yet.'}
        </span>
      </div>
      {archived.length > 0 && (
        <details>
          <summary>Archived ({archived.length})</summary>
          <ul className="list">
            {archived.map((l) => (
              <li key={l.id} className="list-row">
                <span className="muted">{l.name}</span>
                <button type="button" className="btn small" onClick={() => void guard(() => unarchiveLocation(l.id))}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Sheet
        open={editing !== null}
        title={editing === 'new' ? 'Add location' : 'Edit location'}
        onClose={() => setEditing(null)}
      >
        {/* Sheet only mounts its children while open, so the form's state starts fresh each time. */}
        <LocationForm
          existing={typeof editing === 'object' ? editing : null}
          showCoords={settings.autoLocation}
          onClose={() => setEditing(null)}
        />
      </Sheet>
    </section>
  )
}

function LocationForm({
  existing,
  showCoords,
  onClose,
}: {
  existing: Location | null
  showCoords: boolean
  onClose: () => void
}) {
  const { guard } = useToast()
  const [name, setName] = useState(existing?.name ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [coords, setCoords] = useState<Coords | null>(
    existing?.lat !== undefined && existing.lng !== undefined ? { lat: existing.lat, lng: existing.lng } : null,
  )
  const [locating, setLocating] = useState(false)

  const usePosition = () =>
    void guard(async () => {
      setLocating(true)
      try {
        // Fresh, precise fix: this becomes the reference point for the gym.
        setCoords(await currentCoords({ maxAgeMs: 0, timeoutMs: 15000 }))
      } finally {
        setLocating(false)
      }
    })

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        void guard(async () => {
          if (existing) await updateLocation(existing.id, { name, notes, coords })
          else if (coords) await updateLocation((await createLocation({ name, notes })).id, { coords })
          else await createLocation({ name, notes })
          onClose()
        })
      }}
    >
      <div className="field">
        <label htmlFor="loc-name">Name</label>
        <input id="loc-name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="loc-notes">Equipment notes (optional)</label>
        <textarea
          id="loc-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. leg press has a different lever ratio"
        />
      </div>
      {showCoords && (
        <div className="field">
          <span className="field-label">Position for auto-detection</span>
          <div className="row">
            <button type="button" className="btn small" disabled={locating} onClick={usePosition}>
              {locating ? 'Locating…' : coords ? 'Update to current position' : 'Use current position'}
            </button>
            {coords && (
              <button type="button" className="btn small ghost" onClick={() => setCoords(null)}>
                Clear
              </button>
            )}
          </div>
          <span className="hint">
            {coords
              ? `Saved: ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}. Detected within 25 km.`
              : 'Not set. Tap while you are at this gym.'}
          </span>
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
                await archiveLocation(existing.id)
                onClose()
              })
            }
          >
            Archive location
          </button>
          <p className="hint">Archiving hides it from pickers. Logged sets keep their location.</p>
        </>
      )}
    </form>
  )
}
