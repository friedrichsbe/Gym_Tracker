import { useSettings } from '../data/hooks'
import { updateSettings } from '../data/settings'
import { formatClock } from '../workout/restTimer'
import { useToast } from '../ui/toastContext'

const PRESETS = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300]

export function RestTimerPanel() {
  const settings = useSettings()
  const { guard } = useToast()
  const options = PRESETS.includes(settings.restDefaultSeconds)
    ? PRESETS
    : [...PRESETS, settings.restDefaultSeconds].sort((a, b) => a - b)

  return (
    <section className="card stack" aria-labelledby="rest">
      <h2 id="rest">Rest timer</h2>
      <label className="check-row">
        <input
          type="checkbox"
          checked={settings.restAutoStart}
          onChange={(e) => void guard(() => updateSettings({ restAutoStart: e.target.checked }))}
        />
        <span>Start automatically after each working set</span>
      </label>
      <div className="field">
        <label htmlFor="rest-default">Default rest</label>
        <select
          id="rest-default"
          value={settings.restDefaultSeconds}
          onChange={(e) => void guard(() => updateSettings({ restDefaultSeconds: Number(e.target.value) }))}
        >
          {options.map((s) => (
            <option key={s} value={s}>
              {formatClock(s)} min
            </option>
          ))}
        </select>
        <span className="hint">
          You can set a different rest per exercise under Settings → Exercises. In a superset the timer starts after the
          last exercise of each round, using the longest rest of the group. Warm-up sets don’t start it.
        </span>
      </div>
      <label className="check-row">
        <input
          type="checkbox"
          checked={settings.restVibrate}
          onChange={(e) => void guard(() => updateSettings({ restVibrate: e.target.checked }))}
        />
        <span>Vibrate when the rest is over</span>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={settings.restSound}
          onChange={(e) => void guard(() => updateSettings({ restSound: e.target.checked }))}
        />
        <span>Play a sound when the rest is over</span>
      </label>
      <p className="hint">
        Vibration and sound only work while the app is open on screen — web apps cannot ring in the background. When you
        come back, the timer shows the correct time left.
      </p>
    </section>
  )
}
