import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../data/db'
import { useNow, useSettings } from '../data/hooks'

/** Nudges for a backup when there is data and the last export is older than the chosen interval. */
export function BackupReminder() {
  const settings = useSettings()
  const now = useNow(60_000)
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('completed').count(), [])
  if (!sessions || !settings.backupReminderDays) return null
  const last = settings.lastExportAt ? Date.parse(settings.lastExportAt) : null
  const days = last == null ? Infinity : (now - last) / 86_400_000
  if (days < settings.backupReminderDays) return null
  return (
    <div className="banner row between" role="status">
      <span>
        {last == null
          ? 'No backup yet — your workouts exist only on this device.'
          : `Last backup ${Math.floor(days)} days ago.`}
      </span>
      <Link to="/settings/backup" className="btn small">
        Back up
      </Link>
    </div>
  )
}
