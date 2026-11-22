import { useState } from 'react'
import { Icon } from './Icon'
import { WEEKDAYS, dayOfMonth, monthGrid, monthName, shortDate, yearMonth, type ISODate } from '../lib/dates'

/** Inline month picker from the v5 prototype. Dates outside [min, max] are disabled. */
export function DatePicker({ value, onChange, today, min, max }: { value: ISODate; onChange: (d: ISODate) => void; today: ISODate; min: ISODate; max: ISODate }) {
  const [shown, setShown] = useState(() => yearMonth(value || today))
  const grid = monthGrid(shown.year, shown.month)
  const first = `${shown.year}-${String(shown.month).padStart(2, '0')}-01`
  const step = (delta: number) => {
    const i = shown.year * 12 + (shown.month - 1) + delta
    setShown({ year: Math.floor(i / 12), month: (i % 12) + 1 })
  }
  const canBack = first > min.slice(0, 7) + '-01' || first.slice(0, 7) > min.slice(0, 7)
  const canNext = grid.days[grid.days.length - 1] < max

  return (
    <div className="dpk">
      <div className="dpk-h">
        <button type="button" onClick={() => step(-1)} disabled={!canBack} aria-label="Previous month">
          <Icon name="left" size={18} />
        </button>
        <b aria-live="polite">
          {monthName(shown.month)} {shown.year}
        </b>
        <button type="button" onClick={() => step(1)} disabled={!canNext} aria-label="Next month">
          <Icon name="right" size={18} />
        </button>
      </div>
      <div className="dpk-w" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d[0]}</span>
        ))}
      </div>
      <div className="dpk-g" role="group" aria-label={`${monthName(shown.month)} ${shown.year}`}>
        {Array.from({ length: grid.blanks }, (_, i) => (
          <i key={`b${i}`} />
        ))}
        {grid.days.map((d) => (
          <button
            key={d}
            type="button"
            className={`dc ${d === value ? 'on' : ''} ${d === today ? 'td' : ''}`}
            disabled={d < min || d > max}
            aria-pressed={d === value}
            aria-label={shortDate(d)}
            onClick={() => onChange(d)}
          >
            {dayOfMonth(d)}
          </button>
        ))}
      </div>
    </div>
  )
}
