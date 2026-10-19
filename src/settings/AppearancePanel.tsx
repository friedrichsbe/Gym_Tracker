import { useSettings } from '../data/hooks'
import { updateSettings } from '../data/settings'
import type { DarkStyle, LightStyle } from '../domain/types'
import { IconCheck } from '../ui/icons'
import { useToast } from '../ui/toastContext'
import { ACCENTS, THEMES } from './appearanceOptions'

const LIGHT_STYLES: { id: LightStyle; label: string; description: string }[] = [
  { id: 'light', label: 'Light', description: 'Calm off-white' },
  { id: 'glow', label: 'Glow', description: 'Soft glass & colour' },
]
const DARK_STYLES: { id: DarkStyle; label: string; description: string }[] = [
  { id: 'dark', label: 'Dark', description: 'Soft anthracite' },
  { id: 'midnight', label: 'Midnight', description: 'True black for OLED' },
]

export function AppearancePanel() {
  const settings = useSettings()
  const { guard } = useToast()

  return (
    <>
      <section className="card stack loose" aria-labelledby="theme-title">
        <h2 id="theme-title">Theme</h2>
        <div className="field">
          <span className="field-label" id="theme-label">
            Mode
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
                <StyleOption
                  key={d.id}
                  id={d.id}
                  label={d.label}
                  description={d.description}
                  pressed={settings.lightStyle === d.id}
                  onSelect={() => void guard(() => updateSettings({ lightStyle: d.id }))}
                />
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
                <StyleOption
                  key={d.id}
                  id={d.id}
                  label={d.label}
                  description={d.description}
                  pressed={settings.darkStyle === d.id}
                  onSelect={() => void guard(() => updateSettings({ darkStyle: d.id }))}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="accent-title">
        <h2 id="accent-title">Accent colour</h2>
        <div className="swatches" role="group" aria-labelledby="accent-title">
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
      </section>

      <section className="card stack" aria-labelledby="nav-title">
        <h2 id="nav-title">Navigation</h2>
        <div className="field">
          <label className="check-row">
            <input
              type="checkbox"
              checked={settings.navLabels}
              onChange={(e) => void guard(() => updateSettings({ navLabels: e.target.checked }))}
            />
            <span>Show labels in the bottom bar</span>
          </label>
          <span className="hint">Turn off to show only the icons for a cleaner look.</span>
        </div>
      </section>
    </>
  )
}

function StyleOption(props: {
  id: string
  label: string
  description: string
  pressed: boolean
  onSelect: () => void
}) {
  return (
    <button type="button" className="style-option" aria-pressed={props.pressed} onClick={props.onSelect}>
      <span className="style-preview" data-preview={props.id} aria-hidden="true">
        <i />
        <i />
      </span>
      <span className="rc-body">
        <strong>{props.label}</strong>
        <span className="small muted">{props.description}</span>
      </span>
    </button>
  )
}
