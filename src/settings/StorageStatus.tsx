import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'

export function StorageStatus() {
  const info = useLiveQuery(async () => {
    const persisted = (await navigator.storage?.persisted?.()) ?? false
    const est = await navigator.storage?.estimate?.()
    return { persisted, usage: est?.usage ?? null }
  }, [])
  const [asked, setAsked] = useState(false)

  return (
    <section className="card stack" aria-labelledby="storage">
      <h2 id="storage">Browser storage</h2>
      <p className="card-desc">
        Your workouts live only in this browser on this device. Clearing site data or losing the phone loses them.{' '}
        {info?.persisted
          ? 'The browser has agreed to keep this data (persistent storage).'
          : 'The browser may evict this data under storage pressure.'}
      </p>
      {info && !info.persisted && navigator.storage?.persist && (
        <button
          type="button"
          className="btn"
          disabled={asked}
          onClick={() => {
            setAsked(true)
            void navigator.storage.persist()
          }}
        >
          Request persistent storage
        </button>
      )}
    </section>
  )
}
