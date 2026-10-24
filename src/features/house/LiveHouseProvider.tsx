import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { HouseContext, type House, type HouseActions } from './house'
import { useAuth } from '../../app/auth'
import { supabase } from '../../lib/supabase'
import { todayIn } from '../../lib/dates'
import type { Member } from '../../lib/bills'
import { useToast } from '../../components/Toast'
import { LoadingScreen } from '../../components/LoadingScreen'

type HouseholdRow = { id: string; name: string; timezone: string; currency: string }

/**
 * The signed-in person's real household and housemates.
 * Bills and chores are empty until they're connected to the database in Phases 4 and 5.
 */
export function LiveHouseProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const toast = useToast()
  const householdId = auth.membership?.household.id ?? null
  const [household, setHousehold] = useState<HouseholdRow | null>(null)
  const [members, setMembers] = useState<Member[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (hid: string) => {
    const [h, m] = await Promise.all([
      supabase.from('households').select('id, name, timezone, currency').eq('id', hid).single(),
      supabase
        .from('household_members')
        .select('role, joined_at, profile:profiles(id, display_name, avatar_hue, etransfer_email, phone, bank_name)')
        .eq('household_id', hid)
        .order('joined_at'),
    ])
    if (h.error || m.error) {
      setError('We couldn’t load your household. Check your connection and try again.')
      return
    }
    setError(null)
    setHousehold(h.data)
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
  }, [])

  useEffect(() => {
    // load() sets state only after the network call returns
    // eslint-disable-next-line react/set-state-in-effect
    if (householdId) void load(householdId)
  }, [householdId, load])

  const userId = auth.session?.user.id
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
        await Promise.all([auth.refresh(), householdId ? load(householdId) : Promise.resolve()])
        toast('Profile saved')
        return null
      },
      leaveHousehold: () => toast('Leaving a household arrives in the next update'),
    }
  }, [toast, userId, auth, householdId, load])

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
    inviteCode: null,
    moneyReady: false,
    actions,
  }

  return <HouseContext.Provider value={house}>{children}</HouseContext.Provider>
}
