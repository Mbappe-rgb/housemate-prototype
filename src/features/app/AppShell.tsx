import { useMemo, useState } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Icon, type IconName } from '../../components/Icon'
import { Dialog, Sheet } from '../../components/Sheet'
import { useHouse } from '../house/house'
import { AppUIContext, type AppUI } from './ui'
import { BillSheet } from './sheets/BillSheet'
import { AddBillSheet } from './sheets/AddBillSheet'
import { AddChoreSheet } from './sheets/AddChoreSheet'
import { EditProfileSheet } from './sheets/EditProfileSheet'
import { ChoreSheet } from './sheets/ChoreSheet'
import { LeaveDialog, RemoveMemberDialog } from './LeaveDialogs'
import { JoinRequestList } from './JoinRequests'

const NAV: [string, IconName, string][] = [
  ['.', 'home', 'Home'],
  ['bills', 'bills', 'Bills'],
  ['calendar', 'calendar', 'Calendar'],
  ['chores', 'chores', 'Chores'],
  ['profile', 'profile', 'Profile'],
]

type Open =
  | { kind: 'bill'; id: string }
  | { kind: 'addBill' }
  | { kind: 'addChore' }
  | { kind: 'menu' }
  | { kind: 'chore'; id: string }
  | { kind: 'choreDetail'; id: string }
  | { kind: 'profile' }
  | { kind: 'leave' }
  | { kind: 'remove'; id: string }
  | { kind: 'notifications' }
  | null

/** Bottom nav, + button, and every sheet/dialog in the app. Screens render in <Outlet />. */
export function AppShell() {
  const house = useHouse()
  const [open, setOpen] = useState<Open>(null)
  const close = () => setOpen(null)

  const ui = useMemo<AppUI>(
    () => ({
      openBill: (id) => setOpen({ kind: 'bill', id }),
      openAddBill: () => setOpen({ kind: 'addBill' }),
      openAddChore: () => setOpen({ kind: 'addChore' }),
      openAddMenu: () => setOpen({ kind: 'menu' }),
      confirmChore: (id) => setOpen({ kind: 'chore', id }),
      openChore: (id) => setOpen({ kind: 'choreDetail', id }),
      openNotifications: () => setOpen({ kind: 'notifications' }),
      openEditProfile: () => setOpen({ kind: 'profile' }),
      confirmLeave: () => setOpen({ kind: 'leave' }),
      confirmRemove: (id) => setOpen({ kind: 'remove', id }),
    }),
    [],
  )

  const chore = open?.kind === 'chore' ? house.chores.find((c) => c.id === open.id) : undefined

  return (
    <AppUIContext.Provider value={ui}>
      <main>
        <Outlet />
      </main>

      <div className="nw">
        <nav className="nav" aria-label="Main">
          {NAV.map(([to, icon, label]) => (
            <NavLink key={label} to={to} end={to === '.'} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={icon} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="plus" aria-label="Add a bill or chore" onClick={ui.openAddMenu}>
          <Icon name="plus" size={26} />
        </button>
      </div>

      {open?.kind === 'menu' && (
        <Sheet label="Add" onClose={close}>
          <div className="menu" style={{ margin: 0, padding: 0 }}>
            <button type="button" onClick={() => setOpen({ kind: 'addBill' })}>
              🧾 Add a bill
            </button>
            <button type="button" onClick={() => setOpen({ kind: 'addChore' })}>
              🧹 Add a chore
            </button>
            <button type="button" onClick={close}>
              Cancel
            </button>
          </div>
        </Sheet>
      )}
      {open?.kind === 'bill' && <BillSheet billId={open.id} onClose={close} />}
      {open?.kind === 'addBill' && <AddBillSheet onClose={close} />}
      {open?.kind === 'addChore' && <AddChoreSheet onClose={close} />}
      {open?.kind === 'profile' && <EditProfileSheet onClose={close} />}
      {open?.kind === 'choreDetail' && <ChoreSheet choreId={open.id} onClose={close} />}
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
      {open?.kind === 'leave' && <LeaveDialog onClose={close} />}
      {open?.kind === 'remove' && <RemoveMemberDialog memberId={open.id} onClose={close} />}
      {open?.kind === 'notifications' && (
        <Sheet label="Notifications" onClose={close}>
          <div className="top">
            <div>
              <b className="lg">Notifications</b>
              <small>{house.household.name}</small>
            </div>
          </div>
          {house.joinRequests.length ? (
            <>
              <h4>Requests to join</h4>
              <JoinRequestList />
            </>
          ) : (
            <p className="notif-empty muted">You’re all caught up.</p>
          )}
          <button type="button" className="lk" onClick={close}>
            Close
          </button>
        </Sheet>
      )}
    </AppUIContext.Provider>
  )
}
