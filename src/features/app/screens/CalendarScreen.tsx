import { useState } from 'react'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { amountOwed, pastDue, toPay } from '../../../lib/bills'
import { WEEKDAYS, dayOfMonth, monthGrid, monthName, shortDate, weekday, yearMonth } from '../../../lib/dates'
import { formatMoney } from '../../../lib/money'
import { useHouse } from '../../house/house'
import { DayDots, DayItems, Section } from '../parts'

export function CalendarScreen() {
  const house = useHouse()
  const me = house.me.id
  const [selected, setSelected] = useState(house.today)
  const [shown, setShown] = useState(() => yearMonth(house.today))
  const grid = monthGrid(shown.year, shown.month)
  const owed = amountOwed(house.bills, me)
  const late = pastDue(house.bills, me, house.today).length
  const total = house.bills.length
  const paid = total - toPay(house.bills, me).length
  const openChores = house.chores.filter((c) => c.assigneeId === me && !c.doneAt).length

  const step = (delta: number) => {
    const index = shown.year * 12 + (shown.month - 1) + delta
    setShown({ year: Math.floor(index / 12), month: (index % 12) + 1 })
  }

  return (
    <div className="scr">
      <header className="hd">
        <div>
          <h1 className="title" style={{ margin: 0 }} aria-live="polite">
            {monthName(shown.month)}
          </h1>
          <small>{house.household.name}</small>
        </div>
        <div className="mnav">
          <button type="button" className="ib" onClick={() => step(-1)} aria-label="Previous month">
            <Icon name="back" size={20} />
          </button>
          <button type="button" className="ib" onClick={() => step(1)} aria-label="Next month">
            <Icon name="next" size={20} />
          </button>
        </div>
        <Avatar name={house.me.name} hue={house.me.hue} size={46} />
      </header>

      <div className="glass pill">
        <div>
          <small>{owed ? 'You owe' : toPay(house.bills, me).length ? 'You owe nothing' : 'You’re all settled'}</small>
          <br />
          <b>{formatMoney(owed)}</b>
        </div>
        {late ? (
          <span className="chip" style={{ margin: 0 }}>
            {late} past due
          </span>
        ) : (
          <span className="chip ok" style={{ margin: 0 }}>
            {paid}/{total} paid
          </span>
        )}
      </div>

      <div className="card cal" role="group" aria-label={`${monthName(shown.month)} ${shown.year}`}>
        {WEEKDAYS.map((d) => (
          <i key={d} aria-hidden="true">
            {d[0]}
          </i>
        ))}
        {Array.from({ length: grid.blanks }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {grid.days.map((d) => (
          <button
            key={d}
            type="button"
            className={`dy ${d === house.today ? 'td' : ''} ${d === selected ? 'sl' : ''}`}
            aria-pressed={d === selected}
            aria-label={`${weekday(d)} ${shortDate(d)}`}
            onClick={() => setSelected(d)}
          >
            <span>{dayOfMonth(d)}</span>
            <DayDots day={d} />
          </button>
        ))}
      </div>

      <Section title={selected === house.today ? 'Today' : `${weekday(selected)}, ${shortDate(selected)}`}>
        <DayItems day={selected} />
      </Section>
      <div className="qa">
        <button type="button">{openChores} chores for you</button>
        <button type="button">{toPay(house.bills, me).length} bills to pay</button>
      </div>
    </div>
  )
}
