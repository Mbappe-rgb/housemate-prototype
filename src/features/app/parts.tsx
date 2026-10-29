import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../components/Avatar'
import { Icon } from '../../components/Icon'
import { isTodo, othersCount, shareOf, type Bill, type Chore } from '../../lib/bills'
import { daysBetween, dayName, dueText, greeting } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { memberById, nameFor, useHouse } from '../house/house'
import { useAppUI } from './ui'

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="sec">
        {title}
        {aside && <span>{aside}</span>}
      </h3>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card empty">{children}</div>
}

/** Avatar + greeting + bell, at the top of Home. */
export function HomeHeader() {
  const house = useHouse()
  const ui = useAppUI()
  return (
    <header className="hd">
      <Link className="avb" to="profile" aria-label="Open profile">
        <Avatar name={house.me.name} hue={house.me.hue} size={46} />
      </Link>
      <div>
        <b>
          {greeting()}, {house.me.name}
        </b>
        <small>{house.household.name}</small>
      </div>
      <button
        type="button"
        className="ib"
        aria-label={house.joinRequests.length ? `Notifications, ${house.joinRequests.length} new` : 'Notifications'}
        onClick={ui.openNotifications}
      >
        <Icon name="bell" size={20} />
        {house.joinRequests.length > 0 && (
          <span className="badge" aria-hidden="true">
            {house.joinRequests.length}
          </span>
        )}
      </button>
    </header>
  )
}

/** Little bars showing which housemates have paid. */
function PaidSegments({ bill }: { bill: Bill }) {
  return (
    <span className="seg" aria-hidden="true">
      {Object.entries(bill.shares)
        .filter(([id]) => id !== bill.payerId)
        .map(([id, s]) => (
          <i key={id} className={s.paidAt ? 'on' : ''} />
        ))}
    </span>
  )
}

export function BillRow({ bill, long = false }: { bill: Bill; long?: boolean }) {
  const house = useHouse()
  const ui = useAppUI()
  const me = house.me.id
  const todo = isTodo(bill, me)
  const iPay = bill.payerId === me
  const late = todo && daysBetween(house.today, bill.dueDate) < 0
  const paidCount = Object.entries(bill.shares).filter(([id, s]) => id !== bill.payerId && s.paidAt).length
  const payer = memberById(house, bill.payerId)
  const status = todo ? capitalize(dueText(bill.dueDate, house.today)) : iPay ? 'You paid it' : bill.receiptName ? 'Paid, receipt attached' : 'Paid'

  return (
    <button type="button" className={`row ${todo ? '' : 'dn'}`} onClick={() => ui.openBill(bill.id)}>
      <span className="em" aria-hidden="true">
        {bill.emoji}
      </span>
      <span className="tx">
        <b>{bill.name}</b>
        <small className={late ? 'pd' : ''}>{status}</small>
        <small className="pg">
          <PaidSegments bill={bill} />
          {paidCount}/{othersCount(bill)} paid
        </small>
        {long && <small style={{ display: 'block' }}>{iPay ? 'You’re paying for everyone' : `Pay to ${payer?.name ?? 'a former housemate'}`}</small>}
      </span>
      <span className="am">{formatMoney(iPay ? bill.totalCents : shareOf(bill, me))}</span>
      <span className={`ck ${todo ? (late ? 'w' : '') : 'on'}`} aria-hidden="true">
        <Icon name="check" size={14} />
      </span>
    </button>
  )
}

export function ChoreRow({ chore }: { chore: Chore }) {
  const house = useHouse()
  const ui = useAppUI()
  const who = memberById(house, chore.assigneeId)
  const done = !!chore.doneAt
  return (
    <div className={`row ${done ? 'dn' : ''}`}>
      <button type="button" className="row-main" onClick={() => ui.openChore(chore.id)}>
        <Avatar name={who?.name ?? '?'} hue={who?.hue ?? 0} size={48} />
        <span className="tx">
          <b>{chore.title}</b>
          <small>
            {nameFor(house, chore.assigneeId)}, {dayName(chore.dueDate, house.today).toLowerCase()}
            {chore.recurrence !== 'none' && ` · ${chore.recurrence}`}
          </small>
        </span>
      </button>
      <button
        type="button"
        className={`ck ${done ? 'on' : ''}`}
        aria-label={done ? `Mark ${chore.title} not done` : `Mark ${chore.title} done`}
        aria-pressed={done}
        onClick={() => (done ? house.actions.reopenChore(chore.id) : ui.confirmChore(chore.id))}
      >
        <Icon name="check" size={14} />
      </button>
    </div>
  )
}

/** Bills and chores due on one day. */
export function DayItems({ day }: { day: string }) {
  const house = useHouse()
  const bills = house.bills.filter((b) => b.dueDate === day)
  const chores = house.chores.filter((c) => c.dueDate === day)
  if (!bills.length && !chores.length) return <Empty>Nothing due on this day. Enjoy the quiet.</Empty>
  return (
    <>
      {bills.map((b) => (
        <BillRow key={b.id} bill={b} long />
      ))}
      {chores.map((c) => (
        <ChoreRow key={c.id} chore={c} />
      ))}
    </>
  )
}

/** Dots under a day: green/orange for bills I still owe, rings for my open chores. */
export function DayDots({ day }: { day: string }) {
  const house = useHouse()
  const late = daysBetween(house.today, day) < 0
  const bills = house.bills.filter((b) => b.dueDate === day && isTodo(b, house.me.id))
  const chores = house.chores.filter((c) => c.dueDate === day && !c.doneAt && c.assigneeId === house.me.id)
  return (
    <span className="dots" aria-hidden="true">
      {bills.map((b) => (
        <s key={b.id} className={late ? 'w' : ''} />
      ))}
      {chores.map((c) => (
        <s key={c.id} className="c" />
      ))}
    </span>
  )
}
