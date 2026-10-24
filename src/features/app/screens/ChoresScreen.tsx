import { Avatar } from '../../../components/Avatar'
import { sortByDue } from '../../../lib/bills'
import { useHouse } from '../../house/house'
import { ChoreRow, Empty, Section } from '../parts'
import { useAppUI } from '../ui'

export function ChoresScreen() {
  const house = useHouse()
  const ui = useAppUI()
  const me = house.me.id
  const chores = sortByDue(house.chores)
  const mine = chores.filter((c) => c.assigneeId === me)
  const others = chores.filter((c) => c.assigneeId !== me)
  const open = mine.filter((c) => !c.doneAt).length

  return (
    <div className="scr">
      <header className="hd">
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            Chores
          </h1>
          <small>{open} for you this week</small>
        </div>
        <Avatar name={house.me.name} hue={house.me.hue} size={46} />
      </header>
      <Section title="Yours">
        {mine.length ? mine.map((c) => <ChoreRow key={c.id} chore={c} />) : <Empty>No chores for you.</Empty>}
      </Section>
      {others.length > 0 && (
        <Section title="Everyone else">
          {others.map((c) => (
            <ChoreRow key={c.id} chore={c} />
          ))}
        </Section>
      )}
      {!house.moneyReady && <Empty>Shared chores arrive in the next update.</Empty>}
      <button type="button" className="btn" style={{ marginTop: 12 }} onClick={ui.openAddChore}>
        Add a chore
      </button>
    </div>
  )
}
