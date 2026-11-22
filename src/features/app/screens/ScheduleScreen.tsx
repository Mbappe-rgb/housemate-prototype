import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { CalendarGrid } from '../../../components/CalendarGrid'
import { Icon } from '../../../components/Icon'
import { Sheet } from '../../../components/Sheet'
import { isTodo, sortByDue } from '../../../lib/bills'
import { addDays, daysInMonth, monthName, shortDate, weekday, yearMonth, type ISODate } from '../../../lib/dates'
import { useHouse } from '../../house/house'
import { BillCard, ChoreCard, Empty } from '../parts'
import { useAppUI } from '../ui'

type Range = 'today' | 'week' | 'month' | 'next' | 'day' | 'period'
type Kind = 'all' | 'bills' | 'chores'
const RANGES: [Range, string][] = [
  ['today', 'Today'],
  ['week', 'This week'],
  ['month', 'This month'],
  ['next', 'Next month'],
]
const pad = (n: number) => String(n).padStart(2, '0')

function bounds(range: Range, today: ISODate, day: ISODate, from: ISODate, to: ISODate): [ISODate, ISODate] {
  const { year, month } = yearMonth(today)
  switch (range) {
    case 'today':
      return [today, today]
    case 'week':
      return [today, addDays(today, 6)]
    case 'month':
      return [`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`]
    case 'next': {
      const y = month === 12 ? year + 1 : year
      const m = month === 12 ? 1 : month + 1
      return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`]
    }
    case 'day':
      return [day, day]
    case 'period':
      return from < to ? [from, to] : [to, from]
  }
}

/** Schedule: bills and chores by day, week or month, with a calendar sheet for a date or a period. */
export function ScheduleScreen() {
  const house = useHouse()
  const ui = useAppUI()
  const me = house.me.id
  const [params, setParams] = useSearchParams()
  const range = (params.get('range') as Range) || 'today'
  const kind = (params.get('type') as Kind) || 'all'
  const day = params.get('day') || house.today
  const from = params.get('from') || house.today
  const to = params.get('to') || house.today
  const [calendar, setCalendar] = useState(false)

  const set = (change: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(change)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  // This week's strip: Sunday to Saturday around today
  const weekStart = addDays(house.today, -new Date(`${house.today}T12:00:00Z`).getUTCDay())
  const strip = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const marks = (d: ISODate) => ({
    bill: house.bills.some((b) => b.dueDate === d && isTodo(b, me)),
    chore: house.chores.some((c) => c.dueDate === d && !c.doneAt && c.assigneeId === me),
  })

  const [lo, hi] = bounds(range, house.today, day, from, to)
  const nearNow = range === 'today' || range === 'week'
  const bills = sortByDue(house.bills.filter((b) => (b.dueDate >= lo && b.dueDate <= hi) || (nearNow && b.dueDate < house.today && isTodo(b, me))))
  const chores = sortByDue(house.chores.filter((c) => (c.dueDate >= lo && c.dueDate <= hi) || (nearNow && c.dueDate < house.today && !c.doneAt)))
  const showBills = kind !== 'chores' && bills.length > 0
  const showChores = kind !== 'bills' && chores.length > 0
  const { month } = yearMonth(range === 'day' ? day : house.today)

  return (
    <div className="v2">
      <div className="hero2 short">
        <div className="hrow">
          <h1 className="mon">{monthName(month)}</h1>
          <button type="button" className={`cbtn ${calendar ? 'on' : ''}`} onClick={() => setCalendar(true)} aria-label="Open calendar" aria-expanded={calendar}>
            <Icon name="calendar" size={22} />
          </button>
        </div>
        <div className="wk2" role="group" aria-label="This week">
          {strip.map((d) => {
            const m = marks(d)
            const sel = range === 'day' ? d === day : range === 'today' && d === house.today
            return (
              <button key={d} type="button" className={`wd ${sel ? 'sel' : ''}`} aria-pressed={sel} aria-label={`${weekday(d)} ${shortDate(d)}`} onClick={() => set({ range: 'day', day: d })}>
                <i>{weekday(d)[0]}</i>
                <span className={`wc ${m.bill || m.chore ? 'on' : ''}`}>
                  {m.bill && <Icon name="bill" size={16} />}
                  {m.chore && <Icon name="chore" size={16} />}
                </span>
                <b>{Number(d.slice(8))}</b>
              </button>
            )
          })}
        </div>
      </div>

      <div className="sh2">
        <div className="rtabs" role="tablist" aria-label="Range">
          {range === 'day' && (
            <button type="button" role="tab" aria-selected className="rt on" onClick={() => set({ range: 'today', day: null })}>
              {weekday(day)}, {shortDate(day)}
              <span className="x" aria-label="Clear">
                ×
              </span>
            </button>
          )}
          {range === 'period' && (
            <button type="button" role="tab" aria-selected className="rt on" onClick={() => set({ range: 'today', from: null, to: null })}>
              {shortDate(lo)} – {shortDate(hi)}
              <span className="x" aria-label="Clear">
                ×
              </span>
            </button>
          )}
          {RANGES.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={range === key} className={`rt ${range === key ? 'on' : ''}`} onClick={() => set({ range: key, day: null, from: null, to: null })}>
              {label}
            </button>
          ))}
        </div>
        <div className="pills" role="group" aria-label="Show">
          {(
            [
              ['all', 'All'],
              ['bills', 'Bills'],
              ['chores', 'Chores'],
            ] as [Kind, string][]
          ).map(([key, label]) => (
            <button key={key} type="button" className={`chp ${kind === key ? 'on' : ''}`} aria-pressed={kind === key} onClick={() => set({ type: key })}>
              {label}
            </button>
          ))}
        </div>

        {showBills && (
          <>
            <div className="lbl">
              <Icon name="bill" size={18} />
              Bills
            </div>
            {bills.map((b) => (
              <BillCard key={b.id} bill={b} />
            ))}
          </>
        )}
        {showChores && (
          <>
            <div className="lbl">
              <Icon name="chore" size={18} />
              Chores
            </div>
            {chores.map((c) => (
              <ChoreCard key={c.id} chore={c} />
            ))}
          </>
        )}
        {!showBills && !showChores && <Empty title="Nothing due" text="Enjoy the quiet. Try another range." />}
        <div className="two" style={{ marginTop: 8 }}>
          <button type="button" className="btn sec" onClick={ui.openAddChore}>
            Add a chore
          </button>
          <button type="button" className="btn sec" onClick={ui.openAddBill}>
            Add a bill
          </button>
        </div>
      </div>

      {calendar && (
        <CalendarSheet
          marks={marks}
          initialDay={range === 'day' ? day : null}
          onClose={() => setCalendar(false)}
          onApplyDay={(d) => {
            set({ range: 'day', day: d, type: 'all', from: null, to: null })
            setCalendar(false)
          }}
          onApplyPeriod={(a, b) => {
            set({ range: 'period', from: a, to: b, type: 'all', day: null })
            setCalendar(false)
          }}
          onReports={() => {
            setCalendar(false)
            ui.openReports()
          }}
        />
      )}
    </div>
  )
}

function CalendarSheet({
  marks,
  initialDay,
  onClose,
  onApplyDay,
  onApplyPeriod,
  onReports,
}: {
  marks: (d: ISODate) => { bill: boolean; chore: boolean }
  initialDay: ISODate | null
  onClose: () => void
  onApplyDay: (d: ISODate) => void
  onApplyPeriod: (a: ISODate, b: ISODate) => void
  onReports: () => void
}) {
  const house = useHouse()
  const [mode, setMode] = useState<'date' | 'period'>('date')
  const [shown, setShown] = useState(() => yearMonth(initialDay ?? house.today))
  const [selected, setSelected] = useState<ISODate | null>(initialDay)
  const [range, setRange] = useState<{ from: ISODate | null; to: ISODate | null }>({ from: null, to: null })
  const ready = mode === 'date' ? !!selected : !!(range.from && range.to)
  const lo = range.from && range.to ? (range.from < range.to ? range.from : range.to) : range.from
  const hi = range.from && range.to ? (range.from < range.to ? range.to : range.from) : range.from
  const hint =
    mode === 'period'
      ? !range.from
        ? 'Tap a start date'
        : !range.to
          ? 'Now tap an end date'
          : `${shortDate(lo!)} – ${shortDate(hi!)}`
      : selected
        ? `${weekday(selected)}, ${shortDate(selected)}`
        : 'Tap a date, or switch to Period for a range'
  const step = (d: number) => {
    const i = shown.year * 12 + shown.month - 1 + d
    setShown({ year: Math.floor(i / 12), month: (i % 12) + 1 })
  }
  const nowMonth = yearMonth(house.today)
  const offset = (shown.year - nowMonth.year) * 12 + (shown.month - nowMonth.month)

  return (
    <Sheet label="Calendar" onClose={onClose}>
      <div className="top">
        <button type="button" className="ib" onClick={onClose} aria-label="Back">
          <Icon name="left" size={20} />
        </button>
        <div>
          <b className="lg">Calendar</b>
          <small>Date or period</small>
        </div>
        <button type="button" className="hbt" onClick={onReports}>
          <Icon name="bill" size={16} />
          Reports
        </button>
      </div>
      <div className="chd">
        <div className="cmode" role="group" aria-label="Pick">
          <button type="button" className={mode === 'date' ? 'on' : ''} aria-pressed={mode === 'date'} onClick={() => setMode('date')}>
            Date
          </button>
          <button type="button" className={mode === 'period' ? 'on' : ''} aria-pressed={mode === 'period'} onClick={() => (setMode('period'), setRange({ from: null, to: null }))}>
            Period
          </button>
        </div>
      </div>
      <div className={`chint ${ready ? 'ok' : ''}`}>
        {mode === 'period' && <Icon name="calendar" size={14} />}
        <span>{hint}</span>
        {(mode === 'period' ? range.from : selected) && (
          <button type="button" className="chc" onClick={() => (setSelected(null), setRange({ from: null, to: null }))}>
            Clear
          </button>
        )}
      </div>
      <CalendarGrid
        year={shown.year}
        month={shown.month}
        today={house.today}
        marks={marks}
        selected={mode === 'date' ? selected : null}
        range={mode === 'period' ? range : null}
        onPick={(d) => {
          if (mode === 'date') setSelected(d)
          else setRange((r) => (!r.from || r.to ? { from: d, to: null } : { from: r.from, to: d }))
        }}
        onMonth={step}
        canBack={offset > -3}
        canNext={offset < 12}
      />
      <div className="cft">
        <span>
          <Icon name="bill" size={14} />
          Bills
        </span>
        <span>
          <Icon name="chore" size={14} />
          Chores
        </span>
        <button
          type="button"
          className="lk2b"
          onClick={() => {
            setShown(nowMonth)
            if (mode === 'date') setSelected(house.today)
          }}
        >
          Today
        </button>
      </div>
      <button
        type="button"
        className="btn"
        style={{ marginTop: 12 }}
        disabled={!ready}
        onClick={() => {
          if (mode === 'date' && selected) onApplyDay(selected)
          if (mode === 'period' && lo && hi) onApplyPeriod(lo, hi)
        }}
      >
        {mode === 'date' ? 'View selected date' : 'View period'}
      </button>
    </Sheet>
  )
}
