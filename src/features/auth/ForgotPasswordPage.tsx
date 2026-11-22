import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/authErrors'
import { Field } from '../../components/Field'
import { AuthPage, FormError, Spacer } from './AuthLayout'

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
    <AuthPage title="Reset your password" subtitle="We’ll email you a link to choose a new one." back="/login">
      <form onSubmit={onSubmit} noValidate style={{ display: 'contents' }}>
        <Field label="Email" placeholder="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormError message={error} />
        {sent && (
          <div className="card2" style={{ marginTop: 14 }} role="status">
            <b>Check your inbox</b>
            <small className="hint" style={{ marginTop: 4 }}>
              If {email.trim()} has an account, a reset link is on its way. While we’re testing, emails may not arrive. If yours doesn’t, ask the
              HouseMate team to reset your password.
            </small>
          </div>
        )}
        <Spacer />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Sending…' : sent ? 'Send again' : 'Send reset link'}
        </button>
      </form>
    </AuthPage>
  )
}
