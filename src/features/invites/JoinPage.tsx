import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../app/auth'
import { LoadingScreen } from '../../components/LoadingScreen'
import { supabase } from '../../lib/supabase'
import { friendlyHouseholdError } from '../../lib/householdErrors'
import { AuthPage, FormError, Spacer } from '../auth/AuthLayout'
import { clearPendingInvite, savePendingInvite } from './pendingInvite'
import { formatCode, parseInviteInput } from './inviteFormat'

type Preview =
  | { status: 'ok' | 'full'; household_id: string; household_name: string; member_count: number; members: { initial: string; hue: number }[] }
  | { status: 'invalid' | 'expired' | 'revoked' | 'used_up' }

const PROBLEMS: Record<string, { emoji: string; title: string; text: string }> = {
  invalid: { emoji: '🤔', title: 'Invite not found', text: 'Check the link or code, or ask your housemate to send it again.' },
  expired: { emoji: '⏰', title: 'This invite has expired', text: 'Invite links last 7 days. Ask your housemate for a new one.' },
  revoked: { emoji: '🔁', title: 'This link was reset', text: 'The admin made a new link. Ask your housemate to send it.' },
  used_up: { emoji: '🔁', title: 'This link has been used a lot', text: 'Ask your housemate to reset the link and send the new one.' },
  full: { emoji: '🏠', title: 'This household is full', text: 'A household can have up to 8 people.' },
}

/**
 * /join/TOKEN: opened from an invite link, QR code or typed code.
 * Shows the household, then asks the visitor to sign up or log in before requesting to join.
 */
export function JoinPage() {
  const { token: raw = '' } = useParams()
  const token = parseInviteInput(raw)
  const auth = useAuth()
  const navigate = useNavigate()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let alive = true
    supabase.rpc('preview_invite', { p_token: token }).then(({ data, error }) => {
      if (!alive) return
      setPreview(error ? { status: 'invalid' } : (data as Preview))
    })
    return () => {
      alive = false
    }
  }, [token])

  // Remember the invite so they come back here after signing up or logging in
  useEffect(() => {
    if (token && preview?.status === 'ok' && !auth.session) savePendingInvite(formatCode(token))
  }, [token, preview?.status, auth.session])

  if (!token) return <Problem kind="invalid" />
  if (!preview || auth.loading) return <LoadingScreen />
  if (preview.status !== 'ok') return <Problem kind={preview.status} />

  const header = (
    <div className="card2" style={{ textAlign: 'center', padding: 22 }}>
      <span className="bi" style={{ margin: '0 auto 10px', width: 56, height: 56, fontSize: 28 }} aria-hidden="true">
        🏠
      </span>
      <b style={{ fontSize: 20 }}>{preview.household_name}</b>
      <small className="hint" style={{ margin: '4px 0 14px' }}>
        {preview.member_count} {preview.member_count === 1 ? 'housemate' : 'housemates'}
      </small>
      <div className="avs" style={{ justifyContent: 'center' }} aria-hidden="true">
        {preview.members.map((m, i) => (
          <span key={i} className="av" style={{ width: 46, fontSize: 17, background: `hsl(${m.hue} 70% 90%)`, color: `hsl(${m.hue} 45% 32%)` }}>
            {m.initial}
          </span>
        ))}
      </div>
    </div>
  )

  // Not signed in: sign up or log in first, then come back here
  if (!auth.session) {
    return (
      <AuthPage title="Join this household?" subtitle="Create an account or log in, then ask the admin to let you in.">
        {header}
        <Spacer />
        <Link to="/privacy" className="btn">
          Create account to join
        </Link>
        <Link to="/login" className="btn sec" style={{ marginTop: 10 }}>
          I already have an account
        </Link>
        <button
          type="button"
          className="lk"
          onClick={() => {
            clearPendingInvite()
            navigate('/welcome')
          }}
        >
          Not now
        </button>
      </AuthPage>
    )
  }

  // Already in a household
  if (auth.membership) {
    const same = auth.membership.household.id === preview.household_id
    return (
      <AuthPage
        title="Join this household?"
        subtitle={
          same
            ? 'You’re already in this household.'
            : `You’re already in ${auth.membership.household.name}. To join another, leave yours first from the Household tab.`
        }
      >
        {header}
        <Spacer />
        <button
          type="button"
          className="btn"
          onClick={() => {
            clearPendingInvite()
            navigate('/', { replace: true })
          }}
        >
          Go to dashboard
        </button>
      </AuthPage>
    )
  }

  return (
    <AuthPage title="Join this household?" subtitle="The household admin will get your request and can approve it.">
      {header}
      <FormError message={error} />
      <Spacer />
      <button
        type="button"
        className="btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          const { error } = await supabase.rpc('request_to_join', { p_token: token })
          setBusy(false)
          if (error) return setError(friendlyHouseholdError(error))
          clearPendingInvite()
          navigate('/setup/household', { replace: true }) // shows "Waiting for approval"
        }}
      >
        {busy ? 'Sending request…' : 'Ask to join'}
      </button>
      <button
        type="button"
        className="lk"
        onClick={() => {
          clearPendingInvite()
          navigate('/setup/household')
        }}
      >
        Not this one
      </button>
    </AuthPage>
  )
}

function Problem({ kind }: { kind: string }) {
  const p = PROBLEMS[kind] ?? PROBLEMS.invalid
  useEffect(() => clearPendingInvite(), [])
  return (
    <AuthPage title={`${p.emoji} ${p.title}`} subtitle={p.text}>
      <Spacer />
      <Link to="/" className="btn">
        Go to HouseMate
      </Link>
    </AuthPage>
  )
}
