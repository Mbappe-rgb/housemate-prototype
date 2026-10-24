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
    if (!clean) return setError('Add your first name.')
    if (!auth.session) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ display_name: clean.slice(0, 40) }).eq('id', auth.session.user.id)
    if (error) {
      setBusy(false)
      return setError('We couldn’t save your name. Please try again.')
    }
    await auth.refresh() // the router then moves them on
  }

  return (
    <AuthLayout>
      <div style={{ height: 64 }} />
      <h1>What should housemates call you?</h1>
      <p>This is the name they’ll see on bills and chores.</p>
      <form onSubmit={onSubmit} noValidate style={{ display: 'contents' }}>
        <Field label="First name" placeholder="First name" autoComplete="given-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <FormError message={error} />
        <div className="grow" />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </form>
      <LogOutButton />
    </AuthLayout>
  )
}
