import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/authErrors'
import { Field } from '../../components/Field'
import { AuthLayout, FormError } from './AuthLayout'

export function SignUpPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim().length === 0) return setError('Please enter your name.')
    if (password.length < 8) return setError('Please choose a password with at least 8 characters.')

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim().slice(0, 40) },
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    setBusy(false)
    if (error) return setError(friendlyAuthError(error))
    // With email confirmation off we get a session right away and the router moves on.
    // With it on, there is no session until they click the link.
    if (!data.session) setCheckEmail(true)
  }

  if (checkEmail) {
    return (
      <AuthLayout title="Check your email" subtitle={`We sent a confirmation link to ${email.trim()}.`}>
        <Link to="/login" className="btn sec">
          Back to log in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="HouseMate is invite-only while we test.">
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Field label="Your name" autoComplete="name" maxLength={40} required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormError message={error} />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="foot">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  )
}
