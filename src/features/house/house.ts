import { createContext, useContext } from 'react'
import type { Bill, Chore, Member } from '../../lib/bills'
import type { ISODate } from '../../lib/dates'

export type NewBill = {
  name: string
  category: string
  emoji: string
  totalCents: number
  dueDate: ISODate
  payerId: string
  recurrence: 'none' | 'monthly'
  splitMode: 'equal' | 'custom'
  /** cents per member; for 'equal' this is ignored and computed */
  amounts: Record<string, number>
}

export type NewChore = {
  title: string
  emoji: string
  assigneeId: string
  dueDate: ISODate
  recurrence: 'none' | 'daily' | 'weekly'
}

export type ProfileEdit = {
  displayName: string
  etransferEmail: string
  phone: string
  bankName: string
}

export type HouseActions = {
  markPaid: (billId: string, receiptName?: string | null) => void
  undoPaid: (billId: string) => void
  markReceived: (billId: string, memberId: string) => void
  addBill: (bill: NewBill) => void
  saveSplit: (billId: string, mode: 'equal' | 'custom', amounts: Record<string, number>) => void
  saveBillSettings: (billId: string, payerId: string, recurrence: 'none' | 'monthly') => void
  completeChore: (choreId: string) => void
  reopenChore: (choreId: string) => void
  addChore: (chore: NewChore) => void
  /** resolves to an error message, or null when saved */
  saveProfile: (edit: ProfileEdit) => Promise<string | null>
  leaveHousehold: () => void
}

export type House = {
  /** 'demo' = prototype data at /demo; 'live' = the signed-in person's real household */
  mode: 'live' | 'demo'
  household: { id: string; name: string; timezone: string; currency: string }
  me: Member
  /** in join order */
  members: Member[]
  today: ISODate
  bills: Bill[]
  chores: Chore[]
  inviteCode: string | null
  /** false while bills and chores aren't connected to the database yet (Phases 4-5) */
  moneyReady: boolean
  actions: HouseActions
}

export const HouseContext = createContext<House | null>(null)

export function useHouse(): House {
  const house = useContext(HouseContext)
  if (!house) throw new Error('useHouse must be used inside a house provider')
  return house
}

/** "You" for me, otherwise their name. */
export function nameFor(house: House, memberId: string): string {
  if (memberId === house.me.id) return 'You'
  return house.members.find((m) => m.id === memberId)?.name ?? 'Former housemate'
}

export function memberById(house: House, memberId: string): Member | undefined {
  return house.members.find((m) => m.id === memberId)
}
