import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type Profile = {
  id: string
  display_name: string | null
  avatar_hue: number
  theme: string
}

export type Membership = {
  role: string
  household: { id: string; name: string }
}

type AuthState = {
  /** true until we know whether someone is logged in, and have loaded their profile */
  loading: boolean
  session: Session | null
  profile: Profile | null
  membership: Membership | null
  /** set when the person arrived from a password reset link */
  recovering: boolean
  /** re-read profile and household (after editing them) */
  refresh: () => Promise<void>
  /** an error loading the profile, e.g. no network */
  loadError: string | null
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionKnown, setSessionKnown] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)

  // Track the login session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionKnown(true)
    })
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Keep this callback synchronous: supabase-js warns against awaiting inside it.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') setRecovering(false)
      setSession(next)
      setSessionKnown(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  const load = useCallback(async (uid: string) => {
    const [profileRes, memberRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name, avatar_hue, theme').eq('id', uid).maybeSingle(),
      supabase
        .from('household_members')
        .select('role, household:households(id, name)')
        .eq('user_id', uid)
        .maybeSingle(),
    ])
    if (profileRes.error || memberRes.error) {
      setLoadError('We could not load your account. Check your connection and try again.')
    } else {
      setLoadError(null)
      setProfile(profileRes.data)
      const m = memberRes.data
      setMembership(m && m.household ? { role: m.role, household: m.household } : null)
    }
    setLoadedFor(uid)
  }, [])

  // Load profile and household whenever the logged-in user changes.
  // (When logged out, the value below hides any old profile, so there's nothing to reset.)
  useEffect(() => {
    // load() only sets state after the network call returns, so this is a normal data fetch.
    // eslint-disable-next-line react/set-state-in-effect
    if (userId) void load(userId)
  }, [userId, load])

  const refresh = useCallback(async () => {
    if (userId) await load(userId)
  }, [userId, load])

  const loading = !sessionKnown || (userId !== null && loadedFor !== userId)

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      profile: userId ? profile : null,
      membership: userId ? membership : null,
      recovering,
      refresh,
      loadError,
    }),
    [loading, session, userId, profile, membership, recovering, refresh, loadError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
