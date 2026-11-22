import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { LoadingScreen } from '../../components/LoadingScreen'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../app/auth'
import { supabase } from '../../lib/supabase'
import { friendlyHouseholdError } from '../../lib/householdErrors'
import { useLiveChannel } from '../../lib/useLiveChannel'
import { AuthPage, BigOption, Spacer } from '../auth/AuthLayout'
import { LogOutButton } from '../auth/LogOutButton'
import { payStepDone } from './payStep'

type MyRequest = { id: string; status: 'pending' | 'declined'; household_name: string } | null

// Approval arrives through Realtime; this re-check is a backup
const WAIT_POLL_MS = 30_000

/** Signed in, no household: waiting for approval, declined, or set up a household. */
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

  // The admin's decision arrives on my own channel
  useLiveChannel(auth.session ? `user:${auth.session.user.id}` : null, () => void check())

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
      <AuthPage
        title="Waiting for approval"
        subtitle={
          <>
            We asked the admin of <b>{request.household_name}</b> to let you in. You’ll go straight to the dashboard once they approve.
          </>
        }
      >
        <Spacer />
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
      </AuthPage>
    )
  }

  if (request?.status === 'declined') {
    return (
      <AuthPage
        title="Request declined"
        subtitle={
          <>
            The admin of <b>{request.household_name}</b> didn’t approve your request. If that’s a mistake, ask them for a new invite.
          </>
        }
      >
        <Spacer />
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
      </AuthPage>
    )
  }

  // Right after sign-up: ask how housemates pay you (once; it can be skipped)
  if (!auth.profile?.etransfer && !payStepDone()) return <Navigate to="/setup/pay" replace />

  return (
    <AuthPage title="Set up your household" subtitle="Create a new one, or join the one you were invited to.">
      <BigOption icon="household" title="Create a household" text="Start fresh and invite your housemates" to="/setup/create" />
      <BigOption icon="link" title="Join a household" text="Use an invite link, code or QR" to="/setup/join" />
      <Spacer />
      <LogOutButton />
    </AuthPage>
  )
}
