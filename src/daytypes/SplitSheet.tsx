import { useState } from 'react'
import { useDayTypes } from '../data/hooks'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { applySplit } from './dayTypeService'
import { SPLITS } from './splits'

/** Pick a ready-made training split (Push/Pull/Legs, Upper/Lower, …). Days can still be edited afterwards. */
export function SplitSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="Choose a training split" onClose={onClose}>
      <SplitForm onDone={onClose} />
    </Sheet>
  )
}

function SplitForm({ onDone }: { onDone: () => void }) {
  const { guard, show } = useToast()
  const { active } = useDayTypes()
  const current = SPLITS.find(
    (s) => s.days.length === active.length && s.days.every((d, i) => d.name === active[i]?.name),
  )
  const [choice, setChoice] = useState(current?.id ?? SPLITS[0].id)

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault()
        void guard(async () => {
          await applySplit(choice)
          show('Training days updated')
          onDone()
        })
      }}
    >
      <p className="secondary small">
        This only changes which days you can pick when starting a workout. Your history and presets are kept; days you
        stop using are archived and can be restored any time.
      </p>
      {SPLITS.map((s) => (
        <label key={s.id} className="radio-card">
          <input type="radio" name="split" checked={choice === s.id} onChange={() => setChoice(s.id)} />
          <span className="rc-body">
            <span>
              <strong>{s.name}</strong>
              {s.id === current?.id && (
                <span className="inline-tags">
                  <span className="tag accent">Current</span>
                </span>
              )}
            </span>
            <span className="small secondary">{s.description}</span>
            <span className="small muted">{s.days.map((d) => d.name).join(' · ')}</span>
          </span>
        </label>
      ))}
      <p className="hint">Prefer your own? Close this and add, rename or edit days under “Training days”.</p>
      <button type="submit" className="btn primary" disabled={choice === current?.id}>
        Use this split
      </button>
    </form>
  )
}
