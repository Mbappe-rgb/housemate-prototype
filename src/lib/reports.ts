// Reports (v5 "statements" pattern): turn bills into payment records, totals and a CSV.
import { statusOf, type Bill } from './bills'
import { monthName, shortDate, yearMonth, type ISODate } from './dates'

export type Scope = 'personal' | 'household'

export type ReportRecord = {
  bill: Bill
  amountCents: number
  date: ISODate
  /** "Paid the bill", "Paid your share", "Sent your share", "Paid by Ola" */
  kind: string
  /** household view: people settled out of everyone on the bill */
  settled?: number
  people?: number
  receipt: boolean
}

/**
 * Personal: what I paid (bills I paid the provider for count in full; shares I sent or that were confirmed).
 * Household: every bill whose provider has been paid.
 */
export function reportRecords(bills: Bill[], scope: Scope, me: string, nameOf: (id: string) => string): ReportRecord[] {
  const out: ReportRecord[] = []
  for (const bill of bills) {
    if (scope === 'personal') {
      const share = bill.shares[me]
      if (!share) continue
      if (bill.payerId === me) {
        if (!share.paidAt) continue
        out.push({ bill, amountCents: bill.totalCents, date: bill.dueDate, kind: 'Paid the bill', receipt: !!share.receiptPath })
      } else {
        const st = statusOf(bill, me)
        if (st === 'unpaid') continue
        out.push({ bill, amountCents: share.amountCents, date: bill.dueDate, kind: st === 'paid' ? 'Paid your share' : 'Sent your share', receipt: !!share.receiptPath })
      }
    } else {
      if (!bill.shares[bill.payerId]?.paidAt) continue
      const people = Object.keys(bill.shares)
      out.push({
        bill,
        amountCents: bill.totalCents,
        date: bill.dueDate,
        kind: `Paid by ${nameOf(bill.payerId)}`,
        settled: people.filter((id) => id === bill.payerId || statusOf(bill, id) === 'paid').length,
        people: people.length,
        receipt: Object.values(bill.shares).some((s) => s.receiptPath),
      })
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function filterRecords(records: ReportRecord[], billNames: string[] | null, query: string): ReportRecord[] {
  const q = query.trim().toLowerCase()
  return records.filter(
    (r) => (!billNames || billNames.includes(r.bill.name)) && (!q || `${r.bill.name} ${r.kind}`.toLowerCase().includes(q)),
  )
}

export function sumRecords(records: ReportRecord[]): number {
  return records.reduce((s, r) => s + r.amountCents, 0)
}

/** Totals grouped by a key, in first-seen order. */
function groupSum(records: ReportRecord[], key: (r: ReportRecord) => string): [string, number][] {
  const map = new Map<string, number>()
  for (const r of records) map.set(key(r), (map.get(key(r)) ?? 0) + r.amountCents)
  return [...map.entries()]
}

export const byBill = (records: ReportRecord[]) => groupSum(records, (r) => r.bill.name)

export function monthLabel(d: ISODate): string {
  const { year, month } = yearMonth(d)
  return `${monthName(month)} ${year}`
}

export const byMonth = (records: ReportRecord[]) => groupSum(records, (r) => monthLabel(r.date))

/** Household view: per housemate, what they paid, the bills they fronted, and what they still owe. */
export function byHousemate(records: ReportRecord[], people: string[]) {
  return people.map((id) => {
    let paid = 0
    let owes = 0
    let frontedCount = 0
    let frontedTotal = 0
    for (const r of records) {
      const s = r.bill.shares[id]
      if (r.bill.payerId === id) {
        frontedCount++
        frontedTotal += r.bill.totalCents
      }
      if (!s) continue
      if (r.bill.payerId === id || statusOf(r.bill, id) === 'paid') paid += s.amountCents
      else owes += s.amountCents
    }
    return { id, paid, owes, frontedCount, frontedTotal }
  })
}

/** CSV with the same columns as the prototype. */
export function toCsv(records: ReportRecord[], scope: Scope, people: string[], nameOf: (id: string) => string): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`
  const date = (d: ISODate) => `${shortDate(d)} ${d.slice(0, 4)}`
  if (scope === 'personal') {
    const rows = records.map((r) => [q(date(r.date)), q(r.bill.name), q(r.kind === 'Paid the bill' ? 'Provider' : nameOf(r.bill.payerId)), q(r.kind), centsToMoney(r.amountCents)].join(','))
    return ['Date,Bill,Paid to,Type,Amount', ...rows].join('\n')
  }
  const head = ['Date', 'Bill', 'Paid by', 'Total', ...people.map((p) => `${nameOf(p)} share paid`)].join(',')
  const rows = records.map((r) =>
    [
      q(date(r.date)),
      q(r.bill.name),
      q(nameOf(r.bill.payerId)),
      centsToMoney(r.amountCents),
      ...people.map((p) => {
        const s = r.bill.shares[p]
        return centsToMoney(s && (p === r.bill.payerId || statusOf(r.bill, p) === 'paid') ? s.amountCents : 0)
      }),
    ].join(','),
  )
  return [head, ...rows].join('\n')
}

const centsToMoney = (c: number) => (c / 100).toFixed(2)

