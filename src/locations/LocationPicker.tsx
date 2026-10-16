import { useState } from 'react'
import { useLocations, useSettings } from '../data/hooks'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { createLocation, detectLocationId } from './locationService'

export type LocationScope = 'fromNow' | 'session'

interface Props {
  open: boolean
  currentId: string | null
  onClose: () => void
  /** `auto` = chosen via the "Auto" entry from the device position. */
  onSelect: (locationId: string | null, scope: LocationScope, auto: boolean) => void
  /** Offer the "from now on" vs "whole workout" choice (only mid-session). */
  askScope?: boolean
  hasLoggedSets?: boolean
}

export function LocationPicker({ open, currentId, onClose, onSelect, askScope, hasLoggedSets }: Props) {
  const { active } = useLocations()
  const settings = useSettings()
  const { guard, show } = useToast()
  const [detecting, setDetecting] = useState(false)
  const [scope, setScope] = useState<LocationScope>('fromNow')
  const [name, setName] = useState('')
  const showScope = askScope && hasLoggedSets

  const choose = (id: string | null, auto = false) => {
    onSelect(id, showScope ? scope : 'session', auto)
    onClose()
  }

  const chooseAuto = async () => {
    setDetecting(true)
    const id = await detectLocationId()
    setDetecting(false)
    if (id) choose(id, true)
    else show('No saved location nearby, or location access is off. Pick one manually.')
  }

  return (
    <Sheet open={open} title="Location" onClose={onClose}>
      {showScope && (
        <fieldset className="stack fieldset-reset">
          <legend className="field-label">Applies to</legend>
          <label className="radio-card">
            <input type="radio" name="scope" checked={scope === 'fromNow'} onChange={() => setScope('fromNow')} />
            <span className="rc-body">
              <strong>Sets from now on</strong>
              <span className="small muted">I moved to another gym. Logged sets keep their location.</span>
            </span>
          </label>
          <label className="radio-card">
            <input type="radio" name="scope" checked={scope === 'session'} onChange={() => setScope('session')} />
            <span className="rc-body">
              <strong>Entire workout</strong>
              <span className="small muted">I picked the wrong one. Relabel the sets already logged.</span>
            </span>
          </label>
        </fieldset>
      )}

      <ul className="list">
        {settings.autoLocation && (
          <li>
            <button type="button" className="list-btn" disabled={detecting} onClick={() => void chooseAuto()}>
              <span>
                <span className="list-title">{detecting ? 'Detecting…' : 'Auto'}</span>
                <span className="list-sub">Nearest saved location from your position</span>
              </span>
            </button>
          </li>
        )}
        {active.map((l) => (
          <li key={l.id}>
            <button type="button" className="list-btn" aria-pressed={l.id === currentId} onClick={() => choose(l.id)}>
              <span>
                <span className="list-title">{l.name}</span>
                {l.notes && <span className="list-sub">{l.notes}</span>}
              </span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="list-btn" aria-pressed={currentId === null} onClick={() => choose(null)}>
            <span className="list-title muted">Unknown / not set</span>
          </button>
        </li>
      </ul>

      <form
        className="row inline-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          void guard(async () => {
            const loc = await createLocation({ name })
            setName('')
            choose(loc.id)
          })
        }}
      >
        <div className="field grow">
          <label htmlFor="new-location">New location</label>
          <input
            id="new-location"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Gym A"
          />
        </div>
        <button type="submit" className="btn primary self-end" disabled={!name.trim()}>
          Add
        </button>
      </form>
    </Sheet>
  )
}
