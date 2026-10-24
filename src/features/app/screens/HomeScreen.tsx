import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '../../../components/Icon'
import { Ring } from '../../../components/Ring'
import { amountOwed, doneCount, toPay } from '../../../lib/bills'
import { dayName, dayOfMonth, daysBetween, dueHeadline, shortDate, weekStrip, weekday } from '../../../lib/dates'
import { formatMoney } from '../../../lib/money'
import { useHouse } from '../../house/house'
import { DayDots, DayItems, HomeHeader, Section } from '../parts'
import { useAppUI } from '../ui'
import { JoinRequestsCard } from '../JoinRequests'

function Hero() {
  const house = useHouse()
  const ui = useAppUI()
  const me = house.me.id
  const due = toPay(house.bills, me)
  const next = due[0]
  const total = house.bills.length
  const done = doneCount(house.bills, me)
  const bar = (
    <>
      <div className="bar" aria-hidden="true">
        <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
      <small style={{ marginBottom: next ? undefined : 0 }}>
        {done}/{total} bills paid this month
      </small>
    </>
  )

  if (next) {
    const iPay = next.payerId === me
    return (
      <div className="glass hero">
        <span className="lb">You owe</span>
        <div className="big">{formatMoney(amountOwed(house.bills, me))}</div>
        <small className="nx">
          <b>Next up: {next.name.toLowerCase()}</b>
          <br />
          {dueHeadline(next.dueDate, house.today)}
        </small>
        {bar}
        <button type="button" className="btn" onClick={() => ui.openBill(next.id)}>
          {iPay ? `Confirm ${next.name.toLowerCase()} paid` : `Mark ${next.name.toLowerCase()} as paid`}
        </button>
      </div>
    )
  }

  return (
    <div className="glass hero">
      <span className="lb">You owe</span>
      <div className="big">$0</div>
      <span className="chip ok">{total ? 'You’re all settled' : 'Nothing to pay yet'}</span>
      {total > 0 && bar}
      {!house.moneyReady && (
        <small style={{ margin: '4px 0 0' }}>Shared bills arrive in the next update. You’ll split them here.</small>
      )}
    </div>
  )
}

function Widgets() {
  const house = useHouse()
  const navigate = useNavigate()
  const me = house.me.id
  const total = house.bills.length
  const done = doneCount(house.bills, me)
  const next = toPay(house.bills, me)[0]
  const mine = house.chores.filter((c) => c.assigneeId === me)
  const choresDone = mine.filter((c) => c.doneAt).length
  const nextChore = mine.filter((c) => !c.doneAt).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))[0]

  return (
    <Section title="At a glance">
      <div className="wgs">
        <button type="button" className="wg" onClick={() => navigate('bills')} aria-label="Open bills">
          <span className="wt">
            <span className="wi">
              <Icon name="bills" size={16} />
            </span>
            <span>
              Bills<small>This month</small>
            </span>
          </span>
          <Ring fraction={total ? done / total : 0} color="var(--acc)" label={`${done}/${total}`} />
          <span className="wn">
            <b>
              {done} of {total} paid
            </b>
            <small>
              {next
                ? `${next.name}, ${daysBetween(house.today, next.dueDate) < 0 ? 'past due' : shortDate(next.dueDate)}`
                : total
                  ? 'All settled'
                  : 'No bills yet'}
            </small>
          </span>
        </button>
        <button type="button" className="wg" onClick={() => navigate('chores')} aria-label="Open chores">
          <span className="wt">
            <span className="wi">
              <Icon name="chores" size={16} />
            </span>
            <span>
              Chores<small>This week</small>
            </span>
          </span>
          <Ring fraction={mine.length ? choresDone / mine.length : 1} color="var(--btn)" label={`${choresDone}/${mine.length}`} />
          <span className="wn">
            <b>
              {choresDone} of {mine.length} done
            </b>
            <small>{nextChore ? `${nextChore.title}, ${dayName(nextChore.dueDate, house.today).toLowerCase()}` : mine.length ? 'All done' : 'No chores yet'}</small>
          </span>
        </button>
      </div>
    </Section>
  )
}

export function HomeScreen() {
  const house = useHouse()
  const me = house.me.id
  const [selected, setSelected] = useState(house.today)
  const days = weekStrip(house.today)
  const openChores = house.chores.filter((c) => c.assigneeId === me && !c.doneAt).length

  return (
    <div className="scr">
      <HomeHeader />
      <JoinRequestsCard />
      <Hero />
      <div className="tiles">
        <div>
          <b>{toPay(house.bills, me).length}</b>
          <small>bills to pay</small>
        </div>
        <div>
          <b>{openChores}</b>
          <small>Chores for you</small>
        </div>
      </div>
      <div className="glass wk" role="group" aria-label="This week">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            className={d === selected ? 't' : d === house.today ? 'td' : ''}
            aria-pressed={d === selected}
            aria-label={`Show ${weekday(d)} ${shortDate(d)}`}
            onClick={() => setSelected(d)}
          >
            <span>{weekday(d)}</span>
            <b>{dayOfMonth(d)}</b>
            <DayDots day={d} />
          </button>
        ))}
      </div>
      <Section title={selected === house.today ? 'Today' : `${weekday(selected)}, ${shortDate(selected)}`}>
        <DayItems day={selected} />
      </Section>
      <Widgets />
    </div>
  )
}
