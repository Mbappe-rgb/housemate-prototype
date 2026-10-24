import { useMemo, useState, type ReactNode } from 'react'
import { HouseContext, type House, type HouseActions, type NewBill } from './house'
import { DEMO_MEMBERS, demoBills, demoChores, type DemoState } from './demoData'
import { withNewPayer, type Bill } from '../../lib/bills'
import { splitEqual } from '../../lib/money'
import { todayIn } from '../../lib/dates'
import { useToast } from '../../components/Toast'

const TIMEZONE = 'America/Toronto'

/** The prototype's sample household. Everything happens in memory and resets on reload. */
export function DemoHouseProvider({ state, children }: { state: DemoState; children: ReactNode }) {
  const today = todayIn(TIMEZONE)
  const toast = useToast()
  const [loadedState, setLoadedState] = useState(state)
  const [bills, setBills] = useState(() => demoBills(today, state))
  const [chores, setChores] = useState(() => demoChores(today))
  const [members, setMembers] = useState(DEMO_MEMBERS)
  const me = members[0]

  // Reload the sample data when the data state changes in the demo controls
  if (loadedState !== state) {
    setLoadedState(state)
    setBills(demoBills(today, state))
    setChores(demoChores(today))
  }

  const actions = useMemo<HouseActions>(() => {
    const updateBill = (id: string, fn: (b: Bill) => Bill) => setBills((all) => all.map((b) => (b.id === id ? fn(b) : b)))
    const setPaid = (b: Bill, memberId: string, paidAt: string | null): Bill => ({
      ...b,
      shares: { ...b.shares, [memberId]: { ...b.shares[memberId], paidAt } },
    })
    return {
      markPaid: (id, receiptName) => {
        updateBill(id, (b) => ({ ...setPaid(b, me.id, new Date().toISOString()), receiptName: receiptName ?? null }))
        toast(`${bills.find((b) => b.id === id)?.name ?? 'Bill'} marked as paid`)
      },
      undoPaid: (id) => updateBill(id, (b) => ({ ...setPaid(b, me.id, null), receiptName: null })),
      markReceived: (id, memberId) => updateBill(id, (b) => setPaid(b, memberId, new Date().toISOString())),
      addBill: (n: NewBill) => {
        const equal = splitEqual(n.totalCents, members.length)
        const shares = Object.fromEntries(
          members.map((m, i) => [
            m.id,
            { amountCents: n.splitMode === 'equal' ? equal[i] : (n.amounts[m.id] ?? 0), paidAt: null },
          ]),
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
      saveSplit: (id, mode, amounts) => {
        updateBill(id, (b) => {
          const equal = splitEqual(b.totalCents, members.length)
          const shares = Object.fromEntries(
            members.map((m, i) => [
              m.id,
              { ...b.shares[m.id], amountCents: mode === 'equal' ? equal[i] : (amounts[m.id] ?? 0) },
            ]),
          )
          return { ...b, splitMode: mode, shares }
        })
        toast('Split updated')
      },
      saveBillSettings: (id, payerId, recurrence) => {
        const bill = bills.find((b) => b.id === id)
        updateBill(id, (b) => ({ ...withNewPayer(b, payerId), recurrence }))
        toast(
          bill && payerId !== bill.payerId && payerId === me.id
            ? `You’re now paying ${bill.name.toLowerCase()} for everyone`
            : 'Settings saved',
        )
      },
      completeChore: (id) => {
        const chore = chores.find((c) => c.id === id)
        setChores((all) => all.map((c) => (c.id === id ? { ...c, doneAt: new Date().toISOString() } : c)))
        toast(chore?.assigneeId === me.id ? `Nice work, ${me.name}! 🎉` : 'Marked as done')
      },
      reopenChore: (id) => setChores((all) => all.map((c) => (c.id === id ? { ...c, doneAt: null } : c))),
      addChore: (n) => {
        setChores((all) => [...all, { id: `chore-${Date.now()}`, doneAt: null, ...n }])
        toast(`${n.title} added`)
      },
      saveProfile: async (edit) => {
        setMembers((all) =>
          all.map((m) =>
            m.id === me.id
              ? { ...m, name: edit.displayName, etransferEmail: edit.etransferEmail, phone: edit.phone, bankName: edit.bankName }
              : m,
          ),
        )
        toast('Profile saved')
        return null
      },
      leaveHousehold: () => toast('In the demo you can’t really leave'),
    }
  }, [bills, chores, members, me, toast])

  const house: House = {
    mode: 'demo',
    household: { id: 'demo', name: 'Weber street household', timezone: TIMEZONE, currency: 'CAD' },
    me,
    members,
    today,
    bills,
    chores,
    inviteCode: 'WEBR7K4QM2XP',
    moneyReady: true,
    actions,
  }

  return <HouseContext.Provider value={house}>{children}</HouseContext.Provider>
}
