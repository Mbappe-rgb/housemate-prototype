import { describe, expect, it } from 'vitest'
import { billView, relLabel } from './billView'
import type { Bill, Share } from './bills'

const T = '2026-11-01T12:00:00Z'
const s = (amountCents: number, state: 'unpaid' | 'sent' | 'paid' = 'unpaid'): Share => ({
  amountCents,
  sentAt: state === 'unpaid' ? null : T,
  paidAt: state === 'paid' ? T : null,
})
const names: Record<string, string> = { me: 'You', ola: 'Ola', ben: 'Bankole', dave: 'Dave' }
const nameOf = (id: string) => names[id]
const today = '2026-11-11'

// Internet: Ola pays, $480 split four ways ($120 each)
const internet = (shares: Partial<Record<string, Share>>, extra: Partial<Bill> = {}): Bill => ({
  id: 'internet',
  name: 'Internet',
  category: 'Internet',
  emoji: '🌐',
  totalCents: 48000,
  dueDate: '2026-11-14',
  payerId: 'ola',
  createdBy: 'ola',
  recurrence: 'monthly',
  splitMode: 'equal',
  shares: { me: s(12000), ola: s(12000), ben: s(12000), dave: s(12000), ...shares } as Record<string, Share>,
  ...extra,
})

describe('billView as a housemate', () => {
  it('asks me to send my share', () => {
    const v = billView(internet({}), 'me', today, nameOf)
    expect(v.head).toBe('You owe')
    expect(v.amountCents).toBe(12000)
    expect(v.status).toBe('Due Nov 14, in 3 days')
    expect(v.cardAction).toBe('pay')
    expect(v.cardStatus).toBe('Due Sat, Nov 14')
    expect(v.pinned).toEqual({ kind: 'pay', text: 'Send $120 to Ola' })
  })
  it('waits for the payer after I send', () => {
    const v = billView(internet({ me: s(12000, 'sent') }), 'me', today, nameOf)
    expect(v.head).toBe('You sent')
    expect(v.status).toBe('Waiting for Ola to confirm')
    expect(v.tone).toBe('wait')
    expect(v.pinned).toEqual({ kind: 'waiting', text: 'Waiting for Ola' })
    expect(v.cardAction).toBe('paid')
  })
  it('shows paid once confirmed', () => {
    const v = billView(internet({ me: s(12000, 'paid') }), 'me', today, nameOf)
    expect(v.head).toBe('You paid')
    expect(v.status).toBe('Paid')
    expect(v.pinned).toBeNull()
  })
  it('flags overdue bills', () => {
    const v = billView(internet({}, { dueDate: '2026-11-05' }), 'me', today, nameOf)
    expect(v.status).toBe('Overdue since Nov 5')
    expect(v.tone).toBe('late')
    expect(v.cardStatus).toBe('Past due')
  })
})

describe('billView as the payer', () => {
  const asOla = (shares: Partial<Record<string, Share>>) => billView(internet(shares), 'ola', today, nameOf)
  it('asks me to pay the provider first', () => {
    const v = asOla({})
    expect(v.head).toBe('You’re paying')
    expect(v.amountCents).toBe(48000)
    expect(v.pinned).toEqual({ kind: 'payProvider', text: 'Pay $480 for internet' })
    expect(v.cardAction).toBe('confirm')
  })
  it('asks me to confirm one payment', () => {
    const v = asOla({ ola: s(12000, 'paid'), ben: s(12000, 'sent') })
    expect(v.pinned).toEqual({ kind: 'confirm', text: '1 payment to confirm', memberId: 'ben' })
    expect(v.cardStatus).toBe('1 to confirm')
    expect(v.cardAction).toBe('confirm')
  })
  it('asks me to review several', () => {
    const v = asOla({ ola: s(12000, 'paid'), ben: s(12000, 'sent'), dave: s(12000, 'sent') })
    expect(v.pinned).toEqual({ kind: 'review', text: '2 payments to confirm' })
  })
  it('offers a reminder for unpaid housemates', () => {
    const v = asOla({ ola: s(12000, 'paid'), ben: s(12000, 'paid') })
    expect(v.pinned).toEqual({ kind: 'remind', text: '2 housemates unpaid', reminded: false })
    expect(v.status).toBe('Waiting on 2 housemates')
    const reminded = billView(internet({ ola: s(12000, 'paid'), ben: s(12000, 'paid') }), 'ola', today, nameOf, () => true)
    expect(reminded.pinned).toMatchObject({ reminded: true })
  })
  it('is all settled when everyone is confirmed', () => {
    const v = asOla({ ola: s(12000, 'paid'), ben: s(12000, 'paid'), dave: s(12000, 'paid'), me: s(12000, 'paid') })
    expect(v.status).toBe('All settled')
    expect(v.tone).toBe('ok')
    expect(v.pinned).toBeNull()
    expect(v.cardAction).toBe('paid')
  })
})

describe('relLabel', () => {
  it('reads like the prototype', () => {
    expect(relLabel('2026-11-10', today)).toBe('Past due')
    expect(relLabel('2026-11-11', today)).toBe('Due today')
    expect(relLabel('2026-11-12', today)).toBe('Due tomorrow')
    expect(relLabel('2026-11-18', today)).toBe('Due Wed, Nov 18')
  })
})
