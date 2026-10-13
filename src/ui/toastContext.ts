import { createContext, useContext } from 'react'

export interface ToastApi {
  show: (
    message: string,
    opts?: { actionLabel?: string; onAction?: () => void; kind?: 'info' | 'error'; ms?: number },
  ) => void
  /** Run a data operation; failures are surfaced, never swallowed (PRD: no silent loss). */
  guard: <T>(fn: () => Promise<T>) => Promise<T | undefined>
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
