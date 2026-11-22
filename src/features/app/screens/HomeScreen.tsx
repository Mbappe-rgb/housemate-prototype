import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '../../../components/Icon'
import { amountOwed, amountOwedToMe, isTodo, sortByDue, toConfirm } from '../../../lib/bills'
import { addDays } from '../../../lib/dates'
import { formatMoneyExact } from '../../../lib/money'
import { memberById, useHouse } from '../../house/house'
import { BillCard, ChoreCard, Empty, Sec } from '../parts'
import { useAppUI } from '../ui'
import { HeroGlow } from '../HeroGlow'

/**
 * The sheet over the hero rises to the top first, then its content scrolls (v5 "sheet detents").
 * p goes 0 (resting at 35%) to 1 (risen to 10%); released halfway, it snaps to the nearest end.
 */
function useRisingSheet(dash: React.RefObject<HTMLDivElement | null>, sheet: React.RefObject<HTMLDivElement | null>) {
  const p = useRef(0)
  useEffect(() => {
    const d = dash.current
    const s = sheet.current
    if (!d || !s) return
    const set = (v: number) => {
      p.current = v
      d.style.setProperty('--p', String(v))
    }
    let snapTimer = 0
    const snap = () => {
      d.classList.add('snap')
      set(p.current > 0.5 ? 1 : 0)
      window.clearTimeout(snapTimer)
      snapTimer = window.setTimeout(() => d.classList.remove('snap'), 420)
    }
    const step = (dy: number, e: Event) => {
      const range = d.clientHeight * 0.25
      let v = p.current
      let used = false
      if (dy > 0 && v < 1) {
        v = Math.min(1, v + dy / range)
        used = true
      } else if (dy < 0 && v > 0 && s.scrollTop <= 0) {
        v = Math.max(0, v + dy / range)
        used = true
      }
      if (used) {
        set(v)
        if (e.cancelable) e.preventDefault()
      }
    }
    let lastY: number | null = null
    let wheelTimer = 0
    const onWheel = (e: WheelEvent) => {
      step(e.deltaY, e)
      window.clearTimeout(wheelTimer)
      wheelTimer = window.setTimeout(snap, 140)
    }
    const onTouchStart = (e: TouchEvent) => {
      lastY = e.touches[0].clientY
    }
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0].clientY
      if (lastY !== null) step(lastY - y, e)
      lastY = y
    }
    const onTouchEnd = () => {
      lastY = null
      snap()
    }
    d.addEventListener('wheel', onWheel, { passive: false })
    d.addEventListener('touchstart', onTouchStart, { passive: true })
    d.addEventListener('touchmove', onTouchMove, { passive: false })
    d.addEventListener('touchend', onTouchEnd)
    return () => {
      d.removeEventListener('wheel', onWheel)
      d.removeEventListener('touchstart', onTouchStart)
      d.removeEventListener('touchmove', onTouchMove)
      d.removeEventListener('touchend', onTouchEnd)
      window.clearTimeout(snapTimer)
      window.clearTimeout(wheelTimer)
    }
  }, [dash, sheet])

  return () => {
    const d = dash.current
    if (!d) return
    p.current = p.current > 0.5 ? 0 : 1
    d.classList.add('snap')
    d.style.setProperty('--p', String(p.current))
    window.setTimeout(() => d.classList.remove('snap'), 420)
  }
}

export function HomeScreen() {
  const house = useHouse()
  const ui = useAppUI()
  const navigate = useNavigate()
  const dash = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const toggle = useRisingSheet(dash, sheet)
  const me = house.me.id
  const weekEnd = addDays(house.today, 6)

  const myBillsThisWeek = house.bills.filter((b) => isTodo(b, me) && b.dueDate <= weekEnd).length
  const myChoresThisWeek = house.chores.filter((c) => c.assigneeId === me && !c.doneAt && c.dueDate <= weekEnd).length
  // Bills I owe, plus bills where I'm the payer with money to confirm
  const dueSoon = sortByDue(house.bills.filter((b) => isTodo(b, me) || (b.payerId === me && toConfirm(b).length))).slice(0, 4)
  const myChores = house.chores.filter((c) => c.assigneeId === me && !c.doneAt && c.dueDate <= addDays(house.today, 1)).slice(0, 2)

  const unreadReminders = house.reminders.filter((r) => !r.read)
  const alerts = house.joinRequests.length + unreadReminders.length
  const firstReminder = unreadReminders[0]
  const reminderBill = firstReminder?.billId ? house.bills.find((b) => b.id === firstReminder.billId) : undefined

  const goSchedule = (range: string, type: string) => navigate(`schedule?range=${range}&type=${type}`)

  return (
    <div className="dash" ref={dash}>
      <div className="hero2">
        <HeroGlow />
        <div className="hrow">
          <h1 className="hey">
            <span>Hey,</span> {house.me.name}
          </h1>
          <button type="button" className="cbtn" onClick={ui.openNotifications} aria-label={alerts ? `Notifications, ${alerts} new` : 'Notifications'}>
            <Icon name="bell" size={22} />
            {alerts > 0 && <i className="dot" aria-hidden="true" />}
          </button>
        </div>
        <div className="due">
          <small>Due this week</small>
          <div>
            <Icon name="calendar" size={24} />
            <b>
              {myBillsThisWeek} bill{myBillsThisWeek === 1 ? '' : 's'}
            </b>
          </div>
          <div>
            <Icon name="chore" size={24} />
            <b>
              {myChoresThisWeek} chore{myChoresThisWeek === 1 ? '' : 's'}
            </b>
          </div>
        </div>
      </div>

      <div className="sh2 white" ref={sheet}>
        <button type="button" className="grab" onClick={toggle} aria-label="Expand or collapse" />
        <div className="bal">
          <button type="button" onClick={() => goSchedule('month', 'bills')}>
            <span>
              <small>You owe</small>
              <i className="bi2 out" aria-hidden="true">
                <Icon name="minus" size={16} />
              </i>
            </span>
            <b>{formatMoneyExact(amountOwed(house.bills, me))}</b>
          </button>
          <button type="button" onClick={() => goSchedule('month', 'bills')}>
            <span>
              <small>You are owed</small>
              <i className="bi2" aria-hidden="true">
                <Icon name="plus" size={16} />
              </i>
            </span>
            <b>{formatMoneyExact(amountOwedToMe(house.bills, me))}</b>
          </button>
        </div>

        {house.joinRequests.length > 0 && (
          <button type="button" className="notice" onClick={ui.openNotifications}>
            <Icon name="household" size={20} />
            <span>
              {house.joinRequests.length === 1 ? `${house.joinRequests[0].name} wants` : `${house.joinRequests.length} people want`} to join
            </span>
            <Icon name="right" size={18} />
          </button>
        )}
        {firstReminder && (
          <button type="button" className="notice" onClick={ui.openNotifications}>
            <Icon name="bell" size={20} />
            <span>
              {memberById(house, firstReminder.fromId ?? '')?.name ?? 'A housemate'} reminded you about {reminderBill?.name ?? 'a bill'}
            </span>
            <Icon name="right" size={18} />
          </button>
        )}

        <Sec title="Due soon" action="See all" onAction={() => goSchedule('month', 'all')} />
        {dueSoon.length ? (
          dueSoon.map((b) => <BillCard key={b.id} bill={b} />)
        ) : house.bills.length ? (
          <Empty title="Nothing to pay" text="You’re all caught up." icon="check" />
        ) : (
          <>
            <Empty title="No bills yet" text="Add rent, internet or hydro and HouseMate splits it for you." icon="bill" />
            <button type="button" className="btn" onClick={ui.openAddBill}>
              Add your first bill
            </button>
          </>
        )}

        {myChores.length > 0 && (
          <>
            <Sec title="Your chores" action="See all" onAction={() => goSchedule('week', 'chores')} />
            {myChores.map((c) => (
              <ChoreCard key={c.id} chore={c} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
