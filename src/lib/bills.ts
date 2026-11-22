// "Who owes what". Pure functions over bills, so the same rules work for demo and real data.
//
// A housemate's share moves Unpaid -> Sent -> Paid (docs/design/v5-screen-map.pdf, "payment states"):
//   Sent: they say they sent the e-transfer (sentAt).  Paid: the bill payer confirmed it (paidAt).
// For the payer's own share, paidAt means "I paid the provider".
import { daysBetween, type ISODate } from './dates'

export type Member = {
  id: string
  /** what housemates see ("Moyin") */
  name: string
  hue: number
  role?: 'owner' | 'member'
  email?: string
  fullName?: string | null
  /** one Interac e-Transfer detail: an email or a phone number */
  etransfer?: string | null
}

export type Share = {
  amountCents: number
  sentAt: string | null
  paidAt: string | null
  receiptPath?: string | null
}

export type Bill = {
  id: string
  name: string
  category: string
  emoji: string
  totalCents: number
  dueDate: ISODate
  payerId: string
  createdBy: string
  recurrence: 'none' | 'monthly'
  splitMode: 'equal' | 'custom'
  /** one per member */
  shares: Record<string, Share>
}

export type Chore = {
  id: string
  title: string
  emoji: string
  assigneeId: string
  dueDate: ISODate
  recurrence: 'none' | 'daily' | 'weekly'
  doneAt: string | null
  createdBy?: string
}

export type ShareStatus = 'paid' | 'sent' | 'unpaid'

/** My share of a bill (0 if I'm not on it). */
export function shareOf(bill: Bill, memberId: string): number {
  return bill.shares[memberId]?.amountCents ?? 0
}

export function statusOf(bill: Bill, memberId: string): ShareStatus {
  const s = bill.shares[memberId]
  if (!s) return 'paid'
  if (s.paidAt) return 'paid'
  if (s.sentAt && memberId !== bill.payerId) return 'sent'
  return 'unpaid'
}

/**
 * Something I still need to do: send my share, or (as payer) pay the provider.
 * Once I've sent my share it's off my list, even before the payer confirms.
 */
export function isTodo(bill: Bill, me: string): boolean {
  if (!bill.shares[me]) return false
  return statusOf(bill, me) === 'unpaid'
}

/** Housemates (not the payer). */
export function others(bill: Bill): string[] {
  return Object.keys(bill.shares).filter((id) => id !== bill.payerId)
}

export function othersCount(bill: Bill): number {
  return others(bill).length
}

/** Housemates (not the payer) whose share is confirmed. */
export function othersPaid(bill: Bill): number {
  return others(bill).filter((id) => statusOf(bill, id) === 'paid').length
}

/** Housemates who sent money the payer hasn't confirmed yet. */
export function toConfirm(bill: Bill): string[] {
  return others(bill).filter((id) => statusOf(bill, id) === 'sent')
}

/** Housemates who haven't sent or paid. */
export function stillUnpaid(bill: Bill): string[] {
  return others(bill).filter((id) => statusOf(bill, id) === 'unpaid')
}

/** "x/y settled": the payer counts once they've paid the provider. */
export function settledCount(bill: Bill): { settled: number; total: number } {
  const total = Object.keys(bill.shares).length
  const payerPaid = bill.shares[bill.payerId]?.paidAt ? 1 : 0
  return { settled: payerPaid + othersPaid(bill), total }
}

/** For the payer: what housemates owe in total, and how much of it is confirmed. */
export function splitTotals(bill: Bill): { collected: number; owedTotal: number } {
  const ids = others(bill)
  return {
    owedTotal: ids.reduce((sum, id) => sum + shareOf(bill, id), 0),
    collected: ids.filter((id) => statusOf(bill, id) === 'paid').reduce((sum, id) => sum + shareOf(bill, id), 0),
  }
}

export function isFullySettled(bill: Bill): boolean {
  const { settled, total } = settledCount(bill)
  return settled === total
}

/** The split can't change once anyone other than the payer has sent or paid. */
export function isSplitLocked(bill: Bill): boolean {
  return others(bill).some((id) => statusOf(bill, id) !== 'unpaid')
}

/** Who has sent or paid, for the "split is locked" message. */
export function whoActed(bill: Bill): string[] {
  return others(bill).filter((id) => statusOf(bill, id) !== 'unpaid')
}

export function sortByDue<T extends { dueDate: ISODate }>(items: T[]): T[] {
  return items.slice().sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
}

/** Bills I still need to act on, soonest first. */
export function toPay(bills: Bill[], me: string): Bill[] {
  return sortByDue(bills.filter((b) => isTodo(b, me)))
}

/** "You owe": my shares I haven't sent yet (not counting bills I pay the provider for). */
export function amountOwed(bills: Bill[], me: string): number {
  return toPay(bills, me)
    .filter((b) => b.payerId !== me)
    .reduce((sum, b) => sum + shareOf(b, me), 0)
}

/** What a housemate still owes me on bills I pay (sent but unconfirmed still counts). */
export function owedBy(bills: Bill[], me: string, member: string): number {
  if (member === me) return 0
  return bills
    .filter((b) => b.payerId === me && b.shares[member] && !b.shares[member].paidAt)
    .reduce((sum, b) => sum + shareOf(b, member), 0)
}

/** What I still owe a housemate on bills they pay (until they confirm). */
export function iOweTo(bills: Bill[], me: string, member: string): number {
  if (member === me) return 0
  return bills
    .filter((b) => b.payerId === member && b.shares[me] && !b.shares[me].paidAt)
    .reduce((sum, b) => sum + shareOf(b, me), 0)
}

/** "You are owed": everything housemates still owe me. */
export function amountOwedToMe(bills: Bill[], me: string): number {
  const people = new Set(bills.flatMap((b) => Object.keys(b.shares)))
  return [...people].reduce((sum, m) => sum + owedBy(bills, me, m), 0)
}

/** Net balance with one housemate: positive = they owe me, negative = I owe them. */
export function balanceWith(bills: Bill[], me: string, member: string): number {
  return owedBy(bills, me, member) - iOweTo(bills, me, member)
}

export function pastDue(bills: Bill[], me: string, today: ISODate): Bill[] {
  return toPay(bills, me).filter((b) => daysBetween(today, b.dueDate) < 0)
}

/** Bills I've finished my part of. */
export function doneCount(bills: Bill[], me: string): number {
  return bills.filter((b) => !isTodo(b, me)).length
}

/** Changing the payer clears every payment (also enforced by the database). */
export function withNewPayer(bill: Bill, payerId: string): Bill {
  if (payerId === bill.payerId) return bill
  const shares = Object.fromEntries(
    Object.entries(bill.shares).map(([id, s]) => [id, { ...s, paidAt: null, sentAt: null, receiptPath: null }]),
  )
  return { ...bill, payerId, shares }
}
