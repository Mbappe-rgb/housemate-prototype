import { useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Icon, type IconName } from '../../components/Icon'
import { Dialog } from '../../components/Sheet'
import { pastDue } from '../../lib/bills'
import { useHouse } from '../house/house'
import { AppUIContext, type AppUI } from './ui'
import { BillSheet } from './sheets/BillSheet'
import { AddBillSheet } from './sheets/AddBillSheet'
import { AddChoreSheet } from './sheets/AddChoreSheet'
import { ChoreSheet } from './sheets/ChoreSheet'
import { EditProfileSheet } from './sheets/EditProfileSheet'
import { MemberSheet } from './sheets/MemberSheet'
import { NotificationsSheet } from './sheets/NotificationsSheet'
import { ReportsSheet } from './sheets/ReportsSheet'
import { LeaveDialog, RemoveMemberDialog } from './LeaveDialogs'

const TABS: [string, IconName, IconName, string][] = [
  ['.', 'home', 'homeFill', 'Home'],
  ['schedule', 'schedule', 'scheduleFill', 'Schedule'],
  ['household', 'household', 'householdFill', 'Household'],
  ['profile', 'profile', 'profileFill', 'Profile'],
]

type Open =
  | { kind: 'bill'; id: string }
  | { kind: 'addBill' }
  | { kind: 'addChore' }
  | { kind: 'chore'; id: string }
  | { kind: 'choreDetail'; id: string }
  | { kind: 'profile' }
  | { kind: 'member'; id: string }
  | { kind: 'reports' }
  | { kind: 'notifications' }
  | { kind: 'leave' }
  | { kind: 'remove'; id: string }
  | null

/** Quick add: blurred backdrop, "Add a chore" and "Add a bill" spring up above the +. */
function QuickAdd({ onPick, onClose }: { onPick: (what: 'bill' | 'chore') => void; onClose: () => void }) {
  const [closing, setClosing] = useState(false)
  const close = (then?: () => void) => {
    if (closing) return
    setClosing(true)
    window.setTimeout(() => {
      onClose()
      then?.()
    }, 280)
  }
  return (
    <div className={`qm ${closing ? 'out' : ''}`} role="menu" aria-label="Add" onClick={() => close()}>
      <div className="qmin">
        <div className="qml">
          <button type="button" className="qmi" style={{ '--i': 1, '--c': '#e8892f', '--cb': '#fdebd6' } as React.CSSProperties} role="menuitem" onClick={(e) => (e.stopPropagation(), close(() => onPick('chore')))}>
            <span>Add a chore</span>
            <i>
              <Icon name="chore" size={24} />
            </i>
          </button>
          <button type="button" className="qmi" style={{ '--i': 0, '--c': '#4a6cf0', '--cb': '#e0e7fe' } as React.CSSProperties} role="menuitem" onClick={(e) => (e.stopPropagation(), close(() => onPick('bill')))}>
            <span>Add a bill</span>
            <i>
              <Icon name="bill" size={24} />
            </i>
          </button>
        </div>
        <button type="button" className="fab2 qmf" aria-label="Close menu" onClick={(e) => (e.stopPropagation(), close())} autoFocus>
          <Icon name="add" size={26} />
        </button>
      </div>
    </div>
  )
}

/** Bottom nav, the + button, and every sheet and dialog in the app. Screens render in <Outlet />. */
export function AppShell() {
  const house = useHouse()
  const [open, setOpen] = useState<Open>(null)
  const [menu, setMenu] = useState(false)
  const close = () => setOpen(null)

  const ui = useMemo<AppUI>(
    () => ({
      openBill: (id) => setOpen({ kind: 'bill', id }),
      openAddBill: () => setOpen({ kind: 'addBill' }),
      openAddChore: () => setOpen({ kind: 'addChore' }),
      confirmChore: (id) => setOpen({ kind: 'chore', id }),
      openChore: (id) => setOpen({ kind: 'choreDetail', id }),
      openNotifications: () => setOpen({ kind: 'notifications' }),
      openEditProfile: () => setOpen({ kind: 'profile' }),
      openMember: (id) => setOpen({ kind: 'member', id }),
      openReports: () => setOpen({ kind: 'reports' }),
      confirmLeave: () => setOpen({ kind: 'leave' }),
      confirmRemove: (id) => setOpen({ kind: 'remove', id }),
    }),
    [],
  )

  const chore = open?.kind === 'chore' ? house.chores.find((c) => c.id === open.id) : undefined
  const overdue = pastDue(house.bills, house.me.id, house.today).length > 0

  return (
    <AppUIContext.Provider value={ui}>
      <Outlet />

      <div className="nw2">
        <nav className="nav2" aria-label="Main">
          {TABS.map(([to, icon, fill, label]) => (
            <NavLink key={label} to={to} end={to === '.'} className={({ isActive }) => (isActive ? 'active' : '')} aria-label={label}>
              {({ isActive }) => (
                <>
                  <Icon name={isActive ? fill : icon} size={22} />
                  {isActive && <span>{label}</span>}
                  {!isActive && to === 'schedule' && overdue && <i className="dot" aria-hidden="true" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="fab2" aria-label="Add a bill or chore" aria-haspopup="menu" onClick={() => setMenu(true)}>
          <Icon name="add" size={26} />
        </button>
      </div>

      {menu && <QuickAdd onClose={() => setMenu(false)} onPick={(what) => setOpen({ kind: what === 'bill' ? 'addBill' : 'addChore' })} />}

      {open?.kind === 'bill' && <BillSheet billId={open.id} onClose={close} />}
      {open?.kind === 'addBill' && <AddBillSheet onClose={close} />}
      {open?.kind === 'addChore' && <AddChoreSheet onClose={close} />}
      {open?.kind === 'choreDetail' && <ChoreSheet choreId={open.id} onClose={close} />}
      {open?.kind === 'profile' && <EditProfileSheet onClose={close} />}
      {open?.kind === 'member' && <MemberSheet memberId={open.id} onClose={close} />}
      {open?.kind === 'reports' && <ReportsSheet onClose={close} />}
      {open?.kind === 'notifications' && <NotificationsSheet onClose={close} />}
      {open?.kind === 'leave' && <LeaveDialog onClose={close} />}
      {open?.kind === 'remove' && <RemoveMemberDialog memberId={open.id} onClose={close} />}
      {chore && (
        <Dialog label="Confirm chore done" onClose={close}>
          <div className="bg" aria-hidden="true">
            {chore.emoji}
          </div>
          <b>Is it really done?</b>
          <p>Only tick “{chore.title}” once it’s finished. Your housemates will see it right away.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              house.actions.completeChore(chore.id)
              close()
            }}
          >
            Yes, all done 🎉
          </button>
          <button type="button" className="lk" onClick={close}>
            Not yet
          </button>
        </Dialog>
      )}
    </AppUIContext.Provider>
  )
}
