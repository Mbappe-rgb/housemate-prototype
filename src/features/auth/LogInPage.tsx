import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/authErrors'
import { Field, PasswordField } from '../../components/Field'
import { AuthPage, FormError, Spacer } from './AuthLayout'

export function LogInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.')
    if (!password) return setError('Enter your password.')
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    // On success the session changes and the router sends them on.
    if (error) setError(friendlyAuthError(error))
  }

  return (
    <AuthPage title="Welcome back" subtitle="Log in to see what’s due." back="/welcome">
      <form onSubmit={onSubmit} noValidate style={{ display: 'contents' }}>
        <Field label="Email" placeholder="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label="Password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <Link to="/forgot-password" className="lk2b" style={{ margin: '12px 2px', alignSelf: 'flex-start' }}>
          Forgot password?
        </Link>
        <Spacer />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <Link to="/privacy" className="lk">
        New here? Create an account
      </Link>
    </AuthPage>
  )
}
