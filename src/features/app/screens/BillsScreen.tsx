import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { Segmented } from '../../../components/Segmented'
import { amountOwed, isTodo, sortByDue, toPay } from '../../../lib/bills'
import { formatMoney } from '../../../lib/money'
import { useHouse } from '../../house/house'
import { BillRow, Empty, Section } from '../parts'
import { useAppUI } from '../ui'

type Filter = 'all' | 'to' | 'done'

export function BillsScreen() {
  const house = useHouse()
  const ui = useAppUI()
  const [filter, setFilter] = useState<Filter>('all')
  const me = house.me.id
  const sorted = sortByDue(house.bills)
  const todo = sorted.filter((b) => isTodo(b, me))
  const done = sorted.filter((b) => !isTodo(b, me))

  return (
    <div className="scr">
      <header className="hd">
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            Bills
          </h1>
          <small>
            {toPay(house.bills, me).length} to pay, {formatMoney(amountOwed(house.bills, me))} you owe
          </small>
        </div>
        <button type="button" className="ib" onClick={ui.openAddBill} aria-label="Add a bill">
          <Icon name="plus" size={20} />
        </button>
      </header>

      {house.bills.length === 0 ? (
        <Empty>
          No bills yet.
          <br />
          {house.moneyReady ? 'Add rent, internet or hydro to start splitting.' : 'Shared bills arrive in the next update.'}
        </Empty>
      ) : (
        <>
          <Segmented
            label="Show"
            options={[
              ['all', 'All'],
              ['to', 'To pay'],
              ['done', 'Done'],
            ]}
            value={filter}
            onChange={setFilter}
            className="no-top"
          />
          {filter !== 'done' && todo.length > 0 && (
            <Section title="To pay">
              {todo.map((b) => (
                <BillRow key={b.id} bill={b} long />
              ))}
            </Section>
          )}
          {filter !== 'to' && done.length > 0 && (
            <Section title="Done">
              {done.map((b) => (
                <BillRow key={b.id} bill={b} long />
              ))}
            </Section>
          )}
          {filter === 'to' && todo.length === 0 && <Empty>You’re all settled. Nothing to pay.</Empty>}
          {filter === 'done' && done.length === 0 && <Empty>No bills paid yet.</Empty>}
        </>
      )}
      <button type="button" className="btn" style={{ marginTop: 12 }} onClick={ui.openAddBill}>
        Add a bill
      </button>
    </div>
  )
}
