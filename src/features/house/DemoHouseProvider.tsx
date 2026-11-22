import { useMemo, useState, type ReactNode } from 'react'
import { HouseContext, type House, type HouseActions, type JoinRequest, type NewBill, type Reminder } from './house'
import { DEMO_MEMBERS, demoBills, demoChores, type DemoState } from './demoData'
import { stillUnpaid, withNewPayer, type Bill, type Share } from '../../lib/bills'
import { splitEqual } from '../../lib/money'
import { todayIn } from '../../lib/dates'
import { useToast } from '../../components/Toast'
import { hueFromName } from '../../lib/hue'

const TIMEZONE = 'America/Toronto'
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const demoCode = () => Array.from({ length: 12 }, () => CODE_LETTERS[Math.floor(Math.random() * 32)]).join('')
const SAMPLE_REQUESTS: JoinRequest[] = [
  { id: 'req-tomi', userId: 'tomi', name: 'Tomi', hue: hueFromName('Tomi'), email: 'tomi@example.com', createdAt: '2026-01-01T00:00:00Z' },
]
const SAMPLE_REMINDERS: Reminder[] = [
  { id: 'rem-1', billId: 'internet', fromId: 'ola', createdAt: '2026-01-01T00:00:00Z', read: false },
]
const now = () => new Date().toISOString()

/** The v5 prototype's sample household. Everything happens in memory and resets on reload. */
export function DemoHouseProvider({
  state,
  theme,
  onTheme,
  children,
}: {
  state: DemoState
  theme: string
  onTheme: (theme: string) => void
  children: ReactNode
}) {
  const today = todayIn(TIMEZONE)
  const toast = useToast()
  const [loadedState, setLoadedState] = useState(state)
  const [bills, setBills] = useState(() => demoBills(today, state))
  const [chores, setChores] = useState(() => demoChores(today))
  const [members, setMembers] = useState(DEMO_MEMBERS)
  const [inviteCode, setInviteCode] = useState('WEBR7K4QM2XP')
  const [joinRequests, setJoinRequests] = useState(SAMPLE_REQUESTS)
  const [reminders, setReminders] = useState(SAMPLE_REMINDERS)
  const [reminded, setReminded] = useState<Record<string, string[]>>({})
  const [notify, setNotify] = useState({ notifyEnabled: true, notifyBills: true, notifyChores: true })
  const me = members[0]

  // Reload the sample data when the data state changes in the demo controls
  if (loadedState !== state) {
    setLoadedState(state)
    setBills(demoBills(today, state))
    setChores(demoChores(today))
  }

  const actions = useMemo<HouseActions>(() => {
    const name = (id: string) => bills.find((b) => b.id === id)?.name ?? 'Bill'
    const updateShare = (billId: string, memberId: string, change: Partial<Share>) =>
      setBills((all) =>
        all.map((b) => (b.id === billId && b.shares[memberId] ? { ...b, shares: { ...b.shares, [memberId]: { ...b.shares[memberId], ...change } } } : b)),
      )
    // The demo keeps only the file name; nothing is uploaded
    const receiptPath = (receipt?: File | null) => (receipt ? { receiptPath: `demo:${receipt.name}` } : {})

    return {
      markSent: (id, receipt) => {
        const bill = bills.find((b) => b.id === id)
        updateShare(id, me.id, { sentAt: now(), ...receiptPath(receipt) })
        toast(`Marked as paid. Waiting for ${members.find((m) => m.id === bill?.payerId)?.name ?? 'the payer'} to confirm`)
      },
      undoSent: (id) => updateShare(id, me.id, { sentAt: null, paidAt: null }),
      payProvider: (id, receipt) => {
        updateShare(id, me.id, { paidAt: now(), ...receiptPath(receipt) })
        toast(`${name(id)} marked as paid`)
      },
      undoProvider: (id) => updateShare(id, me.id, { paidAt: null }),
      confirmShare: (id, memberId) => {
        updateShare(id, memberId, { paidAt: now(), sentAt: now() })
        toast(`${members.find((m) => m.id === memberId)?.name ?? 'Payment'} confirmed`)
      },
      markUnpaid: (id, memberId) => updateShare(id, memberId, { paidAt: null, sentAt: null, receiptPath: null }),
      sendReminder: (id, memberId) => {
        const bill = bills.find((b) => b.id === id)
        if (!bill) return
        const who = memberId ? [memberId] : stillUnpaid(bill)
        setReminded((r) => ({ ...r, [id]: [...new Set([...(r[id] ?? []), ...who])] }))
        toast(who.length === 1 ? `Reminder sent to ${members.find((m) => m.id === who[0])?.name ?? 'them'}` : `Reminder sent to ${who.length} housemates`)
      },
      addBill: (n: NewBill) => {
        const equal = splitEqual(n.totalCents, members.length)
        const shares = Object.fromEntries(
          members.map((m, i) => [m.id, { amountCents: n.splitMode === 'equal' ? equal[i] : (n.amounts[m.id] ?? 0), sentAt: null, paidAt: null }]),
        )
        setBills((all) => [
          ...all,
          {
            id: `bill-${Date.now()}`,
            name: n.name,
            category: n.category,
            emoji: n.emoji,
            totalCents: n.totalCents,
            dueDate: n.dueDate,
            payerId: n.payerId,
            createdBy: me.id,
            recurrence: n.recurrence,
            splitMode: n.splitMode,
            shares,
          },
        ])
        toast(`${n.name} added`)
      },
      deleteBill: async (id) => {
        setBills((all) => all.filter((b) => b.id !== id))
        toast('Bill deleted')
        return null
      },
      saveSplit: (id, mode, amounts) => {
        setBills((all) =>
          all.map((b) => {
            if (b.id !== id) return b
            const equal = splitEqual(b.totalCents, members.length)
            const shares = Object.fromEntries(
              members.map((m, i) => [m.id, { ...b.shares[m.id], amountCents: mode === 'equal' ? equal[i] : (amounts[m.id] ?? 0) }]),
            )
            return { ...b, splitMode: mode, shares }
          }),
        )
        toast('Split updated')
      },
      saveBillSettings: (id, payerId, recurrence) => {
        const bill = bills.find((b) => b.id === id)
        setBills((all) => all.map((b: Bill) => (b.id === id ? { ...withNewPayer(b, payerId), recurrence } : b)))
        toast(bill && payerId !== bill.payerId && payerId === me.id ? `You’re now paying ${bill.name.toLowerCase()} for everyone` : 'Settings saved')
      },
      fetchBills: async (from, to) => bills.filter((b) => b.dueDate >= from && b.dueDate <= to),
      completeChore: (id) => {
        const chore = chores.find((c) => c.id === id)
        setChores((all) => all.map((c) => (c.id === id ? { ...c, doneAt: now() } : c)))
        toast(chore?.assigneeId === me.id ? `Nice work, ${me.name}! 🎉` : 'Marked as done')
      },
      reopenChore: (id) => setChores((all) => all.map((c) => (c.id === id ? { ...c, doneAt: null } : c))),
      addChore: (n) => {
        setChores((all) => [...all, { id: `chore-${Date.now()}`, doneAt: null, createdBy: me.id, ...n }])
        toast(`${n.title} added`)
      },
      deleteChore: async (id) => {
        setChores((all) => all.filter((c) => c.id !== id))
        toast('Chore deleted')
        return null
      },
      saveProfile: async (edit) => {
        setMembers((all) =>
          all.map((m) => (m.id === me.id ? { ...m, name: edit.displayName, fullName: edit.fullName, etransfer: edit.etransfer } : m)),
        )
        toast('Profile saved')
        return null
      },
      saveSettings: (change) => {
        if (change.theme) onTheme(change.theme)
        setNotify((n) => ({ ...n, ...Object.fromEntries(Object.entries(change).filter(([k]) => k !== 'theme')) }))
      },
      markRemindersRead: () => setReminders((all) => all.map((r) => ({ ...r, read: true }))),
      leaveHousehold: async () => {
        toast('In the demo you can’t really leave')
        return null
      },
      removeMember: async (memberId) => {
        setMembers((all) => all.filter((m) => m.id !== memberId))
        toast('Removed from the household')
        return null
      },
      resetInvite: async () => {
        setInviteCode(demoCode())
        toast('Link reset. The old link no longer works.')
      },
      decideRequest: async (requestId, approve) => {
        const req = joinRequests.find((r) => r.id === requestId)
        setJoinRequests((all) => all.filter((r) => r.id !== requestId))
        if (!req) return
        if (approve) {
          setMembers((all) => [...all, { id: req.userId, name: req.name, hue: req.hue, role: 'member', email: req.email ?? undefined }])
          toast(`${req.name} joined the household 🎉`)
        } else {
          toast(`Request from ${req.name} declined`)
        }
      },
    }
  }, [bills, chores, members, me, toast, joinRequests, onTheme])

  const house: House = {
    mode: 'demo',
    household: { id: 'demo', name: 'Weber street household', timezone: TIMEZONE, currency: 'CAD' },
    me,
    members,
    today,
    bills,
    chores,
    inviteCode,
    settings: { theme, ...notify },
    isAdmin: true,
    joinRequests,
    reminders,
    remindedToday: reminded,
    actions,
  }

  return <HouseContext.Provider value={house}>{children}</HouseContext.Provider>
}
