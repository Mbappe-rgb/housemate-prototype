import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { HouseContext, type House, type HouseActions, type JoinRequest, type Settings } from './house'
import { useAuth } from '../../app/auth'
import { supabase } from '../../lib/supabase'
import { todayIn } from '../../lib/dates'
import { friendlyHouseholdError } from '../../lib/householdErrors'
import type { Member } from '../../lib/bills'
import { useToast } from '../../components/Toast'
import { AppSkeleton } from '../../components/Skeleton'
import { useLiveBills } from './useLiveBills'
import { useLiveChores } from './useLiveChores'
import { useLiveChannel } from '../../lib/useLiveChannel'

type HouseholdRow = { id: string; name: string; timezone: string; currency: string }

// Join requests arrive through Realtime; this slower re-check is a backup.
const REQUEST_POLL_MS = 60_000

/**
 * The signed-in person's real household, housemates, invite link and (for the admin) join requests.
 * Bills and chores come from the database through the functions in supabase/migrations.
 */
export function LiveHouseProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const toast = useToast()
  const householdId = auth.membership?.household.id ?? null
  const isAdmin = auth.membership?.role === 'owner'
  const userId = auth.session?.user.id
  const refreshAuth = auth.refresh
  const [household, setHousehold] = useState<HouseholdRow | null>(null)
  const [members, setMembers] = useState<Member[] | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [error, setError] = useState<string | null>(null)
  // Settings change on screen right away; the saved profile catches up
  const [settingsDraft, setSettingsDraft] = useState<Partial<Settings>>({})
  const today = todayIn(household?.timezone ?? 'America/Toronto')
  const live = useLiveBills(householdId, userId, today, toast)
  const liveChores = useLiveChores(householdId, today, toast)

  const loadRequests = useCallback(async (hid: string) => {
    const { data, error } = await supabase.rpc('list_join_requests', { p_household: hid })
    if (error) return
    setJoinRequests(
      data.map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: r.display_name ?? 'Someone',
        hue: r.avatar_hue,
        email: r.email,
        createdAt: r.created_at,
      })),
    )
  }, [])

  const load = useCallback(
    async (hid: string) => {
      const [h, m, link] = await Promise.all([
        supabase.from('households').select('id, name, timezone, currency').eq('id', hid).maybeSingle(),
        supabase
          .from('household_members')
          .select('role, joined_at, profile:profiles(id, display_name, avatar_hue, etransfer_email, phone, bank_name)')
          .eq('household_id', hid)
          .order('joined_at'),
        supabase.rpc('get_invite_link', { p_household: hid }),
      ])
      if (h.error || m.error) {
        setError('We couldn’t load your household. Check your connection and try again.')
        return
      }
      if (!h.data) {
        // Removed from the household (or it was closed): go back to Create or Join
        await refreshAuth()
        return
      }
      setError(null)
      setHousehold(h.data)
      setInviteCode(link.data ?? null)
      setMembers(
        m.data
          .filter((row) => row.profile)
          .map((row) => ({
            id: row.profile!.id,
            name: row.profile!.display_name ?? 'Housemate',
            hue: row.profile!.avatar_hue,
            role: row.role as 'owner' | 'member',
            etransferEmail: row.profile!.etransfer_email,
            phone: row.profile!.phone,
            bankName: row.profile!.bank_name,
          })),
      )
    },
    [refreshAuth],
  )

  useEffect(() => {
    // load() sets state only after the network call returns
    // eslint-disable-next-line react/set-state-in-effect
    if (householdId) void load(householdId)
  }, [householdId, load])

  // Admin: check for join requests now, then every 20s while the app is on screen
  useEffect(() => {
    if (!householdId || !isAdmin) return
    const check = () => {
      if (document.visibilityState === 'visible') void loadRequests(householdId)
    }
    check()
    const timer = window.setInterval(check, REQUEST_POLL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [householdId, isAdmin, loadRequests])

  // Live updates: re-read only what changed
  useLiveChannel(householdId ? `household:${householdId}` : null, (tables) => {
    if (!householdId) return
    if (tables.has('bills') || tables.has('bill_shares')) void live.reload()
    if (tables.has('chores')) void liveChores.reload()
    if (tables.has('household_members') || tables.has('households') || tables.has('invites')) void load(householdId)
    if (tables.has('join_requests') && isAdmin) void loadRequests(householdId)
  })
  // Removed from the household, or made admin: refresh who I am
  useLiveChannel(userId ? `user:${userId}` : null, (tables) => {
    if (tables.has('household_members')) void refreshAuth()
  })

  const actions = useMemo<HouseActions>(() => {
    return {
      saveSettings: async (change) => {
        if (!userId) return
        setSettingsDraft((d) => ({ ...d, ...change }))
        const update: { theme?: string; notify_enabled?: boolean; notify_bills?: boolean; notify_chores?: boolean } = {}
        if (change.theme !== undefined) update.theme = change.theme
        if (change.notifyEnabled !== undefined) update.notify_enabled = change.notifyEnabled
        if (change.notifyBills !== undefined) update.notify_bills = change.notifyBills
        if (change.notifyChores !== undefined) update.notify_chores = change.notifyChores
        const { error } = await supabase.from('profiles').update(update).eq('id', userId)
        if (error) toast('We couldn’t save that setting. Please try again.')
        await refreshAuth()
        setSettingsDraft({})
      },
      ...live.actions,
      ...liveChores.actions,
      saveProfile: async (edit) => {
        if (!userId) return 'You’re not signed in.'
        const blankToNull = (v: string) => (v.trim() ? v.trim() : null)
        const { error } = await supabase
          .from('profiles')
          .update({
            display_name: edit.displayName.trim().slice(0, 40),
            etransfer_email: blankToNull(edit.etransferEmail),
            phone: blankToNull(edit.phone),
            bank_name: blankToNull(edit.bankName),
          })
          .eq('id', userId)
        if (error) return 'We couldn’t save your profile. Please try again.'
        await Promise.all([refreshAuth(), householdId ? load(householdId) : Promise.resolve()])
        toast('Profile saved')
        return null
      },
      leaveHousehold: async (newAdminId) => {
        const { error } = await supabase.rpc('leave_household', newAdminId ? { p_new_admin: newAdminId } : {})
        if (error) return friendlyHouseholdError(error)
        await refreshAuth() // the router sends them to Create or Join
        return null
      },
      removeMember: async (memberId) => {
        if (!householdId) return 'No household'
        const { error } = await supabase.rpc('remove_member', { p_household: householdId, p_user: memberId })
        if (error) return friendlyHouseholdError(error)
        await load(householdId)
        toast('Removed from the household')
        return null
      },
      resetInvite: async () => {
        if (!householdId) return
        const { data, error } = await supabase.rpc('reset_invite_link', { p_household: householdId })
        if (error) return toast(friendlyHouseholdError(error))
        setInviteCode(data)
        toast('Link reset. The old link no longer works.')
      },
      decideRequest: async (requestId, approve) => {
        if (!householdId) return
        const name = joinRequests.find((r) => r.id === requestId)?.name ?? 'They'
        const { data, error } = await supabase.rpc('decide_join_request', { p_request: requestId, p_approve: approve })
        if (error) toast(friendlyHouseholdError(error))
        else if (data === 'requester_in_household') toast(`${name} already joined another household`)
        else toast(approve ? `${name} joined the household 🎉` : `Request from ${name} declined`)
        await Promise.all([loadRequests(householdId), approve ? load(householdId) : Promise.resolve()])
      },
    }
  }, [toast, userId, refreshAuth, householdId, load, loadRequests, joinRequests, live.actions, liveChores.actions])

  if (error) {
    return (
      <div className="center-screen">
        <div>
          <p role="alert">{error}</p>
          <button type="button" className="btn" onClick={() => householdId && void load(householdId)}>
            Try again
          </button>
        </div>
      </div>
    )
  }
  if (!household || !members || !userId || !live.bills || !liveChores.chores) return <AppSkeleton />

  const me = members.find((m) => m.id === userId) ?? {
    id: userId,
    name: auth.profile?.display_name ?? 'You',
    hue: auth.profile?.avatar_hue ?? 0,
  }

  const house: House = {
    mode: 'live',
    household,
    me: { ...me, email: auth.session?.user.email },
    members,
    today,
    bills: live.bills,
    chores: liveChores.chores,
    inviteCode,
    settings: {
      theme: auth.profile?.theme ?? 'lime',
      notifyEnabled: auth.profile?.notify_enabled ?? true,
      notifyBills: auth.profile?.notify_bills ?? true,
      notifyChores: auth.profile?.notify_chores ?? true,
      ...settingsDraft,
    },
    isAdmin,
    joinRequests: isAdmin ? joinRequests : [],
    moneyReady: true,
    choresReady: true,
    actions,
  }

  return <HouseContext.Provider value={house}>{children}</HouseContext.Provider>
}
