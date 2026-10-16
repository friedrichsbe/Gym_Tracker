import { useState } from 'react'
import { useLocations } from '../data/hooks'
import type { Location } from '../domain/types'
import { archiveLocation, createLocation, unarchiveLocation, updateLocation } from '../locations/locationService'
import { IconChevronRight, IconPlus } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'

export function LocationsPanel() {
  const { active, archived } = useLocations()
  const { guard } = useToast()
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
                {l.notes && <span className="list-sub">{l.notes}</span>}
              </span>
              <span className="chev" aria-hidden="true">
                <IconChevronRight />
              </span>
            </button>
          </li>
        ))}
      </ul>
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
        <LocationForm existing={typeof editing === 'object' ? editing : null} onClose={() => setEditing(null)} />
      </Sheet>
    </section>
  )
}

function LocationForm({ existing, onClose }: { existing: Location | null; onClose: () => void }) {
  const { guard } = useToast()
  const [name, setName] = useState(existing?.name ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        void guard(async () => {
          if (existing) await updateLocation(existing.id, { name, notes })
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
