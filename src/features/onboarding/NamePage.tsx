import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../app/auth'
import { Field } from '../../components/Field'
import { AuthLayout, FormError } from '../auth/AuthLayout'
import { LogOutButton } from '../auth/LogOutButton'

/** Shown to a signed-in person whose profile has no name yet. */
export function NamePage() {
  const auth = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const clean = name.trim()
    if (!clean) return setError('Please enter your name.')
    if (!auth.session) return
    setBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: clean.slice(0, 40) })
      .eq('id', auth.session.user.id)
    if (error) {
      setBusy(false)
      return setError('We couldn’t save your name. Please try again.')
    }
    await auth.refresh() // the router then moves them on
  }

  return (
    <AuthLayout title="What should housemates call you?">
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Field label="Your name" autoComplete="name" maxLength={40} required value={name} onChange={(e) => setName(e.target.value)} />
        <FormError message={error} />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </form>
      <LogOutButton />
    </AuthLayout>
  )
}
