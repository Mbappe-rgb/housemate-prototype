import { useState } from 'react'
import { Avatar } from '../../../components/Avatar'
import { Segmented } from '../../../components/Segmented'
import { Sheet } from '../../../components/Sheet'
import { addDays } from '../../../lib/dates'
import { parseMoney } from '../../../lib/money'
import { useHouse } from '../../house/house'
import { BILL_CATEGORIES, BILL_EMOJIS } from '../../house/demoData'
import { SplitEditor } from './SplitEditor'
import { splitAmounts, splitIsValid, type SplitState } from './split'

export function AddBillSheet({ onClose }: { onClose: () => void }) {
  const house = useHouse()
  const [type, setType] = useState<'monthly' | 'none'>('monthly')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Other')
  const [emoji, setEmoji] = useState('🧾')
  const [split, setSplit] = useState<SplitState>({ mode: 'equal', inputs: {} })
  const [payerId, setPayerId] = useState(house.me.id)
  const [dueDate, setDueDate] = useState(addDays(house.today, 7))

  const total = parseMoney(amount)
  const totalOk = total !== null && total > 0
  const valid = name.trim().length > 0 && totalOk && splitIsValid(split, house.members, total) && dueDate >= house.today
  const payerName = payerId === house.me.id ? 'you' : (house.members.find((m) => m.id === payerId)?.name ?? '')

  return (
    <Sheet label="Add a bill" onClose={onClose}>
      <div className="top">
        <div>
          <b className="lg">Add a bill</b>
          <small>Your housemates see it right away</small>
        </div>
      </div>
      <Segmented
        label="Bill type"
        options={[
          ['monthly', 'Recurring'],
          ['none', 'One time'],
        ]}
        value={type}
        onChange={setType}
      />

      <h4>Bill name and total</h4>
      <div className="two">
        <input className="fld" placeholder="e.g. Hydro" aria-label="Bill name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="fld amt2"
          inputMode="decimal"
          placeholder="$ total"
          aria-label="Total amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      {amount && !totalOk && <small className="err">Enter an amount like 120 or 120.50.</small>}

      <h4>Category</h4>
      <select
        className="fld sel"
        aria-label="Category"
        value={category}
        onChange={(e) => {
          setCategory(e.target.value)
          setEmoji(BILL_CATEGORIES.find((c) => c[0] === e.target.value)?.[1] ?? emoji)
        }}
      >
        {BILL_CATEGORIES.map(([c, e]) => (
          <option key={c} value={c}>
            {e} {c}
          </option>
        ))}
      </select>

      <h4>Emoji</h4>
      <div className="ems" role="radiogroup" aria-label="Emoji">
        {BILL_EMOJIS.map((e) => (
          <button key={e} type="button" role="radio" aria-checked={emoji === e} aria-label={`Emoji ${e}`} className={`eb ${emoji === e ? 'on' : ''}`} onClick={() => setEmoji(e)}>
            {e}
          </button>
        ))}
      </div>

      <h4>Split</h4>
      <SplitEditor state={split} onChange={setSplit} members={house.members} meId={house.me.id} totalCents={totalOk ? total : null} />

      <h4 id="add-payer">Pay to</h4>
      <div role="radiogroup" aria-labelledby="add-payer">
        {house.members.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={payerId === m.id} className="opt" onClick={() => setPayerId(m.id)}>
            <Avatar name={m.name} hue={m.hue} size={30} />
            <span>{m.id === house.me.id ? `Me (${m.name})` : m.name}</span>
            <i className="rd" />
          </button>
        ))}
      </div>
      <small className="hint" style={{ margin: '4px 2px' }}>
        Everyone else pays {payerName} back.
      </small>

      <h4>Due date</h4>
      <input className="fld" type="date" min={house.today} aria-label="Due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      {type === 'monthly' && <small className="hint">Repeats on this day every month.</small>}

      <button
        type="button"
        className="btn"
        style={{ marginTop: 18 }}
        disabled={!valid}
        onClick={() => {
          house.actions.addBill({
            name: name.trim(),
            category,
            emoji,
            totalCents: total!,
            dueDate,
            payerId,
            recurrence: type,
            splitMode: split.mode,
            amounts: splitAmounts(split, house.members) as Record<string, number>,
          })
          onClose()
        }}
      >
        Add bill
      </button>
      <button type="button" className="lk" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  )
}
