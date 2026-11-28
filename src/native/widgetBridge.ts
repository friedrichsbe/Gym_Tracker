import { registerPlugin } from '@capacitor/core'
import { liveQuery } from 'dexie'
import { buildWidgetPayload, type LastWorkoutPayload } from './widgetPayload'

/** Custom native plugin (android/app/src/main/java/dev/kiste/gymtracker/WidgetBridgePlugin.kt). */
interface WidgetBridgePlugin {
  /** Stores the payload for the home-screen widget and redraws it. `payload: null` = empty state. */
  update(options: { payload: string | null }): Promise<void>
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

let last: string | undefined

async function push(payload: LastWorkoutPayload | null, force = false) {
  const json = payload ? JSON.stringify(payload) : null
  const key = json ?? 'null'
  if (!force && key === last) return
  last = key
  try {
    await WidgetBridge.update({ payload: json })
  } catch (e) {
    last = undefined // retry next time
    console.warn('Widget update failed', e)
  }
}

/** Pushes the current state now (app start, app pause). */
export async function syncWidget(force = false) {
  await push(await buildWidgetPayload(), force)
}

/**
 * Keeps the widget in step with the data: any change to sessions or sets (finishing a workout, editing or deleting
 * one, an import) re-derives the payload; identical payloads are not sent twice.
 */
export function watchWidget(): () => void {
  // liveQuery tracks every table range the callback reads and re-runs it when one of them changes.
  const sub = liveQuery(buildWidgetPayload).subscribe({
    next: (p) => void push(p),
    error: (e) => console.warn('Widget watch failed', e),
  })
  return () => sub.unsubscribe()
}
