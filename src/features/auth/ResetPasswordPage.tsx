import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/authErrors'
import { Field } from '../../components/Field'
import { useAuth } from '../../app/auth'
import { Splash } from '../../app/Gate'
import { AuthLayout, FormError } from './AuthLayout'

/** Opened from the reset email. Supabase signs them in from the link, then they pick a new password. */
export function ResetPasswordPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (auth.loading) return <Splash />

  if (!auth.session) {
    return (
      <AuthLayout title="Link expired" subtitle="This reset link is invalid or has expired. Request a new one.">
        <Link to="/forgot-password" className="btn">
          Send a new link
        </Link>
      </AuthLayout>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Please choose a password with at least 8 characters.')
    if (password !== confirm) return setError('The two passwords don’t match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(friendlyAuthError(error))
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout title="Choose a new password">
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Field label="New password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Field label="Repeat new password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <FormError message={error} />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </AuthLayout>
  )
}
