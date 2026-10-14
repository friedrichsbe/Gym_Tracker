import { useEffect, useRef } from 'react'
import { useNow, useSettings } from '../data/hooks'
import { adjustRest, formatClock, remainingSeconds, startRest, stopRest, useRestTimer } from './restTimer'

/** Short double beep. Needs a prior user gesture (the set tap) to be allowed; failures are harmless. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    for (const [i, freq] of [880, 1175].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      gain.gain.value = 0.15
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.22)
      osc.stop(ctx.currentTime + i * 0.22 + 0.16)
    }
    window.setTimeout(() => void ctx.close(), 800)
  } catch {
    // no sound available
  }
}

const OVER_BANNER_MS = 4000

/** Rest countdown inside the sticky workout bar. Always dismissible, never blocks logging. */
export function RestTimerBar() {
  const timer = useRestTimer()
  const settings = useSettings()
  const now = useNow(250)
  const fired = useRef<number | null>(null)
  const left = timer ? remainingSeconds(timer, now) : 0
  const over = !!timer && left === 0

  // Signal once when the rest ends — but not for a timer that already ended long ago (app reopened).
  useEffect(() => {
    if (!timer || !over || fired.current === timer.endsAt) return
    fired.current = timer.endsAt
    if (Date.now() - timer.endsAt > 5000) return
    if (settings.restVibrate) navigator.vibrate?.([200, 100, 200])
    if (settings.restSound) beep()
  }, [timer, over, settings.restVibrate, settings.restSound])

  // The "rest over" banner is brief: after the signal the bar disappears until the next rest starts.
  useEffect(() => {
    if (!timer || !over) return
    const id = window.setTimeout(stopRest, Math.max(0, OVER_BANNER_MS - (Date.now() - timer.endsAt)))
    return () => window.clearTimeout(id)
  }, [timer, over])

  if (!timer) {
    if (settings.restAutoStart) return null
    return (
      <div className="rest-row">
        <button type="button" className="btn small" onClick={() => startRest(settings.restDefaultSeconds, 'Rest')}>
          Start rest · {formatClock(settings.restDefaultSeconds)}
        </button>
      </div>
    )
  }

  const pct = Math.min(100, Math.max(0, ((timer.durationSec - left) / timer.durationSec) * 100))
  return (
    <div className={`rest-row rest-bar ${over ? 'over' : ''}`} role="timer" aria-label="Rest timer">
      <div className="rest-progress" style={{ width: `${pct}%` }} aria-hidden="true" />
      <span className="rest-time num">{formatClock(left)}</span>
      <span className="rest-label small" role="status">
        {over ? 'Resume — next set' : `Rest · ${timer.label}`}
      </span>
      {!over && (
        <span className="rest-actions">
          <button
            type="button"
            className="btn ghost small"
            aria-label="15 seconds less"
            onClick={() => adjustRest(-15)}
          >
            −15
          </button>
          <button type="button" className="btn ghost small" aria-label="15 seconds more" onClick={() => adjustRest(15)}>
            +15
          </button>
          <button type="button" className="btn small" onClick={stopRest}>
            Skip
          </button>
        </span>
      )}
    </div>
  )
}
