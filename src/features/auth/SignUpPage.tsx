import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { supabase } from '../../lib/supabase'
import { friendlyAuthError } from '../../lib/authErrors'
import { Field, PasswordField } from '../../components/Field'
import { AuthPage, FormError, Spacer } from './AuthLayout'
import { pendingInviteRedirect } from '../invites/pendingInvite'
import { privacyAccepted } from './privacy'

const okEmail = (e: string) => /^\S+@\S+\.\S+$/.test(e.trim())

export function SignUpPage() {
  const location = useLocation()
  const accepted = privacyAccepted() || (location.state as { privacy?: boolean } | null)?.privacy === true
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)

  // Sign up always passes through the privacy page first
  if (!accepted) return <Navigate to="/privacy" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Add your first name.')
    if (!okEmail(email)) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Use at least 8 characters for your password.')

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim().slice(0, 40), privacy_accepted: true },
        // keeps a pending invite link through the email-confirmation hop
        emailRedirectTo: pendingInviteRedirect(),
      },
    })
    setBusy(false)
    if (error) return setError(friendlyAuthError(error))
    // Confirm-email off: we get a session and the router moves on. On: wait for the link.
    if (!data.session) setCheckEmail(true)
  }

  if (checkEmail) {
    return (
      <AuthPage title="Check your email" subtitle={`We sent a confirmation link to ${email.trim()}. Open it on this phone to finish signing up.`}>
        <Spacer />
        <Link to="/login" className="btn sec">
          Back to log in
        </Link>
      </AuthPage>
    )
  }

  return (
    <AuthPage title="Create your account" subtitle="It only takes a minute. HouseMate is invite-only while we test." back="/privacy">
      <form onSubmit={onSubmit} noValidate style={{ display: 'contents' }}>
        <Field label="First name" placeholder="First name" autoComplete="given-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Email" placeholder="Email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label="Password" placeholder="Password, 8+ characters" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <Spacer />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <Link to="/login" className="lk">
        Already have an account? Log in
      </Link>
    </AuthPage>
  )
}
