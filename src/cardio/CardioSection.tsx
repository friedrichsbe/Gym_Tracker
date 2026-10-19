import { useState } from 'react'
import { useNow } from '../data/hooks'
import { instant } from '../domain/time'
import type { CardioEntry, CardioKind, CardioSlot } from '../domain/types'
import { formatDuration } from '../ui/format'
import { IconPlus } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { LangToggle } from '../ui/LangToggle'
import { useNameLang } from '../ui/lang'
import { stopRest } from '../workout/restTimer'
import { CARDIO_KIND_ORDER, cardioName, cardioSummary } from './cardioKinds'
import { addPastCardio, isRunning, startCardio, stopCardio } from './cardioService'
import { CardioSheet } from './CardioSheet'

const SLOT_TEXT: Record<CardioSlot, { add: string; title: string }> = {
  start: { add: 'Cardio at start', title: 'Cardio before your workout' },
  end: { add: 'Cardio at end', title: 'Cardio after your workout' },
}

interface Props {
  sessionId: string
  slot: CardioSlot
  /** All cardio of the session; the section shows the ones of its own slot. */
  entries: CardioEntry[]
  /** false hides the add button (e.g. cardio at the start makes no sense once sets are logged). */
  canAdd?: boolean
  /** Finished workout: adding creates an untimed block and opens it to type the duration. */
  past?: boolean
}

/** Cardio blocks at the start or end of the active workout: pick a machine, the clock runs, stop, note the values. */
export function CardioSection({ sessionId, slot, entries, canAdd = true, past = false }: Props) {
  const { guard } = useToast()
  const lang = useNameLang()
  const [picking, setPicking] = useState(false)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const mine = entries.filter((e) => e.slot === slot)
  const running = entries.some(isRunning)

  return (
    <>
      {mine.map((e) => (
        <CardioCard key={e.id} entry={e} startOpen={e.id === justAdded} />
      ))}
      {canAdd && (
        <button
          type="button"
          className="btn block dashed"
          disabled={running}
          title={running ? 'Stop the running cardio first' : undefined}
          onClick={() => setPicking(true)}
        >
          <IconPlus />
          {SLOT_TEXT[slot].add}
        </button>
      )}
      <Sheet open={picking} title={SLOT_TEXT[slot].title} onClose={() => setPicking(false)}>
        <div className="row-between">
          <p className="secondary small">
            {past
              ? 'Pick the machine, then enter how long and the details.'
              : 'Pick the machine. The timer starts right away; you add the details afterwards.'}
          </p>
          <LangToggle />
        </div>
        <ul className="list card flush">
          {CARDIO_KIND_ORDER.map((kind: CardioKind) => (
            <li key={kind}>
              <button
                type="button"
                className="list-btn"
                onClick={() =>
                  void guard(async () => {
                    if (past) setJustAdded((await addPastCardio({ sessionId, kind, slot })).id)
                    else {
                      await startCardio({ sessionId, kind, slot })
                      stopRest() // cardio is the next thing now; don't leave a rest countdown running beside it
                    }
                    setPicking(false)
                  })
                }
              >
                <span className="list-title">{cardioName(kind, lang)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}

export function CardioCard({ entry, startOpen = false }: { entry: CardioEntry; startOpen?: boolean }) {
  const { guard } = useToast()
  const lang = useNameLang()
  const name = cardioName(entry.kind, lang)
  const [editing, setEditing] = useState(startOpen)
  if (isRunning(entry)) {
    return (
      <section className="card cardio running" aria-label={`${name}, running`}>
        <div className="cardio-row">
          <div className="grow">
            <h3 className="exercise-name">{name}</h3>
            <CardioClock startedAt={entry.startedAt} />
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              void guard(async () => {
                await stopCardio(entry.id)
                setEditing(true) // straight on to the values
              })
            }
          >
            Stop
          </button>
        </div>
      </section>
    )
  }

  return (
    <>
      <button
        type="button"
        className="card cardio done"
        aria-label={`${cardioSummary(entry, lang)}. Edit`}
        onClick={() => setEditing(true)}
      >
        <span className="list-title">{name}</span>
        <span className="list-sub num">
          {cardioSummary(entry, lang).split(' · ').slice(1).join(' · ') || 'Tap to add details'}
        </span>
      </button>
      <CardioSheet entry={entry} open={editing} onClose={() => setEditing(false)} />
    </>
  )
}

/** Only the running card ticks, so finished ones don't re-render every second. */
function CardioClock({ startedAt }: { startedAt: string }) {
  const now = useNow(1000)
  return (
    <span className="cardio-clock num" role="timer">
      {formatDuration((now - instant(startedAt)) / 1000)}
    </span>
  )
}
