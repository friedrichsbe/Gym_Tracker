import { db, EXPORT_FORMAT_VERSION, SCHEMA_VERSION } from './db'
import type { AppSettings } from '../domain/types'

export const DEFAULT_SETTINGS: AppSettings = {
  key: 'app',
  units: 'kg',
  theme: 'system',
  lightStyle: 'light',
  darkStyle: 'dark',
  accent: 'teal',
  defaultLocationId: null,
  lastLocationId: null,
  onboardingDone: false,
  lastDayTypeId: null,
  includeWarmupsInStats: true,
  dayTypesSeeded: false,
  lastExportAt: null,
  backupReminderDays: 14,
}

export async function getSettings(): Promise<AppSettings> {
  // Merge so settings saved by an older version pick up defaults for new fields.
  return { ...DEFAULT_SETTINGS, ...(await db.settings.get('app')) }
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'key'>>): Promise<AppSettings> {
  // One transaction, so quick successive changes can't overwrite each other with stale values.
  return db.transaction('rw', db.settings, async () => {
    const next = { ...(await getSettings()), ...patch }
    await db.settings.put(next)
    return next
  })
}

export async function ensureSchemaMetadata(): Promise<void> {
  const existing = await db.meta.get('schema')
  if (existing?.schemaVersion === SCHEMA_VERSION) return
  await db.meta.put({
    key: 'schema',
    schemaVersion: SCHEMA_VERSION,
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    lastMigratedAt: existing ? new Date().toISOString() : null,
  })
}
