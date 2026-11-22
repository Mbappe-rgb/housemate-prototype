import type { TileStatus } from '../../components/Avatar'
import { statusOf, type Bill } from '../../lib/bills'
import { daysBetween, weekday } from '../../lib/dates'
import { nameFor, type House } from '../house/house'

/** Every person on the bill, payer included, with their payment status. */
export function tileStatus(bill: Bill, memberId: string): TileStatus {
  if (memberId === bill.payerId) return bill.shares[memberId]?.paidAt ? 'payer-paid' : 'payer-unpaid'
  return statusOf(bill, memberId)
}

export function tileLabel(house: House, bill: Bill, memberId: string): string {
  const who = nameFor(house, memberId)
  const s = tileStatus(bill, memberId)
  if (s === 'payer-paid') return `${who}, paying, paid the provider`
  if (s === 'payer-unpaid') return `${who}, paying the bill`
  return `${who}, ${s}`
}

export function remindedFn(house: House, billId: string) {
  const list = house.remindedToday[billId] ?? []
  return (memberId: string) => list.includes(memberId)
}

/** "Today", "Tomorrow", "Overdue" or the weekday. */
export function choreDay(due: string, today: string): string {
  const diff = daysBetween(today, due)
  if (diff < 0) return 'Overdue'
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return weekday(due)
}
