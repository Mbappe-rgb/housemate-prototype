import { useEffect, useMemo, useState } from 'react'
import { Avatar } from '../../../components/Avatar'
import { CalendarGrid } from '../../../components/CalendarGrid'
import { Icon } from '../../../components/Icon'
import { Segmented } from '../../../components/Segmented'
import { Sheet } from '../../../components/Sheet'
import { useToast } from '../../../components/Toast'
import type { Bill } from '../../../lib/bills'
import { daysInMonth, monthName, shortDate, yearMonth, type ISODate } from '../../../lib/dates'
import { formatMoney } from '../../../lib/money'
import { byBill, byHousemate, byMonth, filterRecords, monthLabel, reportRecords, sumRecords, toCsv, type Scope } from '../../../lib/reports'
import { hueFor, memberById, nameFor, useHouse } from '../../house/house'

type Period = { kind: 'month'; year: number; month: number } | { kind: 'range'; from: ISODate; to: ISODate }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

function periodBounds(p: Period): [ISODate, ISODate] {
  if (p.kind === 'range') return p.from < p.to ? [p.from, p.to] : [p.to, p.from]
  return [`${p.year}-${pad(p.month)}-01`, `${p.year}-${pad(p.month)}-${pad(daysInMonth(p.year, p.month))}`]
}

function periodLabel(p: Period): string {
  if (p.kind === 'month') return `${monthName(p.month)} ${p.year}`
  const [a, b] = periodBounds(p)
  return a === b ? `${shortDate(a)}, ${a.slice(0, 4)}` : `${shortDate(a)} – ${shortDate(b)}, ${b.slice(0, 4)}`
}

/** Reports: Personal or Household, any period, chosen bills, then a report with CSV download. */
export function ReportsSheet({ onClose }: { onClose: () => void }) {
  const house = useHouse()
  const toast = useToast()
  const me = house.me.id
  const now = yearMonth(house.today)
  const [scope, setScope] = useState<Scope>('personal')
  const [period, setPeriod] = useState<Period>({ kind: 'month', year: now.year, month: now.month })
  const [picked, setPicked] = useState<string[] | null>(null) // null = all bills
  const [step, setStep] = useState<'form' | 'report'>('form')
  const [picker, setPicker] = useState<'month' | 'bills' | 'range' | null>(null)
  const [query, setQuery] = useState('')
  const [loaded, setLoaded] = useState<{ key: string; bills: Bill[] } | null>(null)
  const fetchBills = house.actions.fetchBills

  const [from, to] = periodBounds(period)
  const key = `${from}:${to}`
  useEffect(() => {
    let alive = true
    void fetchBills(from, to).then((bills) => alive && setLoaded({ key, bills }))
    return () => {
      alive = false
    }
  }, [from, to, key, fetchBills])
  const bills = loaded?.key === key ? loaded.bills : null

  const nameOf = (id: string) => nameFor(house, id)
  const all = useMemo(() => (bills ? reportRecords(bills, scope, me, (id) => nameFor(house, id)) : []), [bills, scope, me, house])
  const billNames = useMemo(() => [...new Set((bills ?? []).map((b) => b.name))], [bills])
  const records = filterRecords(all, picked, '')
  const total = sumRecords(records)
  const billsLabel = !picked || picked.length === billNames.length ? 'All bills' : picked.length === 0 ? 'No bills selected' : picked.length < 3 ? picked.join(', ') : `${picked.length} bills`
  const people = house.members.map((m) => m.id)

  const summary: [string, string][] =
    scope === 'personal'
      ? [
          ['Total paid', formatMoney(total)],
          ['Payments', String(records.length)],
          ['Bills covered', String(new Set(records.map((r) => r.bill.name)).size)],
          ['Receipts attached', String(records.filter((r) => r.receipt).length)],
        ]
      : [
          ['Total household bills', formatMoney(total)],
          ['Bills paid', String(records.length)],
          ['Fully settled', String(records.filter((r) => r.settled === r.people).length)],
          ['Your share', formatMoney(records.reduce((s, r) => s + (r.bill.shares[me]?.amountCents ?? 0), 0))],
        ]

  const download = () => {
    const csv = toCsv(records, scope, people, nameOf)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `housemate-${scope}-report-${from}-to-${to}.csv`
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    toast('Report downloaded')
  }

  if (step === 'report') {
    const list = filterRecords(records, null, query)
    return (
      <Sheet label="Report" onClose={onClose}>
        <div className="top hth">
          <button type="button" className="ib" onClick={() => setStep('form')} aria-label="Back">
            <Icon name="left" size={20} />
          </button>
          <div className="htt">
            <b>{scope === 'personal' ? 'Personal report' : 'Household report'}</b>
            <small>
              {periodLabel(period)} · {billsLabel}
            </small>
          </div>
          <span className="hsp" />
        </div>
        <div className="hbig">{formatMoney(total)}</div>
        <small className="hsm">
          {scope === 'personal' ? 'Total you paid' : 'Total household bills'} · {records.length} {scope === 'personal' ? 'payment' : 'bill'}
          {records.length === 1 ? '' : 's'}
        </small>

        {scope === 'household' && (
          <>
            <h4 className="hh4">By housemate</h4>
            <div className="card2 hlst">
              {byHousemate(records, people).map((row) => (
                <div key={row.id} className="hr">
                  <Avatar name={memberById(house, row.id)?.name ?? '?'} hue={hueFor(house, row.id)} size={36} />
                  <span className="hn">
                    <b>{nameOf(row.id)}</b>
                    <small>
                      Fronted {row.frontedCount} bill{row.frontedCount === 1 ? '' : 's'} · {formatMoney(row.frontedTotal)}
                      {row.owes > 0 && ` · Owes ${formatMoney(row.owes)}`}
                    </small>
                  </span>
                  <b className="ha">{formatMoney(row.paid)}</b>
                </div>
              ))}
            </div>
          </>
        )}

        <h4 className="hh4">By bill</h4>
        <div className="dl">
          {byBill(records).map(([name, cents]) => (
            <div key={name}>
              <span>{name}</span>
              <b>{formatMoney(cents)}</b>
            </div>
          ))}
        </div>
        <h4 className="hh4">By month</h4>
        <div className="dl">
          {byMonth(records).map(([m, cents]) => (
            <div key={m}>
              <span>{m}</span>
              <b>{formatMoney(cents)}</b>
            </div>
          ))}
        </div>

        <h4 className="hh4">{scope === 'personal' ? 'Payments' : 'Bills'}</h4>
        <label className="hsr">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Search bill or person" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
        </label>
        {list.length ? (
          <div className="card2 hlst">
            {list.map((r, i) => {
              const m = monthLabel(r.date)
              const newMonth = i === 0 || monthLabel(list[i - 1].date) !== m
              return (
                <div key={`${r.bill.id}-${i}`}>
                  {newMonth && (
                    <div className="hmh">
                      <b>{m}</b>
                      <small>{formatMoney(sumRecords(list.filter((x) => monthLabel(x.date) === m)))}</small>
                    </div>
                  )}
                  <div className="hr">
                    <span className="bi" aria-hidden="true">
                      {r.bill.emoji}
                    </span>
                    <span className="hn">
                      <b>{r.bill.name}</b>
                      <small>
                        {r.kind} · {shortDate(r.date)}
                        {r.people && ` · ${r.settled}/${r.people} settled`}
                        {r.receipt && ' · 📎'}
                      </small>
                    </span>
                    <b className="ha">{formatMoney(r.amountCents)}</b>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="hemp">
            <Icon name="bill" size={28} />
            <b>No payments found</b>
            <small>Try another search</small>
          </div>
        )}
        <button type="button" className="btn" style={{ marginTop: 16 }} onClick={download} disabled={!records.length}>
          Download CSV
        </button>
        <small className="hint" style={{ textAlign: 'center' }}>
          Emailing reports arrives with email reminders.
        </small>
      </Sheet>
    )
  }

  return (
    <>
      <Sheet label="Reports" onClose={onClose}>
        <div className="top hth">
          <button type="button" className="ib" onClick={onClose} aria-label="Back">
            <Icon name="left" size={20} />
          </button>
          <div className="htt">
            <b>Reports</b>
            <small>Stay on top of how you pay.</small>
          </div>
          <span className="hsp" />
        </div>
        <div style={{ height: 12 }} />
        <Segmented
          label="Report for"
          options={[
            ['personal', 'Personal'],
            ['household', 'Household'],
          ]}
          value={scope}
          onChange={setScope}
          className="no-top"
        />
        <button type="button" className="hfd" onClick={() => setPicker('month')}>
          <span>
            <small>Period</small>
            <b>{periodLabel(period)}</b>
          </span>
          <Icon name="down" size={18} />
        </button>
        <button type="button" className="hfd" onClick={() => setPicker('bills')} disabled={!billNames.length}>
          <span>
            <small>Bills</small>
            <b>{billsLabel}</b>
          </span>
          <Icon name="down" size={18} />
        </button>
        <h2 className="hbig2">{periodLabel(period)}</h2>
        {!bills ? (
          <p className="hint">Loading…</p>
        ) : records.length ? (
          <div className="hrows">
            {summary.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="hemp2">
            <div className="hill">
              <Icon name="bill" size={34} />
            </div>
            <p>No payments for this period yet, but as soon as they start rolling in, you can generate a report here.</p>
          </div>
        )}
        <button type="button" className="btn" style={{ marginTop: 18 }} disabled={!records.length} onClick={() => (setQuery(''), setStep('report'))}>
          Generate report
        </button>
      </Sheet>

      {picker === 'month' && (
        <MonthPicker
          initial={period.kind === 'month' ? period : { year: now.year, month: now.month }}
          max={now}
          onDone={(p) => {
            setPeriod({ kind: 'month', ...p })
            setPicker(null)
          }}
          onRange={() => setPicker('range')}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'range' && (
        <RangePicker
          today={house.today}
          initial={period.kind === 'range' ? [period.from, period.to] : null}
          onDone={(a, b) => {
            setPeriod({ kind: 'range', from: a, to: b })
            setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'bills' && (
        <BillsPicker
          names={billNames}
          emojiOf={(n) => bills?.find((b) => b.name === n)?.emoji ?? '🧾'}
          initial={picked ?? billNames}
          onDone={(list) => {
            setPicked(list.length === billNames.length ? null : list)
            setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  )
}

function MonthPicker({
  initial,
  max,
  onDone,
  onRange,
  onClose,
}: {
  initial: { year: number; month: number }
  max: { year: number; month: number }
  onDone: (p: { year: number; month: number }) => void
  onRange: () => void
  onClose: () => void
}) {
  const [year, setYear] = useState(initial.year)
  const [month, setMonth] = useState(initial.month)
  return (
    <Sheet label="Select year and month" onClose={onClose} stacked>
      <div className="htc">
        <b>Select year and month</b>
      </div>
      <div className="hyr">
        <div>
          <b>{year}</b>
          <small>Select year and month</small>
        </div>
        <span>
          <button type="button" onClick={() => setYear(year - 1)} disabled={year <= 2026} aria-label="Previous year">
            <Icon name="left" size={20} />
          </button>
          <button type="button" onClick={() => setYear(year + 1)} disabled={year >= max.year} aria-label="Next year">
            <Icon name="right" size={20} />
          </button>
        </span>
      </div>
      <div className="hmg">
        {MONTHS.map((m, i) => {
          const future = year > max.year || (year === max.year && i + 1 > max.month)
          return (
            <button key={m} type="button" className={month === i + 1 ? 'on' : ''} disabled={future} aria-pressed={month === i + 1} onClick={() => setMonth(i + 1)}>
              {m}
            </button>
          )
        })}
      </div>
      <button type="button" className="btn" onClick={() => onDone({ year, month })}>
        Continue
      </button>
      <button type="button" className="btn ghost" onClick={onRange}>
        Select day range
      </button>
    </Sheet>
  )
}

function RangePicker({ today, initial, onDone, onClose }: { today: ISODate; initial: [ISODate, ISODate] | null; onDone: (a: ISODate, b: ISODate) => void; onClose: () => void }) {
  const [shown, setShown] = useState(() => yearMonth(initial?.[0] ?? today))
  const [range, setRange] = useState<{ from: ISODate | null; to: ISODate | null }>({ from: initial?.[0] ?? null, to: initial?.[1] ?? null })
  const ready = !!(range.from && range.to)
  const step = (d: number) => {
    const i = shown.year * 12 + shown.month - 1 + d
    setShown({ year: Math.floor(i / 12), month: (i % 12) + 1 })
  }
  return (
    <Sheet label="Pick dates" onClose={onClose} stacked>
      <div className="top">
        <button type="button" className="ib" onClick={onClose} aria-label="Back">
          <Icon name="left" size={20} />
        </button>
        <div>
          <b className="lg">Pick dates</b>
          <small>For your report</small>
        </div>
      </div>
      <div className={`chint ${ready ? 'ok' : ''}`} style={{ marginTop: 10 }}>
        <Icon name="calendar" size={14} />
        <span>{!range.from ? 'Tap a start date' : !range.to ? 'Now tap an end date' : `${shortDate(range.from < range.to ? range.from : range.to)} – ${shortDate(range.from < range.to ? range.to : range.from)}`}</span>
        {range.from && (
          <button type="button" className="chc" onClick={() => setRange({ from: null, to: null })}>
            Clear
          </button>
        )}
      </div>
      <CalendarGrid
        year={shown.year}
        month={shown.month}
        today={today}
        marks={() => ({ bill: false, chore: false })}
        range={range}
        onPick={(d) => setRange((r) => (!r.from || r.to ? { from: d, to: null } : { from: r.from, to: d }))}
        onMonth={step}
        canBack={shown.year > 2026 || shown.month > 1}
        canNext={`${shown.year}-${pad(shown.month)}` < today.slice(0, 7)}
      />
      <button type="button" className="btn" style={{ marginTop: 12 }} disabled={!ready} onClick={() => ready && onDone(range.from! < range.to! ? range.from! : range.to!, range.from! < range.to! ? range.to! : range.from!)}>
        Use this period
      </button>
    </Sheet>
  )
}

function BillsPicker({
  names,
  emojiOf,
  initial,
  onDone,
  onClose,
}: {
  names: string[]
  emojiOf: (n: string) => string
  initial: string[]
  onDone: (list: string[]) => void
  onClose: () => void
}) {
  const [list, setList] = useState(initial)
  const allOn = list.length === names.length
  return (
    <Sheet label="Select bills" onClose={onClose} stacked>
      <div className="top hth">
        <button type="button" className="ib" onClick={onClose} aria-label="Back">
          <Icon name="left" size={20} />
        </button>
        <div className="htt">
          <b>Select bills</b>
          <small>Choose what goes in your report</small>
        </div>
        <span className="hsp" />
      </div>
      <div style={{ height: 12 }} />
      <button type="button" className="hbr all" role="checkbox" aria-checked={allOn} onClick={() => setList(allOn ? [] : names)}>
        <span className={`hck ${allOn ? 'on' : ''}`}>
          <Icon name="check" size={14} />
        </span>
        <b>Select all</b>
      </button>
      {names.map((n) => {
        const on = list.includes(n)
        return (
          <button key={n} type="button" className="hbr" role="checkbox" aria-checked={on} onClick={() => setList(on ? list.filter((x) => x !== n) : names.filter((x) => list.includes(x) || x === n))}>
            <span className={`hck ${on ? 'on' : ''}`}>
              <Icon name="check" size={14} />
            </span>
            <span className="hem" aria-hidden="true">
              {emojiOf(n)}
            </span>
            <b>{n}</b>
          </button>
        )
      })}
      <button type="button" className="btn" style={{ marginTop: 16 }} disabled={!list.length} onClick={() => onDone(list)}>
        Apply
      </button>
    </Sheet>
  )
}
