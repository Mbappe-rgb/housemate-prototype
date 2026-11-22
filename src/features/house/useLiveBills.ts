import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { friendlyHouseholdError } from '../../lib/householdErrors'
import { addDays, yearMonth, type ISODate } from '../../lib/dates'
import type { Bill, Share } from '../../lib/bills'
import type { HouseActions, NewBill } from './house'
import { ReceiptError, uploadReceipt } from '../../lib/receipts'

// Live updates arrive through Realtime; this slower re-load is a backup (and runs when the app comes back).
const POLL_MS = 60_000

type BillActions = Pick<
  HouseActions,
  | 'markSent'
  | 'undoSent'
  | 'payProvider'
  | 'undoProvider'
  | 'confirmShare'
  | 'markUnpaid'
  | 'addBill'
  | 'deleteBill'
  | 'saveSplit'
  | 'saveBillSettings'
  | 'fetchBills'
>

type Row = {
  id: string
  name: string
  category: string
  emoji: string | null
  total_cents: number
  due_date: string
  payer_id: string | null
  created_by: string | null
  recurrence: string
  split_mode: string
  bill_shares: { user_id: string; amount_cents: number; sent_at: string | null; paid_at: string | null; receipt_path: string | null }[]
}

const SELECT =
  'id, name, category, emoji, total_cents, due_date, payer_id, created_by, recurrence, split_mode, bill_shares(user_id, amount_cents, sent_at, paid_at, receipt_path)'

function toBill(r: Row): Bill {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    emoji: r.emoji ?? '🧾',
    totalCents: r.total_cents,
    dueDate: r.due_date,
    payerId: r.payer_id ?? '',
    createdBy: r.created_by ?? '',
    recurrence: r.recurrence === 'monthly' ? 'monthly' : 'none',
    splitMode: r.split_mode === 'custom' ? 'custom' : 'equal',
    shares: Object.fromEntries(
      r.bill_shares.map((s) => [s.user_id, { amountCents: s.amount_cents, sentAt: s.sent_at, paidAt: s.paid_at, receiptPath: s.receipt_path }]),
    ),
  }
}

/** Bills shown in the app: this month's, plus older ones someone still owes on. */
function isCurrent(bill: Bill, today: ISODate): boolean {
  const { year, month } = yearMonth(today)
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  return bill.dueDate >= monthStart || Object.values(bill.shares).some((s) => s.paidAt === null)
}

/** Live bills for a household, with every bill action going through the database functions. */
export function useLiveBills(householdId: string | null, meId: string | undefined, today: ISODate, toast: (m: string) => void) {
  const [bills, setBills] = useState<Bill[] | null>(null)

  const reload = useCallback(async () => {
    if (!householdId) return
    // Look back far enough to catch anything still unpaid from earlier months
    const { data, error } = await supabase
      .from('bills')
      .select(SELECT)
      .eq('household_id', householdId)
      .gte('due_date', addDays(today, -120))
      .order('due_date')
    if (error) return
    setBills((data as Row[]).map(toBill))
  }, [householdId, today])

  // First load: add any monthly bills that are due for a new copy, then read
  useEffect(() => {
    if (!householdId) return
    let alive = true
    void (async () => {
      await supabase.rpc('roll_recurring_bills', { p_household: householdId })
      if (alive) await reload()
    })()
    return () => {
      alive = false
    }
  }, [householdId, reload])

  useEffect(() => {
    if (!householdId) return
    const tick = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    const timer = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [householdId, reload])

  const actions = useMemo<BillActions>(() => {
    const name = (id: string) => bills?.find((b) => b.id === id)?.name ?? 'Bill'

    /** Show the change right away, then save; if saving fails, reload and explain. */
    const run = async (call: () => PromiseLike<{ error: { message?: string } | null }>, optimistic?: (all: Bill[]) => Bill[], ok?: string) => {
      if (optimistic) setBills((all) => (all ? optimistic(all) : all))
      const { error } = await call()
      if (error) toast(friendlyHouseholdError(error))
      else if (ok) toast(ok)
      await reload()
      return error ? friendlyHouseholdError(error) : null
    }
    const setShare = (billId: string, userId: string, change: Partial<Share>) => (all: Bill[]) =>
      all.map((b) => (b.id === billId && b.shares[userId] ? { ...b, shares: { ...b.shares, [userId]: { ...b.shares[userId], ...change } } } : b))
    const now = () => new Date().toISOString()

    /** Upload the receipt first, so a failed upload doesn't leave a half-done payment. */
    const withReceipt = async (billId: string, receipt: File | null | undefined, save: () => Promise<string | null>, ok: string) => {
      if (!meId || !householdId) return
      let path: string | null = null
      if (receipt) {
        try {
          path = await uploadReceipt(householdId, billId, meId, receipt)
        } catch (e) {
          toast(e instanceof ReceiptError ? e.message : 'The receipt didn’t upload. Please try again.')
          return
        }
      }
      const error = await save()
      if (error) return
      if (path) await run(() => supabase.rpc('attach_receipt', { p_bill: billId, p_path: path }), undefined, `${ok}, receipt attached`)
      else toast(ok)
    }

    return {
      markSent: (billId, receipt) => {
        if (!meId) return
        void withReceipt(
          billId,
          receipt,
          () => run(() => supabase.rpc('mark_share_sent', { p_bill: billId, p_sent: true }), setShare(billId, meId, { sentAt: now() })),
          'Marked as paid. Waiting for the payer to confirm',
        )
      },
      undoSent: (billId) => {
        if (!meId) return
        void run(() => supabase.rpc('mark_share_sent', { p_bill: billId, p_sent: false }), setShare(billId, meId, { sentAt: null }))
      },
      payProvider: (billId, receipt) => {
        if (!meId) return
        void withReceipt(
          billId,
          receipt,
          () => run(() => supabase.rpc('set_share_paid', { p_bill: billId, p_user: meId, p_paid: true }), setShare(billId, meId, { paidAt: now() })),
          `${name(billId)} marked as paid`,
        )
      },
      undoProvider: (billId) => {
        if (!meId) return
        void run(() => supabase.rpc('set_share_paid', { p_bill: billId, p_user: meId, p_paid: false }), setShare(billId, meId, { paidAt: null }))
      },
      confirmShare: (billId, memberId) => {
        void run(
          () => supabase.rpc('set_share_paid', { p_bill: billId, p_user: memberId, p_paid: true }),
          setShare(billId, memberId, { paidAt: now() }),
          'Payment confirmed',
        )
      },
      markUnpaid: (billId, memberId) => {
        void run(
          () => supabase.rpc('set_share_paid', { p_bill: billId, p_user: memberId, p_paid: false }),
          setShare(billId, memberId, { paidAt: null, sentAt: null }),
        )
      },
      addBill: (n: NewBill) => {
        if (!householdId) return
        void run(
          () =>
            supabase.rpc('create_bill', {
              p_household: householdId,
              p_name: n.name,
              p_category: n.category,
              p_emoji: n.emoji,
              p_total_cents: n.totalCents,
              p_due_date: n.dueDate,
              p_payer: n.payerId,
              p_recurrence: n.recurrence,
              p_split_mode: n.splitMode,
              ...(n.splitMode === 'custom' ? { p_amounts: n.amounts } : {}),
            }),
          undefined,
          `${n.name} added`,
        )
      },
      deleteBill: (billId) => run(() => supabase.rpc('delete_bill', { p_bill: billId }), (all) => all.filter((b) => b.id !== billId), 'Bill deleted'),
      saveSplit: (billId, mode, amounts) => {
        void run(
          () => supabase.rpc('update_bill_split', { p_bill: billId, p_split_mode: mode, ...(mode === 'custom' ? { p_amounts: amounts } : {}) }),
          undefined,
          'Split updated',
        )
      },
      saveBillSettings: (billId, payerId, recurrence) => {
        const bill = bills?.find((b) => b.id === billId)
        const payerChanged = bill && bill.payerId !== payerId
        void run(
          () => supabase.rpc('update_bill_settings', { p_bill: billId, p_payer: payerId, p_recurrence: recurrence }),
          undefined,
          payerChanged && payerId === meId ? `You’re now paying ${name(billId).toLowerCase()} for everyone` : 'Settings saved',
        )
      },
      fetchBills: async (from, to) => {
        if (!householdId) return []
        const { data, error } = await supabase
          .from('bills')
          .select(SELECT)
          .eq('household_id', householdId)
          .gte('due_date', from)
          .lte('due_date', to)
          .order('due_date')
        if (error) {
          toast('We couldn’t load that period. Please try again.')
          return []
        }
        return (data as Row[]).map(toBill)
      },
    }
  }, [bills, meId, householdId, reload, toast])

  const visible = useMemo(() => (bills ? bills.filter((b) => isCurrent(b, today)) : null), [bills, today])

  return { bills: visible, actions, reload }
}
