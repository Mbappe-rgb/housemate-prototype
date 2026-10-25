import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { LoadingScreen } from '../../components/LoadingScreen'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../app/auth'
import { supabase } from '../../lib/supabase'
import { friendlyHouseholdError } from '../../lib/householdErrors'
import { AuthLayout, Hero } from '../auth/AuthLayout'
import { LogOutButton } from '../auth/LogOutButton'

type MyRequest = { id: string; status: 'pending' | 'declined'; household_name: string } | null

// While someone waits for approval we check every 10s (Realtime replaces this in Phase 6)
const WAIT_POLL_MS = 10_000

export function BigOption({ emoji, title, text, to }: { emoji: string; title: string; text: string; to: string }) {
  return (
    <Link to={to} className="bigopt">
      <span className="em" aria-hidden="true">
        {emoji}
      </span>
      <div>
        <b>{title}</b>
        <small>{text}</small>
      </div>
      <Icon name="next" size={18} />
    </Link>
  )
}

/** Signed in, no household: waiting for approval, declined, or choose Create / Join. */
export function HouseholdChoicePage() {
  const auth = useAuth()
  const toast = useToast()
  const [request, setRequest] = useState<MyRequest | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const refreshAuth = auth.refresh
  const lastStatus = useRef<string | undefined>(undefined)

  const check = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_join_request')
    const next = error ? null : ((data as MyRequest) ?? null)
    // A pending request that disappeared was approved (or cancelled elsewhere): reload membership
    if (lastStatus.current === 'pending' && !next) void refreshAuth()
    lastStatus.current = next?.status
    setRequest(next)
  }, [refreshAuth])

  useEffect(() => {
    // check() sets state only after the network call returns
    // eslint-disable-next-line react/set-state-in-effect
    void check()
  }, [check])

  useEffect(() => {
    if (request?.status !== 'pending') return
    const tick = () => {
      if (document.visibilityState === 'visible') void check()
    }
    const timer = window.setInterval(tick, WAIT_POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [request?.status, check])

  if (request === undefined) return <LoadingScreen />

  if (request?.status === 'pending') {
    return (
      <AuthLayout>
        <Hero
          emoji="⏳"
          title="Waiting for approval"
          text={
            <>
              We asked the admin of <b>{request.household_name}</b> to let you in. You’ll go straight to the dashboard once
              they approve.
            </>
          }
        />
        <button type="button" className="btn sec" onClick={() => void check()}>
          Check again
        </button>
        <button
          type="button"
          className="lk"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const { error } = await supabase.rpc('cancel_join_request')
            setBusy(false)
            if (error) return toast(friendlyHouseholdError(error))
            toast('Request cancelled')
            void check()
          }}
        >
          {busy ? 'Cancelling…' : 'Cancel request'}
        </button>
        <LogOutButton />
      </AuthLayout>
    )
  }

  if (request?.status === 'declined') {
    return (
      <AuthLayout>
        <Hero emoji="🚪" title="Request declined" text={<>The admin of <b>{request.household_name}</b> didn’t approve your request. If that’s a mistake, ask them for a new invite.</>} />
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await supabase.rpc('acknowledge_join_request', { p_request: request.id })
            void check()
          }}
        >
          OK
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <Hero title="Welcome to HouseMate" text="Split bills and share the chores, all in one place." />
      <BigOption emoji="✨" title="Create a household" text="Start fresh and invite your housemates" to="/setup/create" />
      <BigOption emoji="🔑" title="Join a household" text="Use an invite link, code or QR" to="/setup/join" />
      <LogOutButton />
    </AuthLayout>
  )
}
