import { describe, expect, it } from 'vitest'
import { byBill, byHousemate, byMonth, filterRecords, reportRecords, sumRecords, toCsv } from './reports'
import type { Bill, Share } from './bills'

const T = '2026-10-01T00:00:00Z'
const s = (amountCents: number, st: 'unpaid' | 'sent' | 'paid' = 'unpaid', receipt = false): Share => ({
  amountCents,
  sentAt: st === 'unpaid' ? null : T,
  paidAt: st === 'paid' ? T : null,
  receiptPath: receipt ? 'h/b/me-1.jpg' : null,
})
const bill = (id: string, name: string, dueDate: string, payerId: string, shares: Record<string, Share>): Bill => ({
  id,
  name,
  category: 'Other',
  emoji: '🧾',
  totalCents: Object.values(shares).reduce((t, x) => t + x.amountCents, 0),
  dueDate,
  payerId,
  createdBy: payerId,
  recurrence: 'none',
  splitMode: 'equal',
  shares,
})
const names: Record<string, string> = { me: 'You', ola: 'Ola', ben: 'Ben' }
const nameOf = (id: string) => names[id]

const bills = [
  // Ola paid rent; I paid my share (confirmed, with a receipt); Ben still owes
  bill('r', 'Rent', '2026-11-01', 'ola', { me: s(100000, 'paid', true), ola: s(100000, 'paid'), ben: s(100000) }),
  // I pay hydro and paid the provider
  bill('h', 'Hydro', '2026-10-20', 'me', { me: s(6000, 'paid'), ola: s(6000, 'sent'), ben: s(6000, 'paid') }),
  // Internet: Ben pays but hasn't paid the provider; I sent my share
  bill('i', 'Internet', '2026-10-14', 'ben', { me: s(4000, 'sent'), ola: s(4000), ben: s(4000) }),
]

describe('personal report', () => {
  const recs = reportRecords(bills, 'personal', 'me', nameOf)
  it('lists what I paid, newest first', () => {
    expect(recs.map((r) => [r.bill.name, r.amountCents, r.kind])).toEqual([
      ['Rent', 100000, 'Paid your share'],
      ['Hydro', 18000, 'Paid the bill'],
      ['Internet', 4000, 'Sent your share'],
    ])
    expect(sumRecords(recs)).toBe(122000)
    expect(recs.filter((r) => r.receipt)).toHaveLength(1)
  })
  it('groups by bill and month', () => {
    expect(byBill(recs)).toEqual([
      ['Rent', 100000],
      ['Hydro', 18000],
      ['Internet', 4000],
    ])
    expect(byMonth(recs)).toEqual([
      ['November 2026', 100000],
      ['October 2026', 22000],
    ])
  })
  it('filters by bill and search', () => {
    expect(filterRecords(recs, ['Rent', 'Hydro'], '').map((r) => r.bill.name)).toEqual(['Rent', 'Hydro'])
    expect(filterRecords(recs, null, 'sent').map((r) => r.bill.name)).toEqual(['Internet'])
  })
  it('exports CSV', () => {
    expect(toCsv(recs, 'personal', [], nameOf).split('\n')).toEqual([
      'Date,Bill,Paid to,Type,Amount',
      '"Nov 1 2026","Rent","Ola","Paid your share",1000.00',
      '"Oct 20 2026","Hydro","Provider","Paid the bill",180.00',
      '"Oct 14 2026","Internet","Ben","Sent your share",40.00',
    ])
  })
})

describe('household report', () => {
  const recs = reportRecords(bills, 'household', 'me', nameOf)
  it('lists bills whose provider is paid, with settled counts', () => {
    expect(recs.map((r) => [r.bill.name, r.kind, r.settled, r.people])).toEqual([
      ['Rent', 'Paid by Ola', 2, 3],
      ['Hydro', 'Paid by You', 2, 3],
    ])
  })
  it('totals per housemate', () => {
    const rows = byHousemate(recs, ['me', 'ola', 'ben'])
    expect(rows).toEqual([
      { id: 'me', paid: 106000, owes: 0, frontedCount: 1, frontedTotal: 18000 },
      { id: 'ola', paid: 100000, owes: 6000, frontedCount: 1, frontedTotal: 300000 },
      { id: 'ben', paid: 6000, owes: 100000, frontedCount: 0, frontedTotal: 0 },
    ])
  })
  it('exports a column per housemate', () => {
    const csv = toCsv(recs, 'household', ['me', 'ola', 'ben'], nameOf).split('\n')
    expect(csv[0]).toBe('Date,Bill,Paid by,Total,You share paid,Ola share paid,Ben share paid')
    expect(csv[1]).toBe('"Nov 1 2026","Rent","Ola",3000.00,1000.00,1000.00,0.00')
  })
})
