import { useState } from 'react'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { Sheet } from '../../../components/Sheet'
import { useHouse } from '../../house/house'

const EMAIL = /^\S+@\S+\.\S+$/
const PHONE = /^[+\d][\d\s().-]{6,}$/

/** Edit profile (v5): Name, Display name, and one Interac e-Transfer detail. Photos come later. */
export function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const house = useHouse()
  const me = house.me
  const [fullName, setFullName] = useState(me.fullName ?? '')
  const [displayName, setDisplayName] = useState(me.name)
  const [etransfer, setEtransfer] = useState(me.etransfer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const et = etransfer.trim()
  const etOk = !et || EMAIL.test(et) || PHONE.test(et)
  const valid = displayName.trim().length > 0 && etOk

  return (
    <Sheet label="Edit profile" onClose={onClose}>
      <div className="top hth">
        <button type="button" className="ib" onClick={onClose} aria-label="Back">
          <Icon name="left" size={20} />
        </button>
        <div className="htt">
          <b>Edit profile</b>
        </div>
        <span className="hsp" />
      </div>
      <div className="pph">
        <Avatar name={displayName || me.name} hue={me.hue} size={96} />
      </div>
      <label className="pfl">
        <small>Name</small>
        <input type="text" autoComplete="name" maxLength={80} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name (optional)" />
      </label>
      <label className="pfl">
        <small>Display name</small>
        <input type="text" autoComplete="given-name" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <label className="pfl">
        <small>Interac e-Transfer details</small>
        <input type="text" inputMode="email" autoComplete="email" maxLength={254} value={etransfer} onChange={(e) => setEtransfer(e.target.value)} placeholder="Email or phone number" />
      </label>
      <small className="hint" style={{ margin: '2px 4px 0' }}>
        An email or phone number. Housemates see this when they pay you.
      </small>
      {!etOk && <small className="err">Enter an email address or a phone number.</small>}
      {!displayName.trim() && <small className="err">Add a display name.</small>}
      {error && (
        <small className="err" role="alert">
          {error}
        </small>
      )}
      <button
        type="button"
        className="btn"
        style={{ marginTop: 18 }}
        disabled={!valid || busy}
        onClick={async () => {
          setBusy(true)
          const err = await house.actions.saveProfile({ fullName, displayName, etransfer })
          setBusy(false)
          if (err) setError(err)
          else onClose()
        }}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
    </Sheet>
  )
}
