import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDayTypes, useRoutines } from '../data/hooks'
import type { HistorySwipeAction, WorkoutSession } from '../domain/types'
import { deliver, exportCsvZip, exportJsonFile } from '../portability/exportData'
import { createRoutineFromSession, saveRoutine, updateRoutineFromSession } from '../routines/routineService'
import { formatDate } from '../ui/format'
import { IconRefresh, IconRepeat, IconShare, IconStar, IconTrash } from '../ui/icons'
import { Sheet } from '../ui/Sheet'
import { useToast } from '../ui/toastContext'
import { PresetForm } from './PresetForm'
import { deleteSession, getActiveSession, loadSessionView, startWorkout } from '../workout/workoutService'

export type SessionAction = Exclude<HistorySwipeAction, 'none'>

/** The five things you can do with a finished workout — shared by the detail page and the history swipes. */
export const SESSION_ACTIONS: Record<
  SessionAction,
  { label: string; icon: (props: object) => ReactNode; danger?: boolean }
> = {
  saveAsPreset: { label: 'Save as preset', icon: IconStar },
  updatePreset: { label: 'Update preset', icon: IconRefresh },
  repeat: { label: 'Repeat', icon: IconRepeat },
  export: { label: 'Export', icon: IconShare },
  delete: { label: 'Delete', icon: IconTrash, danger: true },
}

/**
 * Runs a workout action. Actions that need a choice or a confirmation open their sheet, which
 * `sheets` renders — so put `sheets` once into the page that calls `run`.
 */
export function useSessionActions(opts: { onDeleted?: () => void } = {}) {
  const navigate = useNavigate()
  const { guard, show } = useToast()
  const { active: days } = useDayTypes()
  const { active: routines } = useRoutines()
  const [target, setTarget] = useState<WorkoutSession | null>(null)
  const [open, setOpen] = useState<Exclude<SessionAction, 'repeat'> | null>(null)
  const close = () => setOpen(null)

  const performedOf = async (sessionId: string) =>
    ((await loadSessionView(sessionId))?.exercises ?? []).filter((e) => e.sets.some((s) => s.isCompleted))

  const run = (action: SessionAction, session: WorkoutSession) =>
    void guard(async () => {
      if (action === 'export' || action === 'delete') {
        setTarget(session)
        setOpen(action)
        return
      }
      const performed = await performedOf(session.id)
      if (performed.length === 0) {
        show('Nothing logged in this workout yet')
        return
      }
      if (action === 'updatePreset' && routines.length === 0) {
        show('No presets yet — save this workout as one instead')
        return
      }
      if (action === 'repeat') {
        if (await getActiveSession()) throw new Error('Finish your current workout first')
        await startWorkout({
          dayTypeId: session.dayTypeId,
          locationId: session.locationId,
          ...repeatPlan(performed.map((p) => p.we)),
        })
        navigate('/')
        return
      }
      setTarget(session)
      setOpen(action)
    })

  const session = target
  const sheets = (
    <>
      <Sheet open={open === 'saveAsPreset' && !!session} title="Save as preset" onClose={close}>
        {session && (
          <PresetForm
            defaultName={`${session.dayTypeNameSnapshot ?? 'Workout'} ${formatDate(session.startedAt)}`}
            defaultDay={session.dayTypeId}
            days={days}
            onSave={(name, dayTypeId) =>
              void guard(async () => {
                const r = await createRoutineFromSession(session.id, { name, dayTypeId })
                show(`Preset “${r.name}” saved`, { actionLabel: 'Edit', onAction: () => navigate(`/routines/${r.id}`) })
                close()
              })
            }
          />
        )}
      </Sheet>

      <Sheet open={open === 'updatePreset' && !!session} title="Update a preset" onClose={close}>
        <p className="secondary small">
          The preset keeps its name and day, but its exercises become what you did in this workout: order, set counts,
          rep range and supersets. You can undo right afterwards.
        </p>
        {session && (
          <ul className="list card flush">
            {[...routines]
              .sort((a, b) => Number(b.id === session.routineId) - Number(a.id === session.routineId))
              .map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="session-item"
                    onClick={() =>
                      void guard(async () => {
                        const previous = await updateRoutineFromSession(session.id, r.id)
                        close()
                        show(`Preset “${r.name}” updated`, {
                          actionLabel: 'Undo',
                          onAction: () =>
                            void guard(() =>
                              saveRoutine(r.id, {
                                name: r.name,
                                dayTypeId: r.dayTypeId,
                                notes: r.notes,
                                exercises: previous,
                              }),
                            ),
                        })
                      })
                    }
                  >
                    <div>
                      <div className="session-title">{r.name}</div>
                      {r.id === session.routineId && <div className="small muted">Started from this preset</div>}
                    </div>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={open === 'export' && !!session} title="Export this workout" onClose={close}>
        <p className="secondary small">
          Only this workout, with the exercises and gym it refers to. This is not a backup — it does not reset the
          backup reminder. The JSON file can be imported again (merge).
        </p>
        {session && (
          <>
            <button
              type="button"
              className="btn primary block"
              onClick={() =>
                void guard(async () => {
                  await deliver(await exportJsonFile('gym-tracker-workout', { sessionId: session.id }), {
                    share: true,
                    isBackup: false,
                  })
                  close()
                })
              }
            >
              JSON file
            </button>
            <button
              type="button"
              className="btn block"
              onClick={() =>
                void guard(async () => {
                  await deliver(await exportCsvZip({ sessionId: session.id }), { share: true, isBackup: false })
                  close()
                })
              }
            >
              CSV (ZIP)
            </button>
          </>
        )}
      </Sheet>

      <Sheet open={open === 'delete' && !!session} title="Delete this workout?" onClose={close}>
        {session && (
          <>
            <p>
              This permanently removes the workout of {formatDate(session.startedAt)} with all its sets. It cannot be
              undone — export a backup first if you are unsure.
            </p>
            <button
              type="button"
              className="btn danger solid block"
              onClick={() =>
                void guard(async () => {
                  await deleteSession(session.id)
                  close()
                  show('Workout deleted')
                  opts.onDeleted?.()
                })
              }
            >
              Delete permanently
            </button>
            <button type="button" className="btn block" onClick={close}>
              Cancel
            </button>
          </>
        )}
      </Sheet>
    </>
  )

  return { run, sheets }
}

/** Exercise ids in order (each once) plus their superset keys, so a repeated workout keeps its supersets. */
function repeatPlan(wes: { performedExerciseId: string; supersetGroupId?: string | null }[]) {
  const seen = new Set<string>()
  const exerciseIds: string[] = []
  const supersetKeys: (string | null)[] = []
  for (const we of wes) {
    if (seen.has(we.performedExerciseId)) continue
    seen.add(we.performedExerciseId)
    exerciseIds.push(we.performedExerciseId)
    supersetKeys.push(we.supersetGroupId ?? null)
  }
  return { exerciseIds, supersetKeys }
}
