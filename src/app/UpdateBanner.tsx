import { applyPwaUpdate, useUpdateAvailable } from './pwa'

/** Shown only where reloading is safe (never inside an active workout). */
export function UpdateBanner() {
  const available = useUpdateAvailable()
  if (!available) return null
  return (
    <div className="banner row between" role="status">
      <span>A new version is ready.</span>
      <button type="button" className="btn small" onClick={applyPwaUpdate}>
        Update now
      </button>
    </div>
  )
}
