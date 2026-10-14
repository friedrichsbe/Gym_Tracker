import { useEffect, useState } from 'react'
import { db } from '../data/db'

/**
 * Early warnings about the two things that can cost data without any visible error:
 * the browser refusing to store anything, and the app being open twice at once.
 */
export function StorageGuard() {
  const [storageProblem, setStorageProblem] = useState<string | null>(null)
  const [otherTab, setOtherTab] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    db.open().catch((e: unknown) => {
      if (!cancelled)
        setStorageProblem(
          `This browser does not allow the app to store data (${e instanceof Error ? e.message : 'unknown error'}). ` +
            'Workouts will be lost when you close the tab — leave private mode, or export often.',
        )
    })
    // Ask the browser not to evict our data under storage pressure; harmless when refused.
    void navigator.storage?.persist?.().catch(() => undefined)
    void navigator.storage
      ?.estimate?.()
      .then(({ usage, quota }) => {
        if (!cancelled && usage && quota && usage / quota > 0.9)
          setStorageProblem('Device storage is almost full. Free some space and export a backup.')
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const me = Math.random().toString(36).slice(2)
    const channel = new BroadcastChannel('gym-tracker-tabs')
    channel.onmessage = (ev: MessageEvent<{ type: string; from: string }>) => {
      if (ev.data.from === me) return
      setOtherTab(true)
      if (ev.data.type === 'hello') channel.postMessage({ type: 'here', from: me }) // let the newcomer know too
    }
    channel.postMessage({ type: 'hello', from: me })
    return () => channel.close()
  }, [])

  return (
    <>
      {storageProblem && (
        <p className="banner error" role="alert">
          {storageProblem}
        </p>
      )}
      {otherTab && !dismissed && (
        <div className="banner" role="status">
          <p>
            Gym Tracker is open in another tab or window. Log in only one of them — two at once can overwrite each
            other’s changes.
          </p>
          <button type="button" className="btn small" onClick={() => setDismissed(true)}>
            Got it
          </button>
        </div>
      )}
    </>
  )
}
