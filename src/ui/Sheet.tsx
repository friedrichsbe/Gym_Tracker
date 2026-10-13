import { useEffect, useRef, type ReactNode } from 'react'
import { IconX } from './icons'

interface SheetProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** Bottom sheet on a native <dialog>: focus trap, Esc and backdrop come for free. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose() // backdrop tap
      }}
    >
      {open && (
        <div className="sheet-inner">
          <div className="sheet-grabber" aria-hidden="true" />
          <div className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="btn ghost icon small" aria-label="Close" onClick={onClose}>
              <IconX />
            </button>
          </div>
          <div className="sheet-body">{children}</div>
        </div>
      )}
    </dialog>
  )
}
