import type { ReactNode } from 'react'
import { supersetLabel } from './supersets'

/**
 * Visual wrapper for exercises done as a superset: one violet rail, one label, optional "up next" hint and an
 * optional menu for the superset as a whole (top right).
 */
export function SupersetFrame(props: { size: number; hint?: string; menu?: ReactNode; children: ReactNode }) {
  const label = supersetLabel(props.size)
  return (
    <div className="superset" role="group" aria-label={`${label} of ${props.size} exercises`}>
      <div className="superset-head">
        <span className="tag superset-tag">{label}</span>
        <span className="small secondary">alternate sets, no rest in between</span>
        {props.hint && (
          <strong className="small superset-next" aria-live="polite">
            Next: {props.hint}
          </strong>
        )}
        {props.menu}
      </div>
      {props.children}
    </div>
  )
}
