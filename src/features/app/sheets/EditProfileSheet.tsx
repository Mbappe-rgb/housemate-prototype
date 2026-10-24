import { useState } from 'react'
import { Sheet } from '../../../components/Sheet'
import { useHouse } from '../../house/house'

export function EditProfileSheet({ onClose }: { onClose: () => void }) {
  const house = useHouse()
  const me = house.me
  const [displayName, setDisplayName] = useState(me.name)
  const [etransferEmail, setEtransferEmail] = useState(me.etransferEmail ?? '')
  const [phone, setPhone] = useState(me.phone ?? '')
  const [bankName, setBankName] = useState(me.bankName ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const emailOk = !etransferEmail.trim() || /^\S+@\S+\.\S+$/.test(etransferEmail.trim())
  const valid = displayName.trim().length > 0 && emailOk

  return (
    <Sheet label="Edit profile" onClose={onClose}>
      <div className="top">
        <div>
          <b className="lg">Edit profile</b>
          <small>Housemates see these when they pay you</small>
        </div>
      </div>
      <h4>Your name</h4>
      <input className="fld" aria-label="Your name" autoComplete="name" maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      <h4>E-transfer email</h4>
      <input className="fld" type="email" inputMode="email" aria-label="E-transfer email" placeholder="Optional" maxLength={254} value={etransferEmail} onChange={(e) => setEtransferEmail(e.target.value)} />
      {!emailOk && <small className="err">Check that email address.</small>}
      <h4>Phone</h4>
      <input className="fld" type="tel" aria-label="Phone" placeholder="Optional" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
      <h4>Bank</h4>
      <input className="fld" aria-label="Bank" placeholder="Optional" maxLength={60} value={bankName} onChange={(e) => setBankName(e.target.value)} />
      <small className="hint">Payment details are optional and only shown to your housemates.</small>
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
          const err = await house.actions.saveProfile({ displayName, etransferEmail, phone, bankName })
          setBusy(false)
          if (err) setError(err)
          else onClose()
        }}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="lk" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  )
}
