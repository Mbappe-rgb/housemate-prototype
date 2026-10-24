import { useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { useHouse, type JoinRequest } from '../house/house'

function RequestRow({ request }: { request: JoinRequest }) {
  const house = useHouse()
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null)
  const decide = async (approve: boolean) => {
    setBusy(approve ? 'approve' : 'decline')
    await house.actions.decideRequest(request.id, approve)
    setBusy(null)
  }
  return (
    <div className="jr">
      <div className="mr">
        <Avatar name={request.name} hue={request.hue} size={40} />
        <span>
          {request.name} wants to join
          {request.email && <small style={{ display: 'block', fontWeight: 400, overflowWrap: 'anywhere' }}>{request.email}</small>}
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

/** Pending requests with Approve / Decline. Shown to the admin only. */
export function JoinRequestList() {
  const house = useHouse()
  return (
    <>
      {house.joinRequests.map((r) => (
        <RequestRow key={r.id} request={r} />
      ))}
    </>
  )
}

/** Dashboard card for the admin when someone is waiting. */
export function JoinRequestsCard() {
  const house = useHouse()
  const n = house.joinRequests.length
  if (!house.isAdmin || n === 0) return null
  return (
    <section className="card jrc" aria-label="Join requests">
      <b>
        {n === 1 ? '1 person wants' : `${n} people want`} to join {house.household.name}
      </b>
      <small style={{ display: 'block', margin: '2px 0 4px' }}>Only approve people you live with.</small>
      <JoinRequestList />
    </section>
  )
}
