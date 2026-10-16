import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db } from '../data/db'
import { useNow, useSettings } from '../data/hooks'
import { updateSettings } from '../data/settings'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { deliver, exportCsvZip, exportJsonFile } from './exportData'
import { applyImport, parseImportText, planImport, type ImportMode, type ImportPlan } from './importData'
import type { ExportFile } from './schema'
import { resetAllData } from './resetData'

const REMINDERS: { value: string; label: string }[] = [
  { value: '', label: 'Never' },
  { value: '7', label: 'After 7 days' },
  { value: '14', label: 'After 14 days' },
  { value: '30', label: 'After 30 days' },
]

export function DataPanel() {
  const settings = useSettings()
  const now = useNow(60_000)
  const { guard, show } = useToast()
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('completed').count(), [])
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ data: ExportFile; name: string } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [mode, setMode] = useState<ImportMode>('merge')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const canShare =
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] })

  const last = settings.lastExportAt ? Date.parse(settings.lastExportAt) : null
  const days = last == null ? null : Math.floor((now - last) / 86_400_000)

  const choose = async (f: File | undefined) => {
    if (!f) return
    setErrors([])
    const result = parseImportText(await f.text(), f.size)
    if (!result.ok) {
      setErrors(result.errors)
      setFile(null)
      setPlan(null)
      return
    }
    setFile({ data: result.file, name: f.name })
    setMode('merge')
    setPlan(await planImport(result.file, 'merge'))
  }

  const changeMode = async (m: ImportMode) => {
    setMode(m)
    if (file) setPlan(await planImport(file.data, m))
  }

  const close = () => {
    setFile(null)
    setPlan(null)
    setErrors([])
    if (fileInput.current) fileInput.current.value = ''
  }

  const run = () =>
    void guard(async () => {
      if (!plan) return
      setBusy(true)
      try {
        if (mode === 'replace') {
          // Never overwrite the only copy: hand the user a backup of the current data first.
          await deliver(await exportJsonFile('gym-tracker-before-restore'))
        }
        await applyImport(plan)
        show(`Imported ${plan.counts.sessions.added} workouts, ${plan.counts.sets.added} sets`)
        close()
      } finally {
        setBusy(false)
      }
    })

  return (
    <>
      <section className="card stack" aria-labelledby="backup-title" id="backup">
        <h2 id="backup-title">Back up</h2>
        <p className="num small">
          {last == null ? (
            <strong>No backup made yet.</strong>
          ) : (
            <>
              Last backup: <strong>{new Date(last).toLocaleDateString()}</strong> (
              {days === 0 ? 'today' : `${days} days ago`})
            </>
          )}
          {sessions != null && <span className="muted"> · {sessions} workouts stored</span>}
        </p>

        <button
          type="button"
          className="btn primary big"
          onClick={() =>
            void guard(async () =>
              show((await deliver(await exportJsonFile())) === 'downloaded' ? 'Backup downloaded' : 'Backup shared'),
            )
          }
        >
          Back up now (JSON)
        </button>
        {canShare && (
          <button
            type="button"
            className="btn block"
            onClick={() =>
              void guard(async () => {
                await deliver(await exportJsonFile(), { share: true })
              })
            }
          >
            Share backup… (Drive, Files, …)
          </button>
        )}
        <button
          type="button"
          className="btn block"
          onClick={() =>
            void guard(async () =>
              show(
                (await deliver(await exportCsvZip())) === 'downloaded' ? 'CSV export downloaded' : 'CSV export shared',
              ),
            )
          }
        >
          Export as CSV (ZIP, for spreadsheets)
        </button>
        <p className="hint">
          JSON is the complete backup you can restore here. The CSV ZIP contains one file per table plus a README
          describing every column.
        </p>

        <div className="field">
          <label htmlFor="reminder">Remind me to back up</label>
          <select
            id="reminder"
            value={settings.backupReminderDays?.toString() ?? ''}
            onChange={(e) =>
              void guard(() => updateSettings({ backupReminderDays: e.target.value ? Number(e.target.value) : null }))
            }
          >
            {REMINDERS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card stack" aria-labelledby="restore-title" id="restore">
        <h2 id="restore-title">Restore</h2>
        <div className="field">
          <label htmlFor="import-file">Import a JSON backup</label>
          <input
            id="import-file"
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        </div>
        {errors.length > 0 && (
          <div className="banner error stack" role="alert">
            <strong>This file can’t be imported. Nothing was changed.</strong>
            <ul>
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <Sheet open={plan !== null} title="Import preview" onClose={close}>
          {plan && file && (
            <>
              <p className="secondary">
                {file.name} · exported {new Date(file.data.exportedAt).toLocaleString()}
              </p>
              <fieldset className="stack fieldset-reset">
                <legend className="field-label">How to import</legend>
                <label className="radio-card">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'merge'}
                    onChange={() => void changeMode('merge')}
                  />
                  <span className="rc-body">
                    <strong>Add to my data</strong>
                    <span className="small muted">
                      Keeps everything you have and adds what is missing. Items already present are skipped.
                    </span>
                  </span>
                </label>
                <label className="radio-card">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === 'replace'}
                    onChange={() => void changeMode('replace')}
                  />
                  <span className="rc-body">
                    <strong>Replace everything</strong>
                    <span className="small muted">
                      Restores the file exactly. A backup of your current data is downloaded first.
                    </span>
                  </span>
                </label>
              </fieldset>

              <table className="data">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>In file</th>
                    <th>Will be added</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.entries(plan.counts) as [string, { incoming: number; added: number }][]).map(([k, c]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{c.incoming}</td>
                      <td>{c.added}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {plan.warnings.length > 0 && (
                <div className="banner stack">
                  <strong>Notes</strong>
                  <ul>
                    {plan.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {mode === 'replace' && (
                <p className="banner error">
                  Replace removes your current workouts, presets and exercises and swaps in the file’s contents.
                </p>
              )}

              <button
                type="button"
                className={`btn big ${mode === 'replace' ? 'danger solid' : 'primary'}`}
                disabled={busy}
                aria-busy={busy}
                onClick={run}
              >
                {mode === 'replace' ? 'Back up, then replace' : 'Import'}
              </button>
            </>
          )}
        </Sheet>
      </section>

      <section className="card stack danger-zone" aria-labelledby="danger-title">
        <h2 id="danger-title">Danger zone</h2>
        <details>
          <summary>Delete all data</summary>
          <div className="stack">
            <p className="secondary small">
              Deletes all workouts, presets, exercises and settings from this device. Back up first.
            </p>
            <button type="button" className="btn danger" onClick={() => setResetting(true)}>
              Delete all data…
            </button>
          </div>
        </details>

        <Sheet
          open={resetting}
          title="Delete all data?"
          onClose={() => {
            setResetting(false)
            setConfirmText('')
          }}
        >
          <p>
            This cannot be undone. Type <strong>DELETE</strong> to confirm.
          </p>
          <div className="field">
            <label htmlFor="confirm-del">Confirmation</label>
            <input
              id="confirm-del"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            className="btn danger solid big"
            disabled={confirmText !== 'DELETE'}
            onClick={() =>
              void guard(async () => {
                await resetAllData()
                setResetting(false)
                setConfirmText('')
              })
            }
          >
            Delete everything
          </button>
        </Sheet>
      </section>
    </>
  )
}
