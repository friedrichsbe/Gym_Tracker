import { useEffect, useRef, useState } from 'react'
import { formatNumber, parseNumber } from './format'

interface NumericFieldProps {
  /** Accessible name — never rely on placeholder alone. */
  label: string
  value: number | null
  onCommit: (value: number | null) => void
  integer?: boolean
  placeholder?: string
}

/**
 * Numeric entry that never fights the user: while focused the typed text is the
 * truth (cursor and partial input like "62." survive re-renders); the stored
 * value is written on every valid keystroke so nothing is lost if the app dies.
 */
export function NumericField({ label, value, onCommit, integer, placeholder }: NumericFieldProps) {
  const [text, setText] = useState(formatNumber(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(formatNumber(value))
  }, [value])

  return (
    <input
      type="text"
      className="num-input"
      inputMode={integer ? 'numeric' : 'decimal'}
      enterKeyHint="next"
      autoComplete="off"
      aria-label={label}
      placeholder={placeholder ?? '–'}
      value={text}
      onFocus={(e) => {
        focused.current = true
        e.currentTarget.select()
      }}
      onBlur={() => {
        focused.current = false
        setText(formatNumber(value))
      }}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        const parsed = parseNumber(raw)
        if (parsed === undefined) return // partial input like "." — keep typing
        if (integer && parsed != null && !Number.isInteger(parsed)) return
        onCommit(parsed)
      }}
    />
  )
}
