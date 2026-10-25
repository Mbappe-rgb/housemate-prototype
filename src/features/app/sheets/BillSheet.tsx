import { useState } from 'react'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { Dialog, Sheet } from '../../../components/Sheet'
import { useToast } from '../../../components/Toast'
import { copyText } from '../../../lib/clipboard'
import { isSplitLocked, isTodo, othersCount, othersPaid, shareOf, type Bill } from '../../../lib/bills'
import { daysBetween, dueText, shortDate } from '../../../lib/dates'
import { centsToInput, formatMoney, splitEqual } from '../../../lib/money'
import { memberById, nameFor, useHouse, type House } from '../../house/house'
import { categoryLabel } from '../../house/demoData'
import { SplitEditor } from './SplitEditor'
import { splitAmounts, splitIsValid, type SplitState } from './split'

type View = 'detail' | 'settings' | 'payto' | 'split'
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function BillSheet({ billId, onClose }: { billId: string; onClose: () => void }) {
  const house = useHouse()
  const bill = house.bills.find((b) => b.id === billId)
  const [view, setView] = useState<View>('detail')
  const [locked, setLocked] = useState(false)

  if (!bill) return null

  return (
    <>
      <Sheet label="Bill details" onClose={onClose}>
        {view === 'detail' && (
          <Detail
            bill={bill}
            onClose={onClose}
            go={setView}
            onEditSplit={() => (isSplitLocked(bill) ? setLocked(true) : setView('split'))}
          />
        )}
        {view === 'settings' && <Settings bill={bill} back={() => setView('detail')} />}
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
      <button type="button" className="ib sm" onClick={back} aria-label="Back">
        <Icon name="back" size={18} />
      </button>
      <div>
        <b>{title}</b>
        <small>{subtitle}</small>
      </div>
    </div>
  )
}

function Detail({
  bill,
  onClose,
  go,
  onEditSplit,
}: {
  bill: Bill
  onClose: () => void
  go: (v: View) => void
  onEditSplit: () => void
}) {
  const house = useHouse()
  const me = house.me.id
  const iPay = bill.payerId === me
  const todo = isTodo(bill, me)
  const late = todo && daysBetween(house.today, bill.dueDate) < 0
  const payer = memberById(house, bill.payerId)
  const payerName = payer?.name ?? 'a former housemate'
  const myShare = shareOf(bill, me)
  const [receipt, setReceipt] = useState<string | null>(null)
  const equalEach = splitEqual(bill.totalCents, Object.keys(bill.shares).length)

  return (
    <>
      <div className="top">
        <span className="em" aria-hidden="true">
          {bill.emoji}
        </span>
        <div>
          <b>{bill.name}</b>
          <small className={late ? 'pd' : ''}>{capitalize(dueText(bill.dueDate, house.today))}</small>
        </div>
        <button type="button" className="ib sm" onClick={() => go('settings')} aria-label="Bill settings">
          <Icon name="settings" size={18} />
        </button>
      </div>

      <h4>Bill breakdown</h4>
      <small>{iPay ? 'Total you’re paying' : 'Your share'}</small>
      <div className="amt">{formatMoney(iPay ? bill.totalCents : myShare)}</div>
      <div className="dl">
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
            {bill.splitMode === 'custom' ? 'Custom' : `Equal, ${formatMoney(equalEach[equalEach.length - 1])} each`}
            {bill.createdBy === me && (
              <button type="button" className="pen" onClick={onEditSplit} aria-label="Edit split">
                <Icon name="pen" size={14} />
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

      <h4>Pay to</h4>
      <button type="button" className="pto" onClick={() => go('payto')}>
        <Avatar name={payerName} hue={payer?.hue ?? 0} size={42} />
        <div>
          <b>{iPay ? 'You' : payerName}</b>
          <small>View account details</small>
        </div>
        <Icon name="next" size={18} />
      </button>
      <small className="msg">
        {iPay
          ? 'Housemates pay you back. They can see your account details.'
          : `Send ${payerName} ${formatMoney(myShare)} outside HouseMate, then confirm here.`}
      </small>

      <h4>Payment progress</h4>
      <div className="ph2">
        <small>{iPay ? 'Housemates who have paid you' : `Housemates who have paid ${payerName}`}</small>
        <small>
          <b>
            {othersPaid(bill)}/{othersCount(bill)}
          </b>{' '}
          paid
        </small>
      </div>
      <div className="sgb" aria-hidden="true">
        {Object.entries(bill.shares)
          .filter(([id]) => id !== bill.payerId)
          .map(([id, s]) => (
            <i key={id} className={s.paidAt ? 'on' : ''} />
          ))}
      </div>
      {house.members
        .filter((m) => bill.shares[m.id])
        .map((m) => {
          const s = bill.shares[m.id]
          let tag
          if (m.id === bill.payerId) tag = <em className="tg ok">{s.paidAt ? 'Paying, paid it' : 'Paying the bill'}</em>
          else if (s.paidAt) tag = <em className="tg ok">Paid</em>
          else if (iPay)
            tag = (
              <button type="button" className="tg lnk" onClick={() => house.actions.markReceived(bill.id, m.id)}>
                Mark received
              </button>
            )
          else tag = <em className="tg w">Not yet</em>
          return (
            <div key={m.id} className="mr">
              <Avatar name={m.name} hue={m.hue} size={30} />
              <span>
                {nameFor(house, m.id)} <small>{formatMoney(s.amountCents)}</small>
              </span>
              {tag}
            </div>
          )
        })}

      {todo ? (
        <>
          <label className={`up ${receipt ? 'on' : ''}`} style={{ marginTop: 14 }}>
            <input
              type="file"
              accept="image/*,.pdf"
              hidden
              onChange={(e) => setReceipt(e.target.files?.[0]?.name ?? null)}
            />
            <span className="em" aria-hidden="true">
              {receipt ? <Icon name="check" size={20} /> : '📎'}
            </span>
            <span>
              {receipt ?? (iPay ? 'Attach the receipt from the provider' : 'Attach payment receipt')}
              <small>{receipt ? 'Tap to replace' : 'Optional, a photo or PDF works'}</small>
            </span>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              house.actions.markPaid(bill.id, receipt)
              onClose()
            }}
          >
            {iPay ? 'Confirm I paid the bill' : 'Confirm paid'}
          </button>
          <button type="button" className="lk" onClick={onClose}>
            Dismiss
          </button>
        </>
      ) : (
        <>
          <button type="button" className="btn ghost" disabled style={{ marginTop: 14 }}>
            {iPay ? 'You paid this bill' : 'You’ve paid your share'}
          </button>
          <button
            type="button"
            className="lk"
            onClick={() => {
              house.actions.undoPaid(bill.id)
              onClose()
            }}
          >
            Undo
          </button>
          <button type="button" className="lk" onClick={onClose} style={{ paddingTop: 0 }}>
            Close
          </button>
        </>
      )}
    </>
  )
}

function Settings({ bill, back }: { bill: Bill; back: () => void }) {
  const house = useHouse()
  const [payerId, setPayerId] = useState(bill.payerId)
  const [monthly, setMonthly] = useState(bill.recurrence === 'monthly')
  const payerName = payerId === house.me.id ? 'you' : (memberById(house, payerId)?.name ?? 'them')
  return (
    <>
      <BackTop title="Bill settings" subtitle={`${bill.name}, created by ${nameFor(house, bill.createdBy)}`} back={back} />
      <h4 id="payer-label">Who’s paying this bill?</h4>
      <div role="radiogroup" aria-labelledby="payer-label">
        {house.members.map((m) => (
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
    </>
  )
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const toast = useToast()
  return (
    <div className="ar">
      <span>{label}</span>
      <b>{value}</b>
      <button
        type="button"
        className="tg lnk"
        onClick={() => copyText(value, toast)}
      >
        Copy
      </button>
    </div>
  )
}

function PayTo({ bill, back }: { bill: Bill; back: () => void }) {
  const house = useHouse()
  const iPay = bill.payerId === house.me.id
  const payer = memberById(house, bill.payerId)
  const name = payer?.name ?? 'A former housemate'
  const hasDetails = payer?.etransferEmail || payer?.phone || payer?.bankName
  return (
    <>
      <BackTop title={iPay ? 'Your payment details' : `Pay to ${name}`} subtitle={bill.name} back={back} />
      <div className="pc">
        <Avatar name={name} hue={payer?.hue ?? 0} size={64} />
        <b>{iPay ? 'You' : name}</b>
        <small>{iPay ? 'Housemates see these details' : `Paying ${bill.name.toLowerCase()} for the household`}</small>
      </div>
      <div className="dl">
        {payer?.etransferEmail && <CopyRow label="Interac e-transfer" value={payer.etransferEmail} />}
        {payer?.phone && <CopyRow label="Phone" value={payer.phone} />}
        {payer?.bankName && (
          <div>
            <span>Bank</span>
            <b>{payer.bankName}</b>
          </div>
        )}
        {!hasDetails && (
          <div>
            <span>{iPay ? 'Add your e-transfer email in Profile' : `${name} hasn’t added payment details yet`}</span>
          </div>
        )}
        {!iPay && <CopyRow label="Amount to send" value={centsToInput(shareOf(bill, house.me.id))} />}
      </div>
      <small className="hint" style={{ margin: '0 2px 12px' }}>
        Add “{bill.name}” in the e-transfer message so it’s easy to match.
      </small>
      <button type="button" className="btn" onClick={back}>
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
          const amounts = splitAmounts(split, members) as Record<string, number>
          house.actions.saveSplit(bill.id, split.mode, amounts)
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
  const who = Object.entries(bill.shares)
    .filter(([id, s]) => id !== bill.payerId && s.paidAt)
    .map(([id]) => nameFor(house, id))
  const names = who.length > 1 ? `${who.slice(0, -1).join(', ')} and ${who[who.length - 1]}` : who[0]
  return (
    <Dialog label="Split is locked" onClose={onClose} alert>
      <div className="bg" aria-hidden="true">
        🔒
      </div>
      <b>The split is locked</b>
      <p>
        {names} already paid, so the split can’t change now. To change it, ask them to undo their payment first.
      </p>
      <button type="button" className="btn" onClick={onClose}>
        Got it
      </button>
    </Dialog>
  )
}
