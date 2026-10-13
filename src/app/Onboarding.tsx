import { useState } from 'react'
import { updateSettings } from '../data/settings'
import type { WeightUnit } from '../domain/types'
import { applySplit } from '../daytypes/dayTypeService'
import { DEFAULT_SPLIT_ID, SPLITS } from '../daytypes/splits'
import { seedStarterExercises } from '../exercises/exerciseService'
import { createLocation } from '../locations/locationService'
import { IconDumbbell } from '../ui/icons'
import { useToast } from '../ui/toastContext'

export function Onboarding() {
  const { guard } = useToast()
  const [units, setUnits] = useState<WeightUnit>('kg')
  const [gym, setGym] = useState('')
  const [seed, setSeed] = useState(true)
  const [splitId, setSplitId] = useState(DEFAULT_SPLIT_ID)
  const split = SPLITS.find((s) => s.id === splitId)

  return (
    <main className="content onboarding">
      <div className="onboarding-hero">
        <span className="brand-mark" aria-hidden="true">
          <IconDumbbell />
        </span>
        <h1>Gym Tracker</h1>
        <p className="secondary">
          A fast strength log. Everything stays on this device — no account. You can export your data at any time.
        </p>
      </div>

      <form
        className="card stack loose"
        onSubmit={(e) => {
          e.preventDefault()
          void guard(async () => {
            if (gym.trim()) await createLocation({ name: gym })
            if (seed) await seedStarterExercises()
            await applySplit(splitId)
            await updateSettings({ units, onboardingDone: true })
            void navigator.storage?.persist?.()
          })
        }}
      >
        <div className="field">
          <label htmlFor="ob-units">Weight unit</label>
          <select id="ob-units" value={units} onChange={(e) => setUnits(e.target.value as WeightUnit)}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ob-gym">Your gym (optional)</label>
          <input
            id="ob-gym"
            type="text"
            value={gym}
            onChange={(e) => setGym(e.target.value)}
            placeholder="e.g. Gym A"
            autoComplete="off"
          />
          <span className="hint">Each set records where it was done. You can add more later.</span>
        </div>
        <div className="field">
          <label htmlFor="ob-split">How do you split your training?</label>
          <select id="ob-split" value={splitId} onChange={(e) => setSplitId(e.target.value)}>
            {SPLITS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="hint">{split?.description} Change or customise it any time in Settings.</span>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} />
          <span>Load a starter exercise list (~50, editable)</span>
        </label>
        <button type="submit" className="btn primary big">
          Get started
        </button>
      </form>
    </main>
  )
}
