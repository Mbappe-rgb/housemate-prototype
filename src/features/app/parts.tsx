import type { ReactNode } from 'react'
import { StatusTile } from '../../components/Avatar'
import { Icon, type IconName } from '../../components/Icon'
import { statusOf, type Bill, type Chore } from '../../lib/bills'
import { billView } from '../../lib/billView'
import { shortDate } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { hueFor, memberById, nameFor, useHouse } from '../house/house'
import { choreDay, remindedFn, tileLabel, tileStatus } from './billHelpers'
import { useAppUI } from './ui'

/** "Due soon" heading with an optional "See all". */
export function Sec({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="sec">
      <b>{title}</b>
      {action && (
        <button type="button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}

export function Empty({ title, text, icon = 'calendar' }: { title: string; text: string; icon?: IconName }) {
  return (
    <div className="empty2">
      <Icon name={icon} size={30} />
      <b>{title}</b>
      <small>{text}</small>
    </div>
  )
}

export function BillTiles({ bill, size = 'sm' }: { bill: Bill; size?: 'sm' | 'md' }) {
  const house = useHouse()
  const ids = [...house.members.map((m) => m.id).filter((id) => bill.shares[id]), ...Object.keys(bill.shares).filter((id) => !memberById(house, id))]
  return (
    <>
      {ids.map((id) => (
        <StatusTile key={id} name={memberById(house, id)?.name ?? '?'} hue={hueFor(house, id)} status={tileStatus(bill, id)} size={size} label={tileLabel(house, bill, id)} />
      ))}
    </>
  )
}

/** Bill card (Home, Schedule): name, who you pay, due, amount, every housemate's status, one action. */
export function BillCard({ bill }: { bill: Bill }) {
  const house = useHouse()
  const ui = useAppUI()
  const v = billView(bill, house.me.id, house.today, (id) => memberById(house, id)?.name ?? 'a former housemate', remindedFn(house, bill.id))
  const payer = memberById(house, bill.payerId)?.name ?? 'a former housemate'
  const open = () => ui.openBill(bill.id)
  return (
    <article className="bcard" onClick={open}>
      <div className="bh">
        <div className="bt">
          <div className="bti">
            <span className="be" aria-hidden="true">
              {bill.emoji}
            </span>
            <b>{bill.name}</b>
          </div>
          <small>
            {v.iPay ? 'You’re paying' : `Pay to ${payer}`} •{' '}
            <span className={v.cardTone === 'late' ? 'pd' : v.cardTone === 'wait' ? 'cfm' : ''}>{v.cardStatus}</span>
          </small>
        </div>
        <b className="bamt">{formatMoney(v.amountCents)}</b>
      </div>
      <div className="bf">
        <div className="avs3">
          <BillTiles bill={bill} />
        </div>
        {v.cardAction === 'pay' && (
          <button type="button" className="btnb" onClick={(e) => (e.stopPropagation(), open())}>
            Pay this bill
          </button>
        )}
        {v.cardAction === 'confirm' && (
          <button type="button" className="btnb sec" onClick={(e) => (e.stopPropagation(), open())}>
            Confirm bill paid
          </button>
        )}
        {v.cardAction === 'paid' &&
          (statusOf(bill, house.me.id) === 'sent' ? (
            <span className="paidchip wt">
              <Icon name="clock" size={12} />
              Sent
            </span>
          ) : (
            <span className="paidchip">
              <Icon name="check" size={12} />
              Paid
            </span>
          ))}
      </div>
    </article>
  )
}

export function ChoreCard({ chore }: { chore: Chore }) {
  const house = useHouse()
  const ui = useAppUI()
  const done = !!chore.doneAt
  return (
    <article className={`ccard ${done ? 'dn' : ''}`} onClick={() => ui.openChore(chore.id)}>
      <div className="bt">
        <div className="bti">
          <span className="be" aria-hidden="true">
            {chore.emoji}
          </span>
          <b>{chore.title}</b>
        </div>
        <small>
          {nameFor(house, chore.assigneeId)} • {done ? `Done ${shortDate(chore.dueDate)}` : choreDay(chore.dueDate, house.today)}
          {chore.recurrence !== 'none' && ` • ${chore.recurrence}`}
        </small>
      </div>
      <button
        type="button"
        className={`rb ${done ? 'on' : ''}`}
        aria-label={done ? `Mark ${chore.title} not done` : `Mark ${chore.title} done`}
        aria-pressed={done}
        onClick={(e) => {
          e.stopPropagation()
          if (done) house.actions.reopenChore(chore.id)
          else ui.confirmChore(chore.id)
        }}
      >
        {done && <Icon name="check" size={14} />}
      </button>
    </article>
  )
}

export function Section({ children }: { children: ReactNode }) {
  return <section>{children}</section>
}
