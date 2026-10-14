import { useState } from 'react'
import type { CardioEntry } from '../domain/types'
import { NumericField } from '../ui/NumericField'
import { Sheet } from '../ui/Sheet'
import { formatDuration } from '../ui/format'
import { useToast } from '../ui/toastContext'
import { useNameLang } from '../ui/lang'
import { CARDIO_KINDS, cardioName } from './cardioKinds'
import { deleteCardio, updateCardio } from './cardioService'

interface Props {
  entry: CardioEntry
  open: boolean
  onClose: () => void
}

/**
 * Details of one cardio block: the duration (measured, but correctable) and the machine's one or two values.
 * Like set entry, every valid keystroke is stored, so closing the sheet never loses input.
 */
export function CardioSheet({ entry, open, onClose }: Props) {
  const { guard } = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const lang = useNameLang()
  const cfg = CARDIO_KINDS[entry.kind]
  const seconds = entry.durationSeconds

  return (
    <Sheet
      open={open}
      title={cardioName(entry.kind, lang)}
      onClose={() => {
        setConfirmDelete(false)
        onClose()
      }}
    >
      {seconds != null && (
        <p className="cardio-total num" aria-label="Measured time">
          {formatDuration(seconds)}
        </p>
      )}
      <div className="field">
        <span className="field-label">Duration (min)</span>
        <NumericField
          label="Duration in minutes"
          value={seconds == null ? null : Math.round((seconds / 60) * 10) / 10}
          onCommit={(v) =>
            void guard(() => updateCardio(entry.id, { durationSeconds: v == null ? null : Math.round(v * 60) }))
          }
        />
      </div>
      {cfg.metrics.map((m) => (
        <div className="field" key={m.key}>
          <span className="field-label">{m.label}</span>
          <NumericField
            label={m.label}
            value={entry[m.key] ?? null}
            integer={m.integer}
            onCommit={(v) => void guard(() => updateCardio(entry.id, { [m.key]: v }))}
          />
        </div>
      ))}
      <p className="hint">All values are optional.</p>
      <button type="button" className="btn primary big" onClick={onClose}>
        Done
      </button>
      {!confirmDelete ? (
        <button type="button" className="btn ghost danger-text block" onClick={() => setConfirmDelete(true)}>
          Delete this cardio…
        </button>
      ) : (
        <div className="banner error stack">
          <p>Delete this {cardioName(entry.kind, lang)} entry?</p>
          <button
            type="button"
            className="btn danger solid block"
            onClick={() =>
              void guard(async () => {
                await deleteCardio(entry.id)
                setConfirmDelete(false)
                onClose()
              })
            }
          >
            Yes, delete
          </button>
        </div>
      )}
    </Sheet>
  )
}
