import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { useAuth } from '../../app/auth'
import { supabase } from '../../lib/supabase'
import { AuthPage, FormError, Spacer } from '../auth/AuthLayout'
import { markPayStepDone } from './payStep'

const EMAIL = /^\S+@\S+\.\S+$/
const PHONE = /^[+\d][\d\s().-]{6,}$/

/** After sign-up (v5 prototype): the e-transfer email or phone housemates send money to. */
export function PayDetailsPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [value, setValue] = useState(auth.session?.user.email ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next = async () => {
    markPayStepDone()
    await auth.refresh()
    navigate('/setup/household', { replace: true })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const v = value.trim()
    if (!v) return next()
    if (!EMAIL.test(v) && !PHONE.test(v)) return setError('Enter an email address or a phone number.')
    if (!auth.session) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ etransfer: v }).eq('id', auth.session.user.id)
    setBusy(false)
    if (error) return setError('We couldn’t save that. Please try again.')
    await next()
  }

  return (
    <AuthPage title="How do housemates pay you?" subtitle="They’ll see this when they settle a bill. You can change it later in your profile.">
      <form onSubmit={onSubmit} noValidate style={{ display: 'contents' }}>
        <label className="lbl3" htmlFor="etransfer">
          Interac e-Transfer email or phone
        </label>
        <input id="etransfer" className="fld" type="text" inputMode="email" autoComplete="email" placeholder="name@email.com" value={value} onChange={(e) => setValue(e.target.value)} />
        <div className="note3">
          <Icon name="lock" size={16} />
          <span>Only people in your household can see these details.</span>
        </div>
        <FormError message={error} />
        <Spacer />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </form>
      <button type="button" className="lk" onClick={() => void next()}>
        Skip for now
      </button>
    </AuthPage>
  )
}
