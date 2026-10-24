// The prototype's sample household, with real dates relative to today and money in cents.
import { splitEqual } from '../../lib/money'
import { addDays, type ISODate } from '../../lib/dates'
import type { Bill, Chore, Member } from '../../lib/bills'
import { hueFromName } from '../../lib/hue'

export type DemoState = 'owe' | 'late' | 'settled'

const person = (id: string, name: string, extra: Partial<Member>): Member => ({
  id,
  name,
  hue: hueFromName(name),
  ...extra,
})

export const DEMO_MEMBERS: Member[] = [
  person('moyin', 'Moyin', { role: 'owner', email: 'moyin@example.com', etransferEmail: 'moyin@example.com', phone: '(416) 555-0142', bankName: 'TD Canada Trust' }),
  person('bankole', 'Bankole', { role: 'member', email: 'bankole@example.com', etransferEmail: 'bankole@example.com', phone: '(416) 555-0177', bankName: 'RBC Royal Bank' }),
  person('ola', 'Ola', { role: 'member', email: 'ola@example.com', etransferEmail: 'ola@example.com', phone: '(647) 555-0121', bankName: 'Scotiabank' }),
  person('dave', 'Dave', { role: 'member', email: 'dave@example.com', etransferEmail: 'dave@example.com', phone: '(416) 555-0199', bankName: 'BMO' }),
]

const PAID = '2026-01-01T00:00:00Z'

function makeBill(
  today: ISODate,
  b: { id: string; name: string; category: string; emoji: string; total: number; inDays: number; payer: string },
  paidBy: string[],
  payerPaid: boolean,
): Bill {
  const amounts = splitEqual(b.total, DEMO_MEMBERS.length)
  const shares = Object.fromEntries(
    DEMO_MEMBERS.map((m, i) => [
      m.id,
      {
        amountCents: amounts[i],
        paidAt: (m.id === b.payer ? payerPaid : paidBy.includes(m.id)) ? PAID : null,
      },
    ]),
  )
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    emoji: b.emoji,
    totalCents: b.total,
    dueDate: addDays(today, b.inDays),
    payerId: b.payer,
    createdBy: b.payer,
    recurrence: 'monthly',
    splitMode: 'equal',
    shares,
  }
}

export function demoBills(today: ISODate, state: DemoState): Bill[] {
  const all = state === 'settled'
  const everyone = DEMO_MEMBERS.map((m) => m.id)
  const paid = (ids: string[]) => (all ? everyone : ids)
  return [
    makeBill(today, { id: 'rent', name: 'Rent', category: 'Rent', emoji: '🏠', total: 320000, inDays: 8, payer: 'bankole' }, paid(['dave']), all),
    makeBill(today, { id: 'internet', name: 'Internet', category: 'Internet', emoji: '🌐', total: 26000, inDays: state === 'late' ? -4 : 3, payer: 'ola' }, paid(['bankole']), all),
    makeBill(today, { id: 'hydro', name: 'Hydro', category: 'Electricity', emoji: '⚡', total: 19280, inDays: 5, payer: 'dave' }, paid([]), all),
    makeBill(today, { id: 'water', name: 'Water', category: 'Water', emoji: '💧', total: 7200, inDays: 13, payer: 'moyin' }, paid(['bankole', 'ola']), true),
  ]
}

export function demoChores(today: ISODate): Chore[] {
  const c = (id: string, title: string, emoji: string, assigneeId: string, inDays: number): Chore => ({
    id,
    title,
    emoji,
    assigneeId,
    dueDate: addDays(today, inDays),
    recurrence: 'weekly',
    doneAt: null,
  })
  return [
    c('bins', 'Take out the bins', '🗑️', 'moyin', 1),
    c('vacuum', 'Vacuum the living room', '🧹', 'moyin', 3),
    c('dishes', 'Wash the dishes', '🍽️', 'bankole', 2),
    c('bathroom', 'Clean the bathroom', '🚿', 'ola', 5),
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
