import { describe, expect, it } from 'vitest'
import {
  amountOwed,
  amountOwedToMe,
  balanceWith,
  doneCount,
  isSplitLocked,
  isTodo,
  othersPaid,
  pastDue,
  settledCount,
  statusOf,
  toConfirm,
  toPay,
  withNewPayer,
  type Bill,
  type Share,
} from './bills'

const T = '2026-10-01T12:00:00Z'
const unpaid = (amountCents: number): Share => ({ amountCents, sentAt: null, paidAt: null })
const sent = (amountCents: number): Share => ({ amountCents, sentAt: T, paidAt: null })
const paid = (amountCents: number): Share => ({ amountCents, sentAt: T, paidAt: T })

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

// Me, Ben and Cleo. Ben pays rent, Cleo pays internet, I pay water.
const rent = bill({
  id: 'rent',
  payerId: 'ben',
  shares: { me: unpaid(100000), ben: unpaid(100000), cleo: paid(100000) },
})
const internet = bill({
  id: 'internet',
  payerId: 'cleo',
  dueDate: '2026-10-03',
  shares: { me: unpaid(2667), ben: sent(2667), cleo: unpaid(2666) },
})
const water = bill({
  id: 'water',
  payerId: 'me',
  dueDate: '2026-10-20',
  shares: { me: paid(2400), ben: sent(2400), cleo: unpaid(2400) },
})
const bills = [rent, internet, water]
const today = '2026-10-07'

describe('payment states', () => {
  it('moves Unpaid -> Sent -> Paid', () => {
    expect(statusOf(internet, 'me')).toBe('unpaid')
    expect(statusOf(internet, 'ben')).toBe('sent')
    expect(statusOf(rent, 'cleo')).toBe('paid')
  })
  it('treats the payer’s own share as provider paid/unpaid, never sent', () => {
    expect(statusOf(water, 'me')).toBe('paid')
    expect(statusOf({ ...internet, shares: { ...internet.shares, cleo: sent(2666) } }, 'cleo')).toBe('unpaid')
  })
  it('lists payments the payer needs to confirm', () => {
    expect(toConfirm(water)).toEqual(['ben'])
    expect(toConfirm(rent)).toEqual([])
  })
})

describe('who owes what', () => {
  it('knows what I still need to do (sent is off my list)', () => {
    expect(isTodo(rent, 'me')).toBe(true)
    expect(isTodo(internet, 'ben')).toBe(false)
    expect(isTodo(water, 'me')).toBe(false)
    expect(isTodo(rent, 'stranger')).toBe(false)
  })
  it('lists bills to pay, soonest first', () => {
    expect(toPay(bills, 'me').map((b) => b.id)).toEqual(['internet', 'rent'])
  })
  it('adds up "You owe"', () => {
    expect(amountOwed(bills, 'me')).toBe(102667)
    // Ben pays rent's provider himself and has sent internet, so he owes only water
    expect(amountOwed(bills, 'ben')).toBe(0 + 0)
  })
  it('adds up "You are owed" until the payer confirms', () => {
    // Ben sent water (unconfirmed) and Cleo hasn't paid: both still owe me
    expect(amountOwedToMe(bills, 'me')).toBe(4800)
  })
  it('nets balances per housemate', () => {
    // Ben owes me 2400 (water), I owe Ben 100000 (rent)
    expect(balanceWith(bills, 'me', 'ben')).toBe(2400 - 100000)
    // Cleo owes me 2400 (water), I owe Cleo 2667 (internet)
    expect(balanceWith(bills, 'me', 'cleo')).toBe(2400 - 2667)
  })
  it('finds past-due bills', () => {
    expect(pastDue(bills, 'me', today).map((b) => b.id)).toEqual(['internet'])
  })
  it('counts finished bills', () => {
    expect(doneCount(bills, 'me')).toBe(1)
  })
  it('counts settled people, with the payer settled once the provider is paid', () => {
    expect(settledCount(water)).toEqual({ settled: 1, total: 3 })
    expect(settledCount(rent)).toEqual({ settled: 1, total: 3 })
  })
})

describe('split lock and payer change', () => {
  it('locks the split once a housemate has sent or paid', () => {
    expect(isSplitLocked(rent)).toBe(true) // Cleo paid
    expect(isSplitLocked(internet)).toBe(true) // Ben sent
    expect(isSplitLocked(bill({ id: 'x', payerId: 'me', shares: { me: paid(10), ben: unpaid(10) } }))).toBe(false)
    expect(othersPaid(internet)).toBe(0)
  })
  it('clears every payment when the payer changes', () => {
    const changed = withNewPayer(water, 'ben')
    expect(changed.payerId).toBe('ben')
    expect(Object.values(changed.shares).every((s) => s.paidAt === null && s.sentAt === null)).toBe(true)
    expect(withNewPayer(water, 'me')).toBe(water)
  })
})
