import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/authErrors'
import { Field } from '../../components/Field'
import { AuthLayout, FormError } from './AuthLayout'

export function LogInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    // On success the session changes and the router sends them to the right screen.
    if (error) setError(friendlyAuthError(error))
  }

  return (
    <AuthLayout title="Welcome back">
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Field label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="foot">
        <Link to="/forgot-password">Forgot your password?</Link>
      </p>
      <p className="foot">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  )
}
