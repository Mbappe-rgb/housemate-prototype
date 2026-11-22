import { useEffect, useState } from 'react'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { Sheet } from '../../../components/Sheet'
import { relativeTime } from '../../../lib/dates'
import { memberById, useHouse, type JoinRequest } from '../../house/house'
import { useAppUI } from '../ui'

function RequestRow({ request }: { request: JoinRequest }) {
  const house = useHouse()
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null)
  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'decline')
    await house.actions.decideRequest(request.id, approve)
    setBusy(null)
  }
  return (
    <div className="card2">
      <div className="mr2" style={{ padding: 4 }}>
        <Avatar name={request.name} hue={request.hue} size={40} />
        <span className="mn">
          <b>{request.name} wants to join</b>
          {request.email && <small>{request.email}</small>}
        </span>
      </div>
      <div className="two" style={{ marginTop: 10 }}>
        <button type="button" className="btn sec" disabled={!!busy} onClick={() => void decide(false)}>
          {busy === 'decline' ? 'Declining…' : 'Decline'}
        </button>
        <button type="button" className="btn" disabled={!!busy} onClick={() => void decide(true)}>
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
      </div>
    </div>
  )
}

/** The bell: join requests (admin) and reminders housemates sent me. */
export function NotificationsSheet({ onClose }: { onClose: () => void }) {
  const house = useHouse()
  const ui = useAppUI()
  const { reminders, joinRequests } = house
  const markRead = house.actions.markRemindersRead
  const hasUnread = reminders.some((r) => !r.read)

  // Opening the bell counts as reading the reminders
  useEffect(() => {
    if (hasUnread) markRead()
  }, [hasUnread, markRead])

  return (
    <Sheet label="Notifications" onClose={onClose}>
      <div className="top">
        <div>
          <b className="lg">Notifications</b>
          <small>{house.household.name}</small>
        </div>
      </div>
      {!joinRequests.length && !reminders.length && (
        <div className="empty2">
          <Icon name="bell" size={30} />
          <b>You’re all caught up</b>
          <small>Requests to join and reminders show up here.</small>
        </div>
      )}
      {joinRequests.length > 0 && (
        <>
          <h4>Requests to join</h4>
          <small className="hint" style={{ margin: '0 2px 10px' }}>
            Only approve people you live with.
          </small>
          {joinRequests.map((r) => (
            <RequestRow key={r.id} request={r} />
          ))}
        </>
      )}
      {reminders.length > 0 && (
        <>
          <h4>Reminders</h4>
          <div className="card2 lst">
            {reminders.map((r) => {
              const from = memberById(house, r.fromId ?? '')
              const bill = r.billId ? house.bills.find((b) => b.id === r.billId) : undefined
              return (
                <button
                  key={r.id}
                  type="button"
                  className="mr2"
                  onClick={() => {
                    if (bill) ui.openBill(bill.id)
                  }}
                >
                  <Avatar name={from?.name ?? '?'} hue={from?.hue ?? 0} size={40} />
                  <span className="mn">
                    <b>
                      {from?.name ?? 'A housemate'} reminded you about {bill?.name ?? 'a bill'}
                    </b>
                    <small>{relativeTime(r.createdAt)}</small>
                  </span>
                  {bill && <Icon name="right" size={16} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </Sheet>
  )
}
