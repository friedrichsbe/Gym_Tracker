import { useSettings } from '../data/hooks'
import { updateSettings } from '../data/settings'
import type { AppSettings, HistorySwipeAction, PresetSwipeAction } from '../domain/types'
import { SESSION_ACTIONS, type SessionAction } from '../history/sessionActions'
import { useToast } from '../ui/toastContext'

const HISTORY_OPTIONS: { id: HistorySwipeAction; label: string }[] = [
  { id: 'none', label: 'Nothing' },
  ...(Object.keys(SESSION_ACTIONS) as SessionAction[]).map((id) => ({ id, label: SESSION_ACTIONS[id].label })),
]
const PRESET_OPTIONS: { id: PresetSwipeAction; label: string }[] = [
  { id: 'none', label: 'Nothing' },
  { id: 'start', label: 'Start workout' },
  { id: 'edit', label: 'Edit' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'archive', label: 'Archive' },
]

type SwipeKey = 'swipeHistoryLeft' | 'swipeHistoryRight' | 'swipePresetLeft' | 'swipePresetRight'

/** Which action a sideways swipe runs on the history and preset lists (touch screens only). */
export function SwipePanel() {
  const settings = useSettings()
  const { guard } = useToast()

  const select = (key: SwipeKey, label: string, options: { id: string; label: string }[]) => (
    <div className="field">
      <label htmlFor={key}>{label}</label>
      <select
        id={key}
        value={settings[key]}
        onChange={(e) => void guard(() => updateSettings({ [key]: e.target.value } as Partial<AppSettings>))}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <>
      <section className="card stack" aria-labelledby="swipe-history">
        <h2 id="swipe-history">Workouts in history</h2>
        <div className="filter-bar">
          {select('swipeHistoryLeft', '← Swipe left', HISTORY_OPTIONS)}
          {select('swipeHistoryRight', 'Swipe right →', HISTORY_OPTIONS)}
        </div>
      </section>
      <section className="card stack" aria-labelledby="swipe-presets">
        <h2 id="swipe-presets">Presets</h2>
        <div className="filter-bar">
          {select('swipePresetLeft', '← Swipe left', PRESET_OPTIONS)}
          {select('swipePresetRight', 'Swipe right →', PRESET_OPTIONS)}
        </div>
      </section>
      <p className="hint">Delete still asks before anything is removed.</p>
    </>
  )
}
