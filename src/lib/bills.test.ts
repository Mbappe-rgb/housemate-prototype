import { describe, expect, it } from 'vitest'
import {
  amountOwed,
  doneCount,
  isSplitLocked,
  isTodo,
  othersPaid,
  pastDue,
  toPay,
  withNewPayer,
  type Bill,
} from './bills'

const paid = '2026-10-01T12:00:00Z'

function bill(partial: Partial<Bill> & Pick<Bill, 'id' | 'payerId' | 'shares'>): Bill {
  return {
    name: partial.id,
    category: 'Other',
    emoji: '🧾',
    totalCents: Object.values(partial.shares).reduce((s, x) => s + x.amountCents, 0),
    dueDate: '2026-10-15',
    createdBy: partial.payerId,
    recurrence: 'none',
    splitMode: 'equal',
    ...partial,
  }
}

// Me, Ben and Cleo. Ben pays rent, I pay water.
const rent = bill({
  id: 'rent',
  payerId: 'ben',
  dueDate: '2026-10-15',
  shares: {
    me: { amountCents: 100000, paidAt: null },
    ben: { amountCents: 100000, paidAt: null },
    cleo: { amountCents: 100000, paidAt: paid },
  },
})
const internet = bill({
  id: 'internet',
  payerId: 'cleo',
  dueDate: '2026-10-03',
  shares: {
    me: { amountCents: 2667, paidAt: null },
    ben: { amountCents: 2667, paidAt: paid },
    cleo: { amountCents: 2666, paidAt: null },
  },
})
const water = bill({
  id: 'water',
  payerId: 'me',
  dueDate: '2026-10-20',
  shares: {
    me: { amountCents: 2400, paidAt: paid },
    ben: { amountCents: 2400, paidAt: null },
    cleo: { amountCents: 2400, paidAt: null },
  },
})
const bills = [rent, internet, water]
const today = '2026-10-07'

describe('who owes what', () => {
  it('knows what I still need to do', () => {
    expect(isTodo(rent, 'me')).toBe(true)
    expect(isTodo(water, 'me')).toBe(false) // I paid the provider
    expect(isTodo(rent, 'stranger')).toBe(false)
  })
  it('lists bills to pay, soonest first', () => {
    expect(toPay(bills, 'me').map((b) => b.id)).toEqual(['internet', 'rent'])
  })
  it('adds up what I owe housemates', () => {
    expect(amountOwed(bills, 'me')).toBe(102667)
    // Ben pays the rent provider himself (not owed to anyone) and has paid internet,
    // so he only owes me his water share
    expect(amountOwed(bills, 'ben')).toBe(2400)
  })
  it('finds past-due bills', () => {
    expect(pastDue(bills, 'me', today).map((b) => b.id)).toEqual(['internet'])
  })
  it('counts finished bills', () => {
    expect(doneCount(bills, 'me')).toBe(1)
    expect(doneCount(bills, 'cleo')).toBe(1)
  })
})

describe('split lock and payer change', () => {
  it('locks the split once a non-payer has paid', () => {
    expect(isSplitLocked(rent)).toBe(true)
    expect(isSplitLocked(water)).toBe(false) // only the payer's own row is paid
    expect(othersPaid(internet)).toBe(1)
  })
  it('clears every paid mark when the payer changes', () => {
    const changed = withNewPayer(rent, 'me')
    expect(changed.payerId).toBe('me')
    expect(Object.values(changed.shares).every((s) => s.paidAt === null)).toBe(true)
    expect(withNewPayer(rent, 'ben')).toBe(rent)
  })
})
