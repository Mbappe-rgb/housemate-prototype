// "Who owes what". Pure functions over bills, so the same rules work for mock and real data.
import { daysBetween, type ISODate } from './dates'

export type Member = {
  id: string
  name: string
  hue: number
  role?: 'owner' | 'member'
  email?: string
  etransferEmail?: string | null
  phone?: string | null
  bankName?: string | null
}

export type Share = { amountCents: number; paidAt: string | null }

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
  /** one per member; for the payer, paidAt means "I paid the provider" */
  shares: Record<string, Share>
  receiptName?: string | null
}

export type Chore = {
  id: string
  title: string
  emoji: string
  assigneeId: string
  dueDate: ISODate
  recurrence: 'none' | 'daily' | 'weekly'
  doneAt: string | null
}

/** My share of a bill (0 if I'm not on it). */
export function shareOf(bill: Bill, memberId: string): number {
  return bill.shares[memberId]?.amountCents ?? 0
}

/** Something I still need to do: pay my share, or (as payer) pay the provider. */
export function isTodo(bill: Bill, me: string): boolean {
  const s = bill.shares[me]
  return !!s && s.paidAt === null
}

/** Housemates (not the payer) who have paid their share. */
export function othersPaid(bill: Bill): number {
  return Object.entries(bill.shares).filter(([id, s]) => id !== bill.payerId && s.paidAt !== null).length
}

/** Housemates (not the payer) who owe a share. */
export function othersCount(bill: Bill): number {
  return Object.keys(bill.shares).filter((id) => id !== bill.payerId).length
}

/** The split can't change once anyone other than the payer has paid. */
export function isSplitLocked(bill: Bill): boolean {
  return othersPaid(bill) > 0
}

export function sortByDue<T extends { dueDate: ISODate }>(items: T[]): T[] {
  return items.slice().sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))
}

/** Bills I still need to act on, soonest first. */
export function toPay(bills: Bill[], me: string): Bill[] {
  return sortByDue(bills.filter((b) => isTodo(b, me)))
}

/** What I owe housemates (not counting bills I pay the provider for). */
export function amountOwed(bills: Bill[], me: string): number {
  return toPay(bills, me)
    .filter((b) => b.payerId !== me)
    .reduce((sum, b) => sum + shareOf(b, me), 0)
}

export function pastDue(bills: Bill[], me: string, today: ISODate): Bill[] {
  return toPay(bills, me).filter((b) => daysBetween(today, b.dueDate) < 0)
}

/** Bills I've finished my part of. */
export function doneCount(bills: Bill[], me: string): number {
  return bills.filter((b) => !isTodo(b, me)).length
}

/** Changing the payer clears every paid mark (prototype rule, enforced by the database later). */
export function withNewPayer(bill: Bill, payerId: string): Bill {
  if (payerId === bill.payerId) return bill
  const shares = Object.fromEntries(Object.entries(bill.shares).map(([id, s]) => [id, { ...s, paidAt: null }]))
  return { ...bill, payerId, shares, receiptName: null }
}
