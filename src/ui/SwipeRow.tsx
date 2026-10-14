import { useRef, useState, type ReactNode } from 'react'

export interface SwipeAction {
  label: string
  icon: ReactNode
  danger?: boolean
  onTrigger: () => void
}

interface Props {
  /** Runs when the finger moves to the left (revealed on the right edge). */
  left?: SwipeAction
  /** Runs when the finger moves to the right (revealed on the left edge). */
  right?: SwipeAction
  className?: string
  children: ReactNode
}

type Phase = 'idle' | 'pending' | 'dragging'

/**
 * Row that runs an action when swiped sideways on a touch screen. Mouse input is ignored, vertical
 * scrolling stays native (touch-action: pan-y), and a tap after a swipe never opens the row's link.
 * The actions are shortcuts only — everything stays reachable through normal buttons.
 */
export function SwipeRow({ left, right, className = '', children }: Props) {
  const fg = useRef<HTMLDivElement>(null)
  const g = useRef({ phase: 'idle' as Phase, x0: 0, y0: 0, dx: 0, width: 1, armed: false, suppressClick: false })
  const [side, setSide] = useState<'left' | 'right' | null>(null)
  const [armed, setArmed] = useState(false)

  const threshold = () => Math.min(110, g.current.width * 0.32)
  const place = (dx: number, animate: boolean) => {
    const el = fg.current
    if (!el) return
    el.style.transition = animate ? 'transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1)' : 'none'
    el.style.transform = dx ? `translate3d(${dx}px, 0, 0)` : ''
  }
  const reset = () => {
    g.current.phase = 'idle'
    g.current.armed = false
    place(0, true)
    setArmed(false)
    // Keep the coloured side visible while the row slides back.
    window.setTimeout(() => g.current.phase === 'idle' && setSide(null), 220)
  }

  if (!left && !right) return <div className={className}>{children}</div>

  const action = side === 'left' ? left : side === 'right' ? right : undefined

  return (
    <div
      className={`swipe ${className}`}
      data-side={side ?? undefined}
      data-armed={armed || undefined}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' || !e.isPrimary) return
        g.current = {
          ...g.current,
          phase: 'pending',
          x0: e.clientX,
          y0: e.clientY,
          dx: 0,
          width: e.currentTarget.clientWidth || 1,
          suppressClick: false,
        }
      }}
      onPointerMove={(e) => {
        const s = g.current
        if (s.phase === 'idle') return
        const dx = e.clientX - s.x0
        const dy = e.clientY - s.y0
        if (s.phase === 'pending') {
          if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
            s.phase = 'idle' // vertical scroll — not ours
            return
          }
          if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) return
          s.phase = 'dragging'
          s.suppressClick = true
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // pointer already gone — the move/up events still reach us while the finger is on the row
          }
        }
        const dir = dx < 0 ? 'left' : 'right'
        const has = dir === 'left' ? !!left : !!right
        // No action on this side: a little resistance so it still feels physical.
        const limit = s.width * 0.6
        const moved = has ? Math.sign(dx) * Math.min(Math.abs(dx), limit) : dx * 0.12
        s.dx = moved
        place(moved, false)
        if (side !== dir) setSide(has ? dir : null)
        const nowArmed = has && Math.abs(moved) >= threshold()
        if (nowArmed !== s.armed) {
          s.armed = nowArmed
          setArmed(nowArmed)
          if (nowArmed) navigator.vibrate?.(8)
        }
      }}
      onPointerUp={() => {
        const s = g.current
        if (s.phase !== 'dragging') {
          s.phase = 'idle'
          return
        }
        const run = s.armed ? (s.dx < 0 ? left : right) : undefined
        reset()
        run?.onTrigger()
      }}
      onPointerCancel={() => g.current.phase !== 'idle' && reset()}
      onClickCapture={(e) => {
        if (!g.current.suppressClick) return
        g.current.suppressClick = false
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      {action && (
        <div className={`swipe-bg ${action.danger ? 'danger' : ''}`} aria-hidden="true">
          <span className="swipe-hint">
            {action.icon}
            {action.label}
          </span>
        </div>
      )}
      <div className="swipe-fg" ref={fg}>
        {children}
      </div>
    </div>
  )
}
