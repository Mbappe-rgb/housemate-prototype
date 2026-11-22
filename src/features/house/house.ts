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
  fullName: string
  displayName: string
  /** Interac e-Transfer: an email or a phone number */
  etransfer: string
}

export type Settings = {
  theme: string
  notifyEnabled: boolean
  notifyBills: boolean
  notifyChores: boolean
}

export type JoinRequest = {
  id: string
  userId: string
  name: string
  hue: number
  email: string | null
  createdAt: string
}

/** A reminder someone sent me ("Moyin reminded you about Internet"). */
export type Reminder = {
  id: string
  billId: string | null
  fromId: string | null
  createdAt: string
  read: boolean
}

export type HouseActions = {
  // Bills: a housemate sends their share, the payer confirms it
  /** housemate: "I sent my share" (optionally with a receipt) */
  markSent: (billId: string, receipt?: File | null) => void
  undoSent: (billId: string) => void
  /** payer: "I paid the provider" (optionally with the provider's invoice) */
  payProvider: (billId: string, receipt?: File | null) => void
  undoProvider: (billId: string) => void
  /** payer: confirm a housemate's payment (also "Mark as paid") */
  confirmShare: (billId: string, memberId: string) => void
  /** payer: "Mark as unpaid" / "Undo payment" */
  markUnpaid: (billId: string, memberId: string) => void
  /** payer: remind one housemate, or everyone still unpaid */
  sendReminder: (billId: string, memberId?: string) => void
  addBill: (bill: NewBill) => void
  /** creator or admin, only while nothing is sent or paid */
  deleteBill: (billId: string) => Promise<string | null>
  saveSplit: (billId: string, mode: 'equal' | 'custom', amounts: Record<string, number>) => void
  saveBillSettings: (billId: string, payerId: string, recurrence: 'none' | 'monthly') => void
  /** bills due between two dates, for Reports (includes older history) */
  fetchBills: (from: ISODate, to: ISODate) => Promise<Bill[]>
  // Chores
  completeChore: (choreId: string) => void
  reopenChore: (choreId: string) => void
  addChore: (chore: NewChore) => void
  deleteChore: (choreId: string) => Promise<string | null>
  // Me and the household
  /** resolves to an error message, or null when saved */
  saveProfile: (edit: ProfileEdit) => Promise<string | null>
  saveSettings: (change: Partial<Settings>) => void
  markRemindersRead: () => void
  /** admin must name a new admin when others remain; resolves to an error message or null */
  leaveHousehold: (newAdminId?: string) => Promise<string | null>
  removeMember: (memberId: string) => Promise<string | null>
  resetInvite: () => Promise<void>
  decideRequest: (requestId: string, approve: boolean) => Promise<void>
}

export type House = {
  /** 'demo' = sample data at /demo; 'live' = the signed-in person's real household */
  mode: 'live' | 'demo'
  household: { id: string; name: string; timezone: string; currency: string }
  me: Member
  /** in join order */
  members: Member[]
  today: ISODate
  bills: Bill[]
  chores: Chore[]
  inviteCode: string | null
  settings: Settings
  /** I'm the household's owner ("Admin") */
  isAdmin: boolean
  /** pending requests to join (only loaded for the admin) */
  joinRequests: JoinRequest[]
  /** reminders sent to me */
  reminders: Reminder[]
  /** who I've reminded in the last day, per bill: remindedToday[billId] has memberId */
  remindedToday: Record<string, string[]>
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

/** Their name, even when it's me (for "Pay to Ola" lines that read "Pay to You"). */
export function memberById(house: House, memberId: string): Member | undefined {
  return house.members.find((m) => m.id === memberId)
}

export function hueFor(house: House, memberId: string): number {
  return memberById(house, memberId)?.hue ?? 0
}
