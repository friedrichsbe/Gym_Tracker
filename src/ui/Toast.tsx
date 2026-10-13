import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastApi } from './toastContext'

interface ToastItem {
  id: number
  message: string
  kind: 'info' | 'error'
  actionLabel?: string
  onAction?: () => void
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const show = useCallback<ToastApi['show']>(
    (message, opts = {}) => {
      const id = nextId.current++
      setItems((xs) => [
        ...xs.slice(-2),
        { id, message, kind: opts.kind ?? 'info', actionLabel: opts.actionLabel, onAction: opts.onAction },
      ])
      window.setTimeout(() => dismiss(id), opts.ms ?? (opts.kind === 'error' ? 8000 : 6000))
    },
    [dismiss],
  )

  const guard = useCallback<ToastApi['guard']>(
    async (fn) => {
      try {
        return await fn()
      } catch (err) {
        console.error(err)
        const detail = err instanceof Error ? err.message : String(err)
        show(`Couldn't save: ${detail}. Your data may not be stored — export a backup if this repeats.`, {
          kind: 'error',
        })
        return undefined
      }
    },
    [show],
  )

  const api = useMemo(() => ({ show, guard }), [show, guard])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>
            <span>{t.message}</span>
            {t.actionLabel && (
              <button
                type="button"
                onClick={() => {
                  t.onAction?.()
                  dismiss(t.id)
                }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
