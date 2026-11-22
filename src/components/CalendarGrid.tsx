import { Icon } from './Icon'
import { WEEKDAYS, dayOfMonth, monthGrid, monthName, shortDate, weekday, type ISODate } from '../lib/dates'

export type Marks = (day: ISODate) => { bill: boolean; chore: boolean }

/**
 * Month grid with bill/chore icons per day (v5 calendar sheet).
 * Date mode highlights one day; period mode highlights start to end (cra/crb/crm, as the guide asks).
 */
export function CalendarGrid({
  year,
  month,
  today,
  marks,
  selected,
  range,
  onPick,
  onMonth,
  canBack,
  canNext,
}: {
  year: number
  month: number
  today: ISODate
  marks: Marks
  selected?: ISODate | null
  range?: { from: ISODate | null; to: ISODate | null } | null
  onPick: (day: ISODate) => void
  onMonth: (delta: number) => void
  canBack: boolean
  canNext: boolean
}) {
  const grid = monthGrid(year, month)
  const lo = range?.from && range?.to ? (range.from < range.to ? range.from : range.to) : (range?.from ?? null)
  const hi = range?.from && range?.to ? (range.from < range.to ? range.to : range.from) : (range?.from ?? null)

  return (
    <>
      <div className="cnav">
        <button type="button" onClick={() => onMonth(-1)} disabled={!canBack} aria-label="Previous month">
          <Icon name="left" size={20} />
        </button>
        <b aria-live="polite">
          {monthName(month)} {year}
        </b>
        <button type="button" onClick={() => onMonth(1)} disabled={!canNext} aria-label="Next month">
          <Icon name="right" size={20} />
        </button>
      </div>
      <div className="cwk" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d[0]}</span>
        ))}
      </div>
      <div className="cgr" role="group" aria-label={`${monthName(month)} ${year}`}>
        {Array.from({ length: grid.blanks }, (_, i) => (
          <i key={`b${i}`} />
        ))}
        {grid.days.map((d) => {
          const m = marks(d)
          let cls = ''
          if (range && lo && hi && d >= lo && d <= hi) cls = d === lo && d === hi ? 'cra crb' : d === lo ? 'cra' : d === hi ? 'crb' : 'crm'
          else if (!range && selected === d) cls = 'sel'
          return (
            <button key={d} type="button" className={`cd ${d === today ? 'td' : ''} ${cls}`} aria-pressed={!!cls} aria-label={`${weekday(d)} ${shortDate(d)}${m.bill ? ', bills due' : ''}${m.chore ? ', chores due' : ''}`} onClick={() => onPick(d)}>
              <span className={`wc ${m.bill || m.chore ? 'on' : ''}`}>
                {m.bill && <Icon name="bill" size={13} />}
                {m.chore && <Icon name="chore" size={13} />}
              </span>
              <b>{dayOfMonth(d)}</b>
            </button>
          )
        })}
      </div>
    </>
  )
}
