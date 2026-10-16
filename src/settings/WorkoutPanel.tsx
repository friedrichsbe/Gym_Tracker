import { useLocations, useSettings } from '../data/hooks'
import { updateSettings } from '../data/settings'
import type { WeightUnit } from '../domain/types'
import { useToast } from '../ui/toastContext'
import { RestTimerPanel } from './RestTimerPanel'

export function WorkoutPanel() {
  const settings = useSettings()
  const { active } = useLocations()
  const { guard } = useToast()

  return (
    <>
      <section className="card stack loose" aria-labelledby="logging-title">
        <h2 id="logging-title">Logging</h2>
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
          <span className="hint">Pre-selected when you start a workout. Manage places under Locations.</span>
        </div>
      </section>

      <RestTimerPanel />

      <section className="card stack" aria-labelledby="stats-title">
        <h2 id="stats-title">Statistics</h2>
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
    </>
  )
}
