import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { UpdateBanner } from '../app/UpdateBanner'
import { DayTypesPanel } from '../daytypes/DayTypesPanel'
import { DataPanel } from '../portability/DataPanel'
import { RestTimerPanel } from './RestTimerPanel'
import { SwipePanel } from './SwipePanel'
import { useLocations, useSettings } from '../data/hooks'
import { updateSettings } from '../data/settings'
import type { AccentColor, DarkStyle, LightStyle, Location, Theme, WeightUnit } from '../domain/types'
import { IconCheck, IconChevronRight, IconPlus } from '../ui/icons'
import { archiveLocation, createLocation, unarchiveLocation, updateLocation } from '../locations/locationService'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'

const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]
const LIGHT_STYLES: { id: LightStyle; label: string; description: string }[] = [
  { id: 'light', label: 'Light', description: 'Calm off-white' },
  { id: 'glow', label: 'Glow', description: 'Soft glass & colour' },
]
const DARK_STYLES: { id: DarkStyle; label: string; description: string }[] = [
  { id: 'dark', label: 'Dark', description: 'Soft anthracite' },
  { id: 'midnight', label: 'Midnight', description: 'True black for OLED' },
]
const ACCENTS: { id: AccentColor; label: string }[] = [
  { id: 'teal', label: 'Teal' },
  { id: 'blue', label: 'Blue' },
  { id: 'orchid', label: 'Orchid' },
  { id: 'forest', label: 'Forest' },
  { id: 'ember', label: 'Ember' },
  { id: 'rose', label: 'Rose' },
  { id: 'graphite', label: 'Graphite' },
]

export function SettingsPage() {
  const settings = useSettings()
  const { active, archived } = useLocations()
  const { guard } = useToast()
  const [editing, setEditing] = useState<Location | 'new' | null>(null)
  const route = useLocation()

  // Deep links: "backup" from the reminder, "days" from the start screen.
  useEffect(() => {
    const target = (route.state as { scrollTo?: string } | null)?.scrollTo
    if (target) document.getElementById(target)?.scrollIntoView()
  }, [route.state])

  return (
    <main className="content">
      <div className="page-head">
        <h1>Settings</h1>
      </div>
      <UpdateBanner />

      <section className="card stack loose" aria-labelledby="prefs">
        <h2 id="prefs">Preferences</h2>
        <div className="field">
          <label htmlFor="units">Weight unit for new sets</label>
          <select
            id="units"
            value={settings.units}
            onChange={(e) => void guard(() => updateSettings({ units: e.target.value as WeightUnit }))}
          >
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
          <span className="hint">Every set stores its own unit, so changing this never rewrites history.</span>
        </div>
        <div className="field">
          <span className="field-label" id="theme-label">
            Appearance
          </span>
          <div className="segmented full" role="group" aria-labelledby="theme-label">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={settings.theme === t.id}
                onClick={() => void guard(() => updateSettings({ theme: t.id }))}
              >
                {t.label}
              </button>
            ))}
          </div>
          {settings.theme === 'system' && (
            <span className="hint">Switches between your light and dark style with your device.</span>
          )}
        </div>
        {settings.theme !== 'dark' && (
          <div className="field">
            <span className="field-label" id="light-style-label">
              Light style
            </span>
            <div className="option-grid" role="group" aria-labelledby="light-style-label">
              {LIGHT_STYLES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="style-option"
                  aria-pressed={settings.lightStyle === d.id}
                  onClick={() => void guard(() => updateSettings({ lightStyle: d.id }))}
                >
                  <span className="style-preview" data-preview={d.id} aria-hidden="true">
                    <i />
                    <i />
                  </span>
                  <span className="rc-body">
                    <strong>{d.label}</strong>
                    <span className="small muted">{d.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        {settings.theme !== 'light' && (
          <div className="field">
            <span className="field-label" id="dark-style-label">
              Dark style
            </span>
            <div className="option-grid" role="group" aria-labelledby="dark-style-label">
              {DARK_STYLES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="style-option"
                  aria-pressed={settings.darkStyle === d.id}
                  onClick={() => void guard(() => updateSettings({ darkStyle: d.id }))}
                >
                  <span className="style-preview" data-preview={d.id} aria-hidden="true">
                    <i />
                    <i />
                  </span>
                  <span className="rc-body">
                    <strong>{d.label}</strong>
                    <span className="small muted">{d.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="field">
          <span className="field-label" id="accent-label">
            Accent colour
          </span>
          <div className="swatches" role="group" aria-labelledby="accent-label">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                className="swatch"
                data-swatch={a.id}
                aria-pressed={settings.accent === a.id}
                aria-label={a.label}
                title={a.label}
                onClick={() => void guard(() => updateSettings({ accent: a.id }))}
              >
                <IconCheck />
              </button>
            ))}
          </div>
          <span className="hint">
            {ACCENTS.find((a) => a.id === settings.accent)?.label} · used for buttons, completed sets and charts.
          </span>
        </div>
        <div className="field">
          <label htmlFor="default-loc">Default location</label>
          <select
            id="default-loc"
            value={settings.defaultLocationId ?? ''}
            onChange={(e) => void guard(() => updateSettings({ defaultLocationId: e.target.value || null }))}
          >
            <option value="">None</option>
            {active.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card stack" aria-labelledby="stats">
        <h2 id="stats">Statistics</h2>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.includeWarmupsInStats}
            onChange={(e) => void guard(() => updateSettings({ includeWarmupsInStats: e.target.checked }))}
          />
          <span>Count warm-up sets in volume, calendar and charts</span>
        </label>
        <p className="hint">
          Warm-ups are always saved and always visible in the workout and history. This only decides whether they count
          in the numbers.
        </p>
      </section>

      <RestTimerPanel />

      <SwipePanel />

      <section className="card stack" aria-labelledby="ex-manage">
        <h2 id="ex-manage">Exercises</h2>
        <p className="card-desc">
          Rename exercises, add other names, set muscle groups and a rest time, merge duplicates, archive what you no
          longer use.
        </p>
        <Link to="/exercises" className="btn block">
          Manage exercises
        </Link>
      </section>

      <DataPanel />

      <DayTypesPanel />

      <section className="card stack" aria-labelledby="locs">
        <div className="card-head">
          <h2 id="locs">Locations</h2>
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
      </section>

      <StorageStatus />

      <p className="hint text-center">Gym Tracker · data is stored only on this device · Schema v2</p>

      <LocationEditor location={editing} onClose={() => setEditing(null)} />
    </main>
  )
}

function LocationEditor({ location, onClose }: { location: Location | 'new' | null; onClose: () => void }) {
  return (
    <Sheet open={location !== null} title={location === 'new' ? 'Add location' : 'Edit location'} onClose={onClose}>
      {/* Sheet only mounts its children while open, so the form's state starts fresh each time. */}
      <LocationForm existing={typeof location === 'object' ? location : null} onClose={onClose} />
    </Sheet>
  )
}

function LocationForm({ existing, onClose }: { existing: Location | null; onClose: () => void }) {
  const { guard } = useToast()
  const [name, setName] = useState(existing?.name ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')

  return (
    <>
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
    </>
  )
}

function StorageStatus() {
  const info = useLiveQuery(async () => {
    const persisted = (await navigator.storage?.persisted?.()) ?? false
    const est = await navigator.storage?.estimate?.()
    return { persisted, usage: est?.usage ?? null }
  }, [])
  const [asked, setAsked] = useState(false)

  return (
    <section className="card stack" aria-labelledby="storage">
      <h2 id="storage">Browser storage</h2>
      <p className="card-desc">
        Your workouts live only in this browser on this device. Clearing site data or losing the phone loses them.{' '}
        {info?.persisted
          ? 'The browser has agreed to keep this data (persistent storage).'
          : 'The browser may evict this data under storage pressure.'}
      </p>
      {info && !info.persisted && navigator.storage?.persist && (
        <button
          type="button"
          className="btn"
          disabled={asked}
          onClick={() => {
            setAsked(true)
            void navigator.storage.persist()
          }}
        >
          Request persistent storage
        </button>
      )}
    </section>
  )
}
