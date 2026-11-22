// The v5 prototype's sample household, with real dates relative to today and money in cents.
import { splitEqual } from '../../lib/money'
import { addDays, type ISODate } from '../../lib/dates'
import type { Bill, Chore, Member, Share } from '../../lib/bills'
import { hueFromName } from '../../lib/hue'

export type DemoState = 'owe' | 'late' | 'settled'

const person = (id: string, name: string, extra: Partial<Member>): Member => ({ id, name, hue: hueFromName(name), ...extra })

export const DEMO_MEMBERS: Member[] = [
  person('moyin', 'Moyin', { role: 'owner', email: 'moyin@example.com', fullName: 'Moyin Adeyemo', etransfer: 'moyin@example.com' }),
  person('bankole', 'Bankole', { role: 'member', email: 'bankole@example.com', etransfer: 'bankole@example.com' }),
  person('ola', 'Ola', { role: 'member', email: 'ola@example.com', etransfer: '(647) 555-0121' }),
  person('dave', 'Dave', { role: 'member', email: 'dave@example.com', etransfer: 'dave@example.com' }),
]

const AT = '2026-01-01T00:00:00Z'

type Spec = {
  id: string
  name: string
  category: string
  emoji: string
  total: number
  inDays: number
  payer: string
  createdBy?: string
  recurrence?: 'none' | 'monthly'
  /** confirmed housemates (not the payer) */
  paid?: string[]
  /** sent but not confirmed */
  sent?: string[]
  providerPaid?: boolean
  receipt?: string
}

function makeBill(today: ISODate, b: Spec): Bill {
  const amounts = splitEqual(b.total, DEMO_MEMBERS.length)
  const shares: Record<string, Share> = Object.fromEntries(
    DEMO_MEMBERS.map((m, i) => {
      const isPayer = m.id === b.payer
      const paid = isPayer ? !!b.providerPaid : !!b.paid?.includes(m.id)
      const sent = paid || (!isPayer && !!b.sent?.includes(m.id))
      return [
        m.id,
        {
          amountCents: amounts[i],
          sentAt: sent && !isPayer ? AT : null,
          paidAt: paid ? AT : null,
          receiptPath: isPayer && b.receipt ? `demo:${b.receipt}` : null,
        },
      ]
    }),
  )
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    emoji: b.emoji,
    totalCents: b.total,
    dueDate: addDays(today, b.inDays),
    payerId: b.payer,
    createdBy: b.createdBy ?? b.payer,
    recurrence: b.recurrence ?? 'monthly',
    splitMode: 'equal',
    shares,
  }
}

const EVERYONE = DEMO_MEMBERS.map((m) => m.id)

export function demoBills(today: ISODate, state: DemoState): Bill[] {
  const all = state === 'settled'
  const set = (ids: string[]) => (all ? EVERYONE : ids)
  const current: Spec[] = [
    { id: 'rent', name: 'Rent', category: 'Rent', emoji: '🏠', total: 320000, inDays: 20, payer: 'bankole', paid: set(['dave']), providerPaid: all },
    { id: 'internet', name: 'Internet', category: 'Internet', emoji: '🌐', total: 48000, inDays: state === 'late' ? -6 : 3, payer: 'ola', paid: set(['bankole']), providerPaid: all },
    { id: 'water', name: 'Water', category: 'Water', emoji: '💧', total: 28800, inDays: 7, payer: 'bankole', paid: set(['ola', 'dave']), providerPaid: all },
    { id: 'hydro', name: 'Hydro', category: 'Electricity', emoji: '⚡', total: 19280, inDays: 14, payer: 'moyin', paid: set(['bankole']), sent: all ? [] : ['ola'], providerPaid: all },
  ]
  // Paid history, for Reports
  const done = (id: string, name: string, category: string, emoji: string, total: number, inDays: number, payer: string, receipt?: string): Spec => ({
    id, name, category, emoji, total, inDays, payer, paid: EVERYONE, providerPaid: true, recurrence: 'none', receipt,
  })
  const history: Spec[] = [
    done('h-rent-1', 'Rent', 'Rent', '🏠', 320000, -10, 'bankole', 'rent-nov.pdf'),
    done('h-rent-2', 'Rent', 'Rent', '🏠', 320000, -40, 'bankole', 'rent-oct.pdf'),
    done('h-rent-3', 'Rent', 'Rent', '🏠', 320000, -70, 'bankole'),
    done('h-int-1', 'Internet', 'Internet', '🌐', 48000, -27, 'ola'),
    done('h-int-2', 'Internet', 'Internet', '🌐', 48000, -58, 'ola'),
    done('h-water-1', 'Water', 'Water', '💧', 28800, -23, 'bankole', 'water-oct.pdf'),
    done('h-water-2', 'Water', 'Water', '💧', 27600, -54, 'bankole'),
    done('h-hydro-1', 'Hydro', 'Electricity', '⚡', 17640, -16, 'moyin'),
    done('h-hydro-2', 'Hydro', 'Electricity', '⚡', 18120, -47, 'moyin'),
  ]
  return [...current, ...history].map((b) => makeBill(today, b))
}

export function demoChores(today: ISODate): Chore[] {
  const c = (id: string, title: string, emoji: string, assigneeId: string, inDays: number, done = false): Chore => ({
    id,
    title,
    emoji,
    assigneeId,
    dueDate: addDays(today, inDays),
    recurrence: 'weekly',
    doneAt: done ? AT : null,
    createdBy: 'moyin',
  })
  return [
    c('bins', 'Take out the bins', '🗑️', 'moyin', 0),
    c('recycle', 'Take out recycle', '♻️', 'moyin', 1),
    c('dishes', 'Wash the dishes', '🍽️', 'bankole', 2),
    c('vacuum', 'Vacuum the living room', '🧹', 'moyin', 3),
    c('plants', 'Water the plants', '🪴', 'moyin', 5),
    c('bathroom', 'Clean the bathroom', '🚿', 'ola', 6),
    c('h1', 'Take out the bins', '🗑️', 'moyin', -3, true),
    c('h2', 'Vacuum the living room', '🧹', 'moyin', -4, true),
  ]
}

export const BILL_CATEGORIES: readonly (readonly [string, string])[] = [
  ['Rent', '🏠'],
  ['Electricity', '⚡'],
  ['Internet', '🌐'],
  ['Water', '💧'],
  ['Gas', '🔥'],
  ['Phone', '📱'],
  ['Other', '🧾'],
]

export const BILL_EMOJIS = ['🏠', '⚡', '🌐', '💧', '🔥', '📱', '🧾', '🎬', '🛠️', '🚗', '🐶', '🧺']
export const CHORE_EMOJIS = ['🧹', '🗑️', '🍽️', '🚿', '🧺', '🪴', '🛒', '🐶', '🪟', '🧽', '🛏️', '♻️']

/** "Monthly home payment" / "Electricity bill", the subtitle the prototype shows. */
export function categoryLabel(category: string): string {
  return category === 'Rent' ? 'Monthly home payment' : `${category} bill`
}
