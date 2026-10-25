import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Field } from '../../components/Field'
import { AuthLayout, BackBar, FormError } from '../auth/AuthLayout'
import { formatCode, parseInviteInput } from '../invites/inviteFormat'

/** Paste an invite link or type the code. */
export function JoinCodePage() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const token = parseInviteInput(value)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) return setError('That doesn’t look like an invite code. It has 12 letters and numbers, like K7QM-2XPD-9TCF.')
    navigate(`/join/${formatCode(token)}`)
  }

  return (
    <AuthLayout>
      <BackBar to="/setup/household" />
      <h1>Join a household</h1>
      <p>Paste the invite link you were sent, or type the code.</p>
      <form onSubmit={onSubmit} noValidate style={{ display: 'contents' }}>
        <Field
          label="Invite link or code"
          placeholder="Invite link or code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
        />
        <FormError message={error} />
        <div className="card lk2" style={{ marginTop: 14 }}>
          <b>Got a QR code?</b>
          <small style={{ display: 'block', marginTop: 4 }}>Point your phone’s camera at it and tap the link that appears.</small>
        </div>
        <div className="grow" />
        <button type="submit" className="btn" disabled={value.trim().length < 4}>
          Continue
        </button>
      </form>
    </AuthLayout>
  )
}
