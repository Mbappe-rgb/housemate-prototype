import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../app/auth'
import { Field } from '../../components/Field'
import { supabase } from '../../lib/supabase'
import { friendlyHouseholdError } from '../../lib/householdErrors'
import { AuthPage, FormError, Spacer } from '../auth/AuthLayout'
import { InvitePanelView } from '../invites/InvitePanel'

const SUGGESTIONS = ['The flat', 'Maple house', 'Main street household']

/**
 * Create a household in 3 steps: name it, invite people, done.
 * The household exists after step 1; we only refresh the session at the end so the
 * router doesn't jump to the dashboard mid-flow.
 */
export function CreateHouseholdPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'name' | 'invite' | 'ready'>('name')
  const [name, setName] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const clean = name.trim()
    if (!clean) return setError('Give your household a name.')
    setBusy(true)
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const created = await supabase.rpc('create_household', { p_name: clean, p_timezone: timezone })
    if (created.error) {
      setBusy(false)
      return setError(friendlyHouseholdError(created.error))
    }
    const link = await supabase.rpc('get_invite_link', { p_household: created.data })
    setBusy(false)
    setHouseholdId(created.data)
    setToken(link.data ?? null)
    setStep('invite')
  }

  if (step === 'name') {
    return (
      <AuthPage title="Name your household" subtitle="Your housemates will see this name. You’ll be its admin." back="/setup/household" step={1}>
        <form onSubmit={create} noValidate style={{ display: 'contents' }}>
          <Field label="Household name" placeholder="e.g. Weber street household" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="chips" style={{ marginTop: 12 }}>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="ch" onClick={() => setName(s)}>
                {s}
              </button>
            ))}
          </div>
          <FormError message={error} />
          <Spacer />
          <button type="submit" className="btn" disabled={busy || !name.trim()}>
            {busy ? 'Creating…' : 'Continue'}
          </button>
        </form>
      </AuthPage>
    )
  }

  if (step === 'invite') {
    return (
      // No back button: the household already exists
      <AuthPage title="Invite your housemates" subtitle="Pick whichever is easiest. You’ll approve each person who asks to join." step={2}>
        <InvitePanelView
          token={token}
          householdName={name.trim()}
          emptyMessage="You can invite people later from the Household tab."
          resetting={resetting}
          onReset={async () => {
            if (!householdId) return
            setResetting(true)
            const { data } = await supabase.rpc('reset_invite_link', { p_household: householdId })
            setResetting(false)
            if (data) setToken(data)
          }}
        />
        <Spacer />
        <button type="button" className="btn" onClick={() => setStep('ready')}>
          Continue
        </button>
        <button type="button" className="lk" onClick={() => setStep('ready')}>
          Skip for now
        </button>
      </AuthPage>
    )
  }

  return (
    <AuthPage
      title="You’re all set"
      subtitle={`${name.trim()} is ready. When someone uses your link, you’ll see their request on your dashboard to approve.`}
      back={() => setStep('invite')}
      step={3}
    >
      <Spacer />
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          await auth.refresh()
          navigate('/', { replace: true })
        }}
      >
        Go to dashboard
      </button>
    </AuthPage>
  )
}
