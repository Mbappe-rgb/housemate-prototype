import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { HouseContext, type House, type HouseActions, type JoinRequest } from './house'
import { useAuth } from '../../app/auth'
import { supabase } from '../../lib/supabase'
import { todayIn } from '../../lib/dates'
import { friendlyHouseholdError } from '../../lib/householdErrors'
import type { Member } from '../../lib/bills'
import { useToast } from '../../components/Toast'
import { LoadingScreen } from '../../components/LoadingScreen'

type HouseholdRow = { id: string; name: string; timezone: string; currency: string }

// Until Realtime arrives (Phase 6), the admin's dashboard re-checks for join requests this often.
const REQUEST_POLL_MS = 20_000

/**
 * The signed-in person's real household, housemates, invite link and (for the admin) join requests.
 * Bills and chores are empty until they're connected to the database in Phases 4 and 5.
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

  const actions = useMemo<HouseActions>(() => {
    const notYet = () => toast('Bills and chores arrive in the next update')
    return {
      markPaid: notYet,
      undoPaid: notYet,
      markReceived: notYet,
      addBill: notYet,
      saveSplit: notYet,
      saveBillSettings: notYet,
      completeChore: notYet,
      reopenChore: notYet,
      addChore: notYet,
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
  }, [toast, userId, refreshAuth, householdId, load, loadRequests, joinRequests])

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
  if (!household || !members || !userId) return <LoadingScreen />

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
    today: todayIn(household.timezone),
    bills: [],
    chores: [],
    inviteCode,
    isAdmin,
    joinRequests: isAdmin ? joinRequests : [],
    moneyReady: false,
    actions,
  }

  return <HouseContext.Provider value={house}>{children}</HouseContext.Provider>
}
