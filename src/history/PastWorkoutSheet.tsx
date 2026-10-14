import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../data/hooks'
import { toIso } from '../domain/time'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { createPastWorkout } from './sessionEditService'
import { SessionDetailsForm } from './SessionDetailsForm'

/** "Log a past workout": creates the finished workout shell, then opens it to add exercises and sets. */
export function PastWorkoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} title="Log a past workout" onClose={onClose}>
      <PastWorkoutForm onDone={onClose} />
    </Sheet>
  )
}

function PastWorkoutForm({ onDone }: { onDone: () => void }) {
  const settings = useSettings()
  const { guard } = useToast()
  const navigate = useNavigate()
  // Evaluated once when the sheet opens, not on every render.
  const [initial] = useState(() => ({
    startedAt: toIso(new Date()),
    durationMinutes: 60,
    locationId: settings.lastLocationId,
    dayTypeId: settings.lastDayTypeId,
  }))
  return (
    <div className="stack">
      <p className="secondary small">
        Forgot to log a session? Enter when and where it happened, then add what you did. Nothing is filled in for you.
      </p>
      <SessionDetailsForm
        submitLabel="Create workout"
        initial={initial}
        onSubmit={(v) =>
          void guard(async () => {
            const s = await createPastWorkout(v)
            onDone()
            navigate(`/history/${s.id}`, { state: { justCreated: true } })
          })
        }
      />
    </div>
  )
}
