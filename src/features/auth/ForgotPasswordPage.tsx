import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/authErrors'
import { Field } from '../../components/Field'
import { AuthLayout, BackBar, FormError } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.')
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (error) return setError(friendlyAuthError(error))
    setSent(true)
  }

  return (
    <AuthLayout>
      <BackBar to="/login" />
      <h1>Reset your password</h1>
      <p>Enter your email and we’ll send you a link to choose a new one.</p>
      <form onSubmit={onSubmit} noValidate style={{ display: 'contents' }}>
        <Field label="Email" placeholder="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormError message={error} />
        {sent && (
          <div className="card lk2" style={{ marginTop: 14 }} role="status">
            <b>Check your inbox</b>
            <small style={{ display: 'block', marginTop: 4 }}>
              If {email.trim()} has an account, a reset link is on its way. While we’re testing, emails may not arrive. If
              yours doesn’t, ask the HouseMate team to reset your password.
            </small>
          </div>
        )}
        <div className="grow" />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Sending…' : sent ? 'Send again' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  )
}
