import { useSettings } from '../data/hooks'
import { updateSettings } from '../data/settings'
import type { WeightUnit } from '../domain/types'
import { useToast } from '../ui/toastContext'
import { RestTimerPanel } from './RestTimerPanel'

export function WorkoutPanel() {
  const settings = useSettings()
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
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.autoAddNextSet}
              onChange={(e) => void guard(() => updateSettings({ autoAddNextSet: e.target.checked }))}
            />
            <span>Add the next set automatically</span>
          </label>
          <span className="hint">
            When you tick off the last set of an exercise, a new one with the same weight and reps appears below.
            Otherwise use “Add set”.
          </span>
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
