import { Avatar } from '../../../components/Avatar'
import { Segmented } from '../../../components/Segmented'
import type { Member } from '../../../lib/bills'
import { formatMoney, splitEqual, sumCents } from '../../../lib/money'
import { splitAmounts, type SplitState } from './split'

/** "Each person pays $48.20" or a box per housemate, with a live "left to assign" line. */
export function SplitEditor({
  state,
  onChange,
  members,
  meId,
  totalCents,
}: {
  state: SplitState
  onChange: (s: SplitState) => void
  members: Member[]
  meId: string
  totalCents: number | null
}) {
  const equal = totalCents ? splitEqual(totalCents, members.length) : []
  const amounts = splitAmounts(state, members)
  const sum = sumCents(Object.values(amounts).map((a) => a ?? 0))
  const left = (totalCents ?? 0) - sum
  const unequal = equal.length > 1 && equal[0] !== equal[equal.length - 1]

  let status = ''
  if (!totalCents) status = 'Enter the total amount first.'
  else if (Object.values(amounts).some((a) => a === null)) status = 'Enter an amount for everyone (0 is fine).'
  else if (left === 0) status = `Adds up to ${formatMoney(totalCents)}.`
  else if (left > 0) status = `${formatMoney(left)} left to assign of ${formatMoney(totalCents)}.`
  else status = `${formatMoney(-left)} over ${formatMoney(totalCents)}.`

  return (
    <>
      <Segmented
        label="How to split"
        options={[
          ['equal', 'Split equally'],
          ['custom', 'Custom amounts'],
        ]}
        value={state.mode}
        onChange={(mode) => {
          // Start custom amounts from the equal split, like the prototype
          const inputs =
            mode === 'custom' && totalCents
              ? Object.fromEntries(members.map((m, i) => [m.id, (equal[i] / 100).toFixed(2)]))
              : state.inputs
          onChange({ mode, inputs })
        }}
        className="no-top"
      />
      {state.mode === 'equal' ? (
        <div className="dl">
          <div>
            <span>Each person pays</span>
            <b>{totalCents ? formatMoney(equal[equal.length - 1]) : '–'}</b>
          </div>
          {unequal && (
            <div>
              <span>Extra cent goes to</span>
              <b>{members.slice(0, totalCents! % members.length).map((m) => (m.id === meId ? 'You' : m.name)).join(', ')}</b>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="dl">
            {members.map((m) => (
              <div key={m.id} className="ar">
                <Avatar name={m.name} hue={m.hue} size={30} />
                <b style={{ textAlign: 'left' }}>{m.id === meId ? 'You' : m.name}</b>
                <input
                  className="amt-in"
                  inputMode="decimal"
                  aria-label={`${m.name} amount`}
                  value={state.inputs[m.id] ?? ''}
                  onChange={(e) => onChange({ ...state, inputs: { ...state.inputs, [m.id]: e.target.value } })}
                />
              </div>
            ))}
          </div>
          <small className="hint" role="status" style={{ margin: '0 2px 10px' }}>
            {status}
          </small>
        </>
      )}
    </>
  )
}
