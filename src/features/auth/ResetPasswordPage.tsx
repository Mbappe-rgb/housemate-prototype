import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/authErrors'
import { PasswordField } from '../../components/Field'
import { LoadingScreen } from '../../components/LoadingScreen'
import { useAuth } from '../../app/auth'
import { AuthLayout, FormError, Hero } from './AuthLayout'

/** Opened from the reset email. Supabase signs them in from the link, then they pick a new password. */
export function ResetPasswordPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (auth.loading) return <LoadingScreen />

  if (!auth.session) {
    return (
      <AuthLayout>
        <Hero emoji="⏰" title="Link expired" text="This reset link is invalid or has expired. Request a new one." />
        <Link to="/forgot-password" className="btn">
          Send a new link
        </Link>
      </AuthLayout>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    if (password !== confirm) return setError('The two passwords don’t match.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(friendlyAuthError(error))
    navigate('/', { replace: true })
  }

  return (
    <AuthLayout>
      <div style={{ height: 64 }} />
      <h1>Choose a new password</h1>
      <p>Pick something you haven’t used here before.</p>
      <form onSubmit={onSubmit} noValidate style={{ display: 'contents' }}>
        <PasswordField label="New password" placeholder="New password, 8+ characters" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <PasswordField label="Repeat new password" placeholder="Repeat new password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <FormError message={error} />
        <div className="grow" />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </AuthLayout>
  )
}
