import { useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { Dialog } from '../../components/Sheet'
import { useHouse } from '../house/house'

/**
 * Leave household. The admin picks who becomes admin when others remain;
 * the last person leaving closes the household.
 */
export function LeaveDialog({ onClose }: { onClose: () => void }) {
  const house = useHouse()
  const others = house.members.filter((m) => m.id !== house.me.id)
  const needsNewAdmin = house.isAdmin && others.length > 0
  const [newAdmin, setNewAdmin] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const leave = async () => {
    setBusy(true)
    const err = await house.actions.leaveHousehold(newAdmin ?? undefined)
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <Dialog label="Leave household" onClose={onClose} alert>
      <div className="bg" aria-hidden="true">
        👋
      </div>
      <b>Leave {house.household.name}?</b>
      {others.length === 0 ? (
        <p>You’re the only one here, so leaving closes the household and deletes its bills and chores.</p>
      ) : needsNewAdmin ? (
        <p>You’re the admin. Choose who approves new housemates after you leave.</p>
      ) : (
        <p>You’ll lose access to its bills and chores. You’d need a new invite to come back.</p>
      )}
      {needsNewAdmin && (
        <div role="radiogroup" aria-label="New admin" style={{ textAlign: 'left', marginBottom: 12 }}>
          {others.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={newAdmin === m.id} className="opt" onClick={() => setNewAdmin(m.id)}>
              <Avatar name={m.name} hue={m.hue} size={30} />
              <span>{m.name}</span>
              <i className="rd" />
            </button>
          ))}
        </div>
      )}
      {error && (
        <small className="err" role="alert" style={{ marginBottom: 10 }}>
          {error}
        </small>
      )}
      <button type="button" className="btn danger" disabled={busy || (needsNewAdmin && !newAdmin)} onClick={() => void leave()}>
        {busy ? 'Leaving…' : others.length === 0 ? 'Close household' : 'Leave household'}
      </button>
      <button type="button" className="lk" onClick={onClose}>
        Stay
      </button>
    </Dialog>
  )
}

/** Admin removes a housemate. */
export function RemoveMemberDialog({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const house = useHouse()
  const member = house.members.find((m) => m.id === memberId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!member) return null
  return (
    <Dialog label={`Remove ${member.name}`} onClose={onClose} alert>
      <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8 }}>
        <Avatar name={member.name} hue={member.hue} size={58} />
      </div>
      <b>Remove {member.name}?</b>
      <p>They’ll lose access to {house.household.name}. They can ask to join again with a new invite.</p>
      {error && (
        <small className="err" role="alert" style={{ marginBottom: 10 }}>
          {error}
        </small>
      )}
      <button
        type="button"
        className="btn danger"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          const err = await house.actions.removeMember(member.id)
          setBusy(false)
          if (err) setError(err)
          else onClose()
        }}
      >
        {busy ? 'Removing…' : `Remove ${member.name}`}
      </button>
      <button type="button" className="lk" onClick={onClose}>
        Cancel
      </button>
    </Dialog>
  )
}
