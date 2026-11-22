import { useEffect, useState } from 'react'
import { Avatar, StatusTile } from '../../../components/Avatar'
import { Icon, type IconName } from '../../../components/Icon'
import { Dialog, Sheet } from '../../../components/Sheet'
import { useToast } from '../../../components/Toast'
import { copyText } from '../../../lib/clipboard'
import { openReceipt } from '../../../lib/receipts'
import { isSplitLocked, isTodo, othersCount, settledCount, shareOf, splitTotals, statusOf, whoActed, type Bill } from '../../../lib/bills'
import { billView, type PinnedAction } from '../../../lib/billView'
import { daysBetween, shortDate } from '../../../lib/dates'
import { centsToInput, formatMoney, splitEqual } from '../../../lib/money'
import { hueFor, memberById, nameFor, useHouse, type House } from '../../house/house'
import { categoryLabel } from '../../house/demoData'
import { remindedFn, tileLabel, tileStatus } from '../billHelpers'
import { SplitEditor } from './SplitEditor'
import { splitAmounts, splitIsValid, type SplitState } from './split'

type View = 'detail' | 'settings' | 'payto' | 'split'

/** One sheet per bill: your amount, who's paying, everyone's progress, and one pinned action. */
export function BillSheet({ billId, onClose }: { billId: string; onClose: () => void }) {
  const house = useHouse()
  const bill = house.bills.find((b) => b.id === billId)
  const [view, setView] = useState<View>('detail')
  const [locked, setLocked] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)

  // The bill was deleted (here or by someone else): close
  useEffect(() => {
    if (!bill) onClose()
  }, [bill, onClose])
  if (!bill) return null

  const v = billView(bill, house.me.id, house.today, (id) => memberById(house, id)?.name ?? 'a former housemate', remindedFn(house, bill.id))

  return (
    <>
      <Sheet
        label={`${bill.name} bill`}
        onClose={onClose}
        // "Waiting for X" already shows in the settled note, so it isn't pinned too
        pinned={view === 'detail' && v.pinned && v.pinned.kind !== 'waiting' ? <Pinned bill={bill} action={v.pinned} onPay={() => setView('payto')} onReview={() => setProgressOpen(true)} /> : undefined}
      >
        {view === 'detail' && (
          <Detail
            bill={bill}
            go={setView}
            progressOpen={progressOpen}
            setProgressOpen={setProgressOpen}
            onEditSplit={() => (isSplitLocked(bill) ? setLocked(true) : setView('split'))}
          />
        )}
        {view === 'settings' && <Settings bill={bill} back={() => setView('detail')} onDeleted={onClose} />}
        {view === 'payto' && <PayTo bill={bill} back={() => setView('detail')} />}
        {view === 'split' && <EditSplit bill={bill} back={() => setView('detail')} />}
      </Sheet>
      {locked && <LockedDialog bill={bill} house={house} onClose={() => setLocked(false)} />}
    </>
  )
}

function BackTop({ title, subtitle, back }: { title: string; subtitle: string; back: () => void }) {
  return (
    <div className="top">
      <button type="button" className="ib" onClick={back} aria-label="Back">
        <Icon name="left" size={20} />
      </button>
      <div>
        <b>{title}</b>
        <small>{subtitle}</small>
      </div>
    </div>
  )
}

const TONE_ICON: Record<string, IconName | null> = { ok: 'check', late: 'clock', wait: 'clock', '': null }

function Detail({
  bill,
  go,
  progressOpen,
  setProgressOpen,
  onEditSplit,
}: {
  bill: Bill
  go: (v: View) => void
  progressOpen: boolean
  setProgressOpen: (open: boolean) => void
  onEditSplit: () => void
}) {
  const house = useHouse()
  const me = house.me.id
  const [detailsOpen, setDetailsOpen] = useState(false)
  const v = billView(bill, me, house.today, (id) => memberById(house, id)?.name ?? 'a former housemate', remindedFn(house, bill.id))
  const payerName = v.iPay ? 'You' : (memberById(house, bill.payerId)?.name ?? 'A former housemate')
  const equal = splitEqual(bill.totalCents, Object.keys(bill.shares).length)
  const canManage = bill.createdBy === me || house.isAdmin
  const toneIcon = TONE_ICON[v.tone]

  return (
    <>
      <div className="top">
        <span className="bi" style={{ width: 44, height: 44, fontSize: 22 }} aria-hidden="true">
          {bill.emoji}
        </span>
        <div>
          <b>{bill.name}</b>
          <small className={`st2 ${v.tone}`}>
            {toneIcon && <Icon name={toneIcon} size={14} />}
            {v.status}
          </small>
        </div>
        {canManage && (
          <button type="button" className="ib" onClick={() => go('settings')} aria-label="Bill settings">
            <Icon name="tune" size={20} />
          </button>
        )}
      </div>

      <small className="shl">{v.head}</small>
      <div className="amt">{formatMoney(v.amountCents)}</div>

      <div className="card2">
        <button type="button" className="ch2" onClick={() => setDetailsOpen(!detailsOpen)} aria-expanded={detailsOpen}>
          <div>
            <b>Bill details</b>
            <small>
              {formatMoney(bill.totalCents)} total · {bill.splitMode === 'custom' ? 'Custom split' : 'Equal split'}
            </small>
          </div>
          <span className={`chv ${detailsOpen ? 'rot' : ''}`}>
            <Icon name="down" size={18} />
          </span>
        </button>
        {detailsOpen && (
          <div className="dl2">
            <div>
              <span>Created by</span>
              <b>{nameFor(house, bill.createdBy)}</b>
            </div>
            <div>
              <span>Due date</span>
              <b>{shortDate(bill.dueDate)}</b>
            </div>
            <div>
              <span>Category</span>
              <b>{categoryLabel(bill.category)}</b>
            </div>
            <div>
              <span>Split</span>
              <b>
                {bill.splitMode === 'custom' ? 'Custom' : `Equal, ${formatMoney(equal[equal.length - 1])} each`}
                {bill.createdBy === me && (
                  <button type="button" className="pen" onClick={onEditSplit} aria-label="Edit split">
                    <Icon name="edit" size={14} />
                  </button>
                )}
              </b>
            </div>
            <div>
              <span>Bill total</span>
              <b>{formatMoney(bill.totalCents)}</b>
            </div>
            <div>
              <span>Repeats</span>
              <b>{bill.recurrence === 'monthly' ? 'Monthly' : 'One time'}</b>
            </div>
          </div>
        )}
      </div>

      <button type="button" className="pto" onClick={() => go('payto')}>
        <Avatar name={memberById(house, bill.payerId)?.name ?? '?'} hue={hueFor(house, bill.payerId)} size={40} />
        <div>
          <small>Pay to</small>
          <b>{payerName}</b>
        </div>
        <Icon name="right" size={18} />
      </button>

      <PaymentProgress bill={bill} open={progressOpen} setOpen={setProgressOpen} />

      <SettledNote bill={bill} />
      <Receipts bill={bill} />
    </>
  )
}

/** Collapsed: everyone's avatar and "x/y settled". Expanded: one row per person with actions. */
function PaymentProgress({ bill, open, setOpen }: { bill: Bill; open: boolean; setOpen: (o: boolean) => void }) {
  const house = useHouse()
  const me = house.me.id
  const iPay = bill.payerId === me
  const { settled, total } = settledCount(bill)
  const ids = house.members
    .map((m) => m.id)
    .filter((id) => bill.shares[id])
    .concat(Object.keys(bill.shares).filter((id) => !memberById(house, id)))
  const { collected, owedTotal } = splitTotals(bill)

  return (
    <div className={`pcard ${open ? 'open' : ''}`}>
      <button type="button" className="pch" onClick={() => setOpen(!open)} aria-expanded={open}>
        <b>Payment progress</b>
        <span className={`chv ${open ? 'rot' : ''}`}>
          <Icon name="down" size={18} />
        </span>
      </button>
      {open ? (
        <>
          <div className="rws">
            <div className="rcnt">
              <b style={settled === total ? { color: 'var(--acc)' } : undefined}>
                {settled}/{total}
              </b>{' '}
              settled
            </div>
            {ids.map((id) => (
              <ProgressRow key={id} bill={bill} memberId={id} />
            ))}
          </div>
          {iPay && othersCount(bill) > 0 && (
            <div className="pft">
              <span>
                Collected <b>{formatMoney(collected)}</b> of {formatMoney(owedTotal)}
              </span>
              <span>
                Left <b>{formatMoney(owedTotal - collected)}</b>
              </span>
            </div>
          )}
        </>
      ) : (
        <div className="ppn">
          <div className="pav">
            {ids.map((id) => (
              <StatusTile key={id} name={memberById(house, id)?.name ?? '?'} hue={hueFor(house, id)} status={tileStatus(bill, id)} size="md" label={tileLabel(house, bill, id)} />
            ))}
          </div>
          <span className="cnt">
            <b className={settled === total ? 'ok' : ''}>
              {settled}/{total}
            </b>{' '}
            settled
          </span>
        </div>
      )}
    </div>
  )
}

function ProgressRow({ bill, memberId }: { bill: Bill; memberId: string }) {
  const house = useHouse()
  const me = house.me.id
  const iPay = bill.payerId === me
  const isPayerRow = memberId === bill.payerId
  const status = statusOf(bill, memberId)
  const amount = formatMoney(shareOf(bill, memberId))
  const late = daysBetween(house.today, bill.dueDate) < 0
  const reminded = (house.remindedToday[bill.id] ?? []).includes(memberId)
  const [menu, setMenu] = useState(false)

  let sub: React.ReactNode
  let right: React.ReactNode = null
  let items: [string, (() => void) | null][] = []

  if (isPayerRow) {
    const paid = !!bill.shares[memberId]?.paidAt
    right = <span className={`pl ${paid ? 'ok' : 'neu'}`}>{paid ? 'Provider paid' : 'Provider unpaid'}</span>
    sub = <span>{paid ? `Paid the provider ${formatMoney(bill.totalCents)}` : `Bill total ${formatMoney(bill.totalCents)}`}</span>
  } else if (status === 'paid') {
    sub = <span className="g">{iPay ? `Received ${amount}` : `Paid ${amount}`}</span>
    if (iPay) items = [['Undo payment', () => house.actions.markUnpaid(bill.id, memberId)]]
  } else if (status === 'sent') {
    sub = (
      <>
        <b className="sw3 a">Sent</b>
        <span>&nbsp;· {amount}</span>
      </>
    )
    if (iPay) {
      right = (
        <button type="button" className="btn2" onClick={() => house.actions.confirmShare(bill.id, memberId)}>
          Confirm
        </button>
      )
      items = [['Mark as unpaid', () => house.actions.markUnpaid(bill.id, memberId)]]
    } else if (memberId === me) {
      items = [['Undo', () => house.actions.undoSent(bill.id)]]
    }
  } else {
    sub = (
      <>
        <b className={`sw3 ${late ? 'r' : ''}`}>{late ? 'Overdue' : 'Unpaid'}</b>
        <span>
          &nbsp;· {amount}
          {late && ` · due ${shortDate(bill.dueDate)}`}
        </span>
      </>
    )
    if (iPay)
      items = [
        ['Mark as paid', () => house.actions.confirmShare(bill.id, memberId)],
        reminded ? ['Reminder sent', null] : ['Send reminder', () => house.actions.sendReminder(bill.id, memberId)],
      ]
  }

  const name = nameFor(house, memberId)
  return (
    <div className="prow">
      <StatusTile name={memberById(house, memberId)?.name ?? '?'} hue={hueFor(house, memberId)} status={tileStatus(bill, memberId)} size="md" label={tileLabel(house, bill, memberId)} />
      <div className="pn">
        <b className="pnm">{name}</b>
        <div className="psub">{sub}</div>
      </div>
      {right}
      {items.length > 0 && (
        <div className="mnw">
          <button type="button" className="mbt" aria-label={`More actions for ${name}`} aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <Icon name="more" size={24} />
          </button>
          {menu && (
            <div className="mnu" role="menu">
              {items.map(([label, act]) => (
                <button
                  key={label}
                  type="button"
                  role="menuitem"
                  disabled={!act}
                  onClick={() => {
                    setMenu(false)
                    act?.()
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Green or amber block once my part is done, with Undo where allowed. */
function SettledNote({ bill }: { bill: Bill }) {
  const house = useHouse()
  const me = house.me.id
  const iPay = bill.payerId === me
  if (isTodo(bill, me) || !bill.shares[me]) return null
  const payer = memberById(house, bill.payerId)?.name ?? 'The payer'
  const status = statusOf(bill, me)
  const left = Object.keys(bill.shares).filter((id) => id !== me && statusOf(bill, id) !== 'paid').length

  let title: string
  let note: string | null
  let waiting = false
  let undo: (() => void) | null = null
  if (iPay) {
    title = left ? 'You paid this bill' : 'Bill fully settled'
    note = left ? `Waiting on ${left} housemate${left > 1 ? 's' : ''}` : 'Everyone has paid you back'
    undo = () => house.actions.undoProvider(bill.id)
  } else if (status === 'sent') {
    title = `Waiting for ${payer} to confirm`
    note = null
    waiting = true
    undo = () => house.actions.undoSent(bill.id)
  } else {
    title = 'Your share is settled'
    note = `${payer} confirmed ${formatMoney(shareOf(bill, me))}`
  }
  return (
    <div className={`settled ${waiting ? 'wt' : ''}`}>
      <span className="dk2">
        <Icon name={waiting ? 'clock' : 'check'} size={18} />
      </span>
      <div>
        <b>{title}</b>
        {note && <small>{note}</small>}
      </div>
      {undo && (
        <button type="button" className="udb" onClick={undo}>
          <Icon name="undo" size={16} />
          Undo
        </button>
      )}
    </div>
  )
}

/** A row per attached receipt; housemates open them through short-lived private links. */
function Receipts({ bill }: { bill: Bill }) {
  const house = useHouse()
  const toast = useToast()
  const list = Object.entries(bill.shares).filter(([, s]) => s.receiptPath)
  if (!list.length) return null
  return (
    <>
      {list.map(([id, s]) => {
        const path = s.receiptPath!
        const file = path.startsWith('demo:') ? path.slice(5) : (path.split('/').pop() ?? 'Receipt')
        return (
          <button
            key={id}
            type="button"
            className="rcd"
            onClick={async () => {
              if (path.startsWith('demo:')) return toast('In the demo, receipts aren’t stored')
              if (!(await openReceipt(path))) toast('Couldn’t open the receipt. Please try again.')
            }}
          >
            <span className="rci">
              <Icon name="clip" size={18} />
            </span>
            <span className="rct">
              <b>{file}</b>
              <small>
                {id === bill.payerId ? 'Provider invoice' : 'Payment receipt'} · {nameFor(house, id)} · tap to open
              </small>
            </span>
          </button>
        )
      })}
    </>
  )
}

/** The single action pinned to the bottom of the sheet. */
function Pinned({ bill, action, onPay, onReview }: { bill: Bill; action: NonNullable<PinnedAction>; onPay: () => void; onReview: () => void }) {
  const house = useHouse()
  let icon: IconName = 'send'
  let tone = ''
  let button: React.ReactNode = null
  let go = true
  switch (action.kind) {
    case 'pay':
    case 'payProvider':
      button = (
        <button type="button" className="nbt" onClick={onPay}>
          Pay
        </button>
      )
      break
    case 'confirm':
      icon = 'bell'
      button = (
        <button type="button" className="nbt" onClick={() => house.actions.confirmShare(bill.id, action.memberId)}>
          Confirm
        </button>
      )
      break
    case 'review':
      icon = 'bell'
      button = (
        <button type="button" className="nbt" onClick={onReview}>
          Review
        </button>
      )
      break
    case 'remind':
      icon = 'profile'
      button = action.reminded ? (
        <button type="button" className="nbt" disabled>
          Reminded
        </button>
      ) : (
        <button type="button" className="nbt" onClick={() => house.actions.sendReminder(bill.id)}>
          Remind
        </button>
      )
      break
    case 'waiting':
      icon = 'clock'
      tone = 't-n'
      go = false
      button = (
        <button type="button" className="nbt gh" onClick={() => house.actions.undoSent(bill.id)}>
          Undo
        </button>
      )
      break
  }
  return (
    <div className="pact">
      <div className={`pnr ${tone}`}>
        <div className="nl">
          <span className="nic">
            <Icon name={icon} size={16} />
          </span>
          <b className="ntx">{action.text}</b>
          {go && (
            <span className="chs" aria-hidden="true">
              <Icon name="right" size={24} />
              <Icon name="right" size={24} />
              <Icon name="right" size={24} />
            </span>
          )}
        </div>
        {button}
      </div>
    </div>
  )
}

function Settings({ bill, back, onDeleted }: { bill: Bill; back: () => void; onDeleted: () => void }) {
  const house = useHouse()
  const [payerId, setPayerId] = useState(bill.payerId)
  const [monthly, setMonthly] = useState(bill.recurrence === 'monthly')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const anyActivity = Object.values(bill.shares).some((s) => s.paidAt || s.sentAt)
  const payerName = payerId === house.me.id ? 'you' : (memberById(house, payerId)?.name ?? 'them')
  return (
    <>
      <BackTop title="Bill settings" subtitle={`${bill.name}, created by ${nameFor(house, bill.createdBy)}`} back={back} />
      <h4 id="payer-label">Who’s paying this bill?</h4>
      <div role="radiogroup" aria-labelledby="payer-label">
        {house.members
          .filter((m) => bill.shares[m.id])
          .map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={payerId === m.id} className="opt" onClick={() => setPayerId(m.id)}>
              <Avatar name={m.name} hue={m.hue} size={30} />
              <span>{m.id === house.me.id ? `Me (${m.name})` : m.name}</span>
              <i className="rd" />
            </button>
          ))}
      </div>
      <small className="hint" style={{ margin: '4px 2px 10px' }}>
        Everyone else pays {payerName} back. Changing the payer resets payment progress.
      </small>
      <button type="button" className="tgl" role="switch" aria-checked={monthly} onClick={() => setMonthly(!monthly)}>
        <span>Repeats every month</span>
        <i className={`sw ${monthly ? 'on' : ''}`} />
      </button>
      <button
        type="button"
        className="btn"
        onClick={() => {
          house.actions.saveBillSettings(bill.id, payerId, monthly ? 'monthly' : 'none')
          back()
        }}
      >
        Save settings
      </button>
      <button type="button" className="lk" onClick={back}>
        Cancel
      </button>
      {anyActivity ? (
        <small className="hint" style={{ textAlign: 'center' }}>
          Bills with payments can’t be deleted.
        </small>
      ) : confirmDelete ? (
        <button
          type="button"
          className="btn dng"
          style={{ marginTop: 12 }}
          disabled={deleting}
          onClick={async () => {
            setDeleting(true)
            const err = await house.actions.deleteBill(bill.id)
            setDeleting(false)
            if (!err) onDeleted()
          }}
        >
          {deleting ? 'Deleting…' : `Yes, delete ${bill.name}`}
        </button>
      ) : (
        <button type="button" className="lk" style={{ color: 'var(--warn)' }} onClick={() => setConfirmDelete(true)}>
          Delete bill
        </button>
      )}
    </>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast()
  return (
    <div className="ar">
      <span>{label}</span>
      <em>{value}</em>
      <button type="button" className="cpi" onClick={() => copyText(value, toast)} aria-label={`Copy ${label.toLowerCase()}`}>
        <Icon name="copy" size={18} />
      </button>
    </div>
  )
}

/** Pay details: the payer's e-transfer detail and amount, then attach a receipt and Confirm. */
function PayTo({ bill, back }: { bill: Bill; back: () => void }) {
  const house = useHouse()
  const toast = useToast()
  const me = house.me.id
  const iPay = bill.payerId === me
  const payer = memberById(house, bill.payerId)
  const name = payer?.name ?? 'A former housemate'
  const todo = isTodo(bill, me)
  const [receipt, setReceipt] = useState<File | null>(null)

  return (
    <>
      <BackTop title={iPay ? 'Your payment details' : `Pay to ${name}`} subtitle={bill.name} back={back} />
      <div className="pc">
        <Avatar name={name} hue={payer?.hue ?? 0} size={64} />
        <b>{iPay ? 'You' : name}</b>
        <small>{iPay ? 'Housemates see these details' : `Paying ${bill.name.toLowerCase()} for the household`}</small>
      </div>
      <div className="dl">
        {payer?.etransfer ? (
          <CopyRow label="E-transfer" value={payer.etransfer} />
        ) : (
          <div>
            <span>{iPay ? 'Add your e-transfer email or phone in Profile' : `${name} hasn’t added e-transfer details yet`}</span>
          </div>
        )}
        {!iPay && <CopyRow label="Amount" value={centsToInput(shareOf(bill, me))} />}
      </div>
      {!iPay && (
        <small className="hint" style={{ margin: '0 2px 12px' }}>
          Add “{bill.name}” in the e-transfer message so it’s easy to match.
        </small>
      )}
      {todo && (
        <div className="rcr">
          <label className={`rcu ${receipt ? 'on' : ''}`}>
            <input
              type="file"
              accept="image/*,application/pdf"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                if (file && file.size > 20 * 1024 * 1024) return toast('That file is too big. Try a photo or a PDF under 5 MB.')
                setReceipt(file)
              }}
            />
            <Icon name="clip" size={24} />
            <span>
              <b>{receipt?.name ?? (iPay ? 'Attach provider invoice' : 'Attach payment receipt')}</b>
              <small>{receipt ? 'Tap to replace' : 'Optional, a photo or PDF works'}</small>
            </span>
          </label>
          <button
            type="button"
            className="rcb"
            onClick={() => {
              if (iPay) house.actions.payProvider(bill.id, receipt)
              else house.actions.markSent(bill.id, receipt)
              back()
            }}
          >
            Confirm
          </button>
        </div>
      )}
      <button type="button" className="lk" onClick={back}>
        Back to bill
      </button>
    </>
  )
}

function EditSplit({ bill, back }: { bill: Bill; back: () => void }) {
  const house = useHouse()
  const members = house.members.filter((m) => bill.shares[m.id])
  const [split, setSplit] = useState<SplitState>({
    mode: bill.splitMode,
    inputs: Object.fromEntries(members.map((m) => [m.id, centsToInput(bill.shares[m.id].amountCents)])),
  })
  const valid = splitIsValid(split, members, bill.totalCents)
  return (
    <>
      <BackTop title="Edit split" subtitle={`${bill.name}, total ${formatMoney(bill.totalCents)}`} back={back} />
      <div style={{ height: 12 }} />
      <SplitEditor state={split} onChange={setSplit} members={members} meId={house.me.id} totalCents={bill.totalCents} />
      <button
        type="button"
        className="btn"
        disabled={!valid}
        onClick={() => {
          house.actions.saveSplit(bill.id, split.mode, splitAmounts(split, members) as Record<string, number>)
          back()
        }}
      >
        Save split
      </button>
      <button type="button" className="lk" onClick={back}>
        Cancel
      </button>
    </>
  )
}

function LockedDialog({ bill, house, onClose }: { bill: Bill; house: House; onClose: () => void }) {
  const who = whoActed(bill).map((id) => nameFor(house, id))
  const names = who.length > 1 ? `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}` : who[0]
  return (
    <Dialog label="Split is locked" onClose={onClose} alert>
      <div className="bg" aria-hidden="true">
        🔒
      </div>
      <b>The split is locked</b>
      <p>{names} already paid, so the split can’t change now. To change it, ask them to undo their payment first.</p>
      <button type="button" className="btn" onClick={onClose}>
        Got it
      </button>
    </Dialog>
  )
}
