import { IconCalendar, IconX } from './icons'

const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

interface Props {
  id: string
  label: string
  /** ISO date (yyyy-mm-dd) or '' for none. */
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  placeholder?: string
}

/**
 * Date filter that behaves like a button: tapping anywhere on it opens the native date picker
 * (a bare date input only selects its text on phones and never raises a usable picker).
 * The real input sits invisibly over the whole field, so keyboard and screen readers still work.
 */
export function DateField({ id, label, value, onChange, min, max, placeholder = 'Any date' }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`date-field ${value ? 'has-value' : ''}`}>
        <span className="date-field-icon" aria-hidden="true">
          <IconCalendar />
        </span>
        <span className="date-field-text num">{value ? fmt.format(new Date(`${value}T00:00`)) : placeholder}</span>
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker()
            } catch {
              // picker unsupported or already open: the native control still handles the tap
            }
          }}
        />
        {value && (
          <button
            type="button"
            className="date-field-clear"
            aria-label={`Clear ${label.toLowerCase()} date`}
            onClick={() => onChange('')}
          >
            <IconX />
          </button>
        )}
      </div>
    </div>
  )
}
