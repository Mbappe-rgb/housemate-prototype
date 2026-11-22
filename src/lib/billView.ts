// Everything the bill sheet and bill cards show comes from here, in one place
// (style guide: "Bill state drives the sheet ... keep them in one function").
import { isTodo, shareOf, statusOf, stillUnpaid, toConfirm, isFullySettled, type Bill } from './bills'
import { daysBetween, dueText, shortDate, type ISODate } from './dates'
import { formatMoney } from './money'

export type Tone = 'ok' | 'wait' | 'late' | ''

/** The single action pinned to the bottom of the bill sheet. */
export type PinnedAction =
  | { kind: 'pay'; text: string } // housemate: "Send $120 to Ola" -> Pay (opens pay details)
  | { kind: 'payProvider'; text: string } // payer: "Pay $192.80 for hydro" -> Pay
  | { kind: 'confirm'; text: string; memberId: string } // payer: one payment to confirm
  | { kind: 'review'; text: string } // payer: several to confirm -> open progress
  | { kind: 'remind'; text: string; reminded: boolean } // payer: housemates unpaid
  | { kind: 'waiting'; text: string } // housemate: sent, waiting -> Undo
  | null

export type BillView = {
  iPay: boolean
  /** "You owe", "You sent", "You paid", "You're paying" */
  head: string
  /** the big amount under head */
  amountCents: number
  /** status line under the bill name */
  status: string
  tone: Tone
  /** bill card subtitle after "Pay to X •" */
  cardStatus: string
  cardTone: Tone
  /** bill card button */
  cardAction: 'pay' | 'confirm' | 'paid' | null
  pinned: PinnedAction
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function billView(
  bill: Bill,
  me: string,
  today: ISODate,
  nameOf: (id: string) => string,
  remindedToday: (memberId: string) => boolean = () => false,
): BillView {
  const iPay = bill.payerId === me
  const myStatus = statusOf(bill, me)
  const todo = isTodo(bill, me)
  const late = todo && daysBetween(today, bill.dueDate) < 0
  const payer = nameOf(bill.payerId)
  const confirmList = toConfirm(bill)
  const unpaid = stillUnpaid(bill)
  const providerPaid = !!bill.shares[bill.payerId]?.paidAt
  const settled = isFullySettled(bill)

  let head: string
  let status: string
  let tone: Tone = ''
  if (iPay) {
    head = providerPaid ? 'You paid' : 'You’re paying'
    if (providerPaid) {
      const left = unpaid.length + confirmList.length
      status = left ? `Waiting on ${left} housemate${left > 1 ? 's' : ''}` : 'All settled'
      tone = left ? 'wait' : 'ok'
    } else {
      status = late ? `Overdue since ${shortDate(bill.dueDate)}` : cap(dueText(bill.dueDate, today))
      tone = late ? 'late' : ''
    }
  } else if (myStatus === 'paid') {
    head = 'You paid'
    status = 'Paid'
    tone = 'ok'
  } else if (myStatus === 'sent') {
    head = 'You sent'
    status = `Waiting for ${payer} to confirm`
    tone = 'wait'
  } else {
    head = 'You owe'
    status = late ? `Overdue since ${shortDate(bill.dueDate)}` : cap(dueText(bill.dueDate, today))
    tone = late ? 'late' : ''
  }

  // Bill card
  let cardStatus: string
  let cardTone: Tone = ''
  if (iPay && confirmList.length) {
    cardStatus = `${confirmList.length} to confirm`
    cardTone = 'wait'
  } else if (todo) {
    cardStatus = relLabel(bill.dueDate, today)
    cardTone = late ? 'late' : ''
  } else if (!iPay && myStatus === 'sent') {
    cardStatus = 'Sent, waiting'
    cardTone = 'wait'
  } else {
    cardStatus = 'Paid'
  }
  // Housemate owes: "Pay this bill". Payer: "Confirm bill paid" while the provider isn't paid,
  // or while someone has sent money to confirm. Otherwise a "Paid" chip.
  let cardAction: BillView['cardAction'] = 'paid'
  if (todo) cardAction = iPay ? 'confirm' : 'pay'
  else if (iPay && confirmList.length) cardAction = 'confirm'

  // Pinned action (same order as the prototype)
  let pinned: PinnedAction = null
  if (iPay && !providerPaid) {
    pinned = { kind: 'payProvider', text: `Pay ${formatMoney(bill.totalCents)} for ${bill.name.toLowerCase()}` }
  } else if (iPay && confirmList.length === 1) {
    pinned = { kind: 'confirm', text: `1 payment to confirm`, memberId: confirmList[0] }
  } else if (iPay && confirmList.length > 1) {
    pinned = { kind: 'review', text: `${confirmList.length} payments to confirm` }
  } else if (iPay && unpaid.length) {
    pinned = {
      kind: 'remind',
      text: `${unpaid.length} housemate${unpaid.length > 1 ? 's' : ''} unpaid`,
      reminded: unpaid.every(remindedToday),
    }
  } else if (!iPay && myStatus === 'unpaid') {
    pinned = { kind: 'pay', text: `Send ${formatMoney(shareOf(bill, me))} to ${payer}` }
  } else if (!iPay && myStatus === 'sent') {
    pinned = { kind: 'waiting', text: `Waiting for ${payer}` }
  }

  return {
    iPay,
    head,
    amountCents: iPay ? bill.totalCents : shareOf(bill, me),
    status: settled && iPay ? 'All settled' : status,
    tone: settled && iPay ? 'ok' : tone,
    cardStatus,
    cardTone,
    cardAction,
    pinned,
  }
}

/** "Past due", "Due today", "Due tomorrow", "Due Sat, Nov 14" */
export function relLabel(due: ISODate, today: ISODate): string {
  const diff = daysBetween(today, due)
  if (diff < 0) return 'Past due'
  if (diff === 0) return 'Due today'
  if (diff === 1) return 'Due tomorrow'
  const d = new Date(`${due}T12:00:00Z`)
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
  return `Due ${wd}, ${shortDate(due)}`
}
