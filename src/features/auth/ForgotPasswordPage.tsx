import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/authErrors'
import { Field } from '../../components/Field'
import { AuthLayout, FormError } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (error) return setError(friendlyAuthError(error))
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="If that email has an account, a reset link is on its way. While we're testing, emails may not arrive. If yours doesn't, ask the HouseMate team to reset your password."
      >
        <Link to="/login" className="btn sec">
          Back to log in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Field label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormError message={error} />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <p className="foot">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  )
}
