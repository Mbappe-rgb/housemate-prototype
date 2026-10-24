import { useState } from 'react'
import { Avatar } from '../../../components/Avatar'
import { Segmented } from '../../../components/Segmented'
import { Sheet } from '../../../components/Sheet'
import { useHouse } from '../../house/house'
import { CHORE_EMOJIS } from '../../house/demoData'

/** New screen (the prototype only said "Add chore comes next"). Same patterns as Add a bill. */
export function AddChoreSheet({ onClose }: { onClose: () => void }) {
  const house = useHouse()
  const [title, setTitle] = useState('')
  const [emoji, setEmoji] = useState('🧹')
  const [assigneeId, setAssigneeId] = useState(house.me.id)
  const [dueDate, setDueDate] = useState(house.today)
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly'>('weekly')
  const valid = title.trim().length > 0 && dueDate >= house.today

  return (
    <Sheet label="Add a chore" onClose={onClose}>
      <div className="top">
        <div>
          <b className="lg">Add a chore</b>
          <small>Whoever it’s for gets a reminder</small>
        </div>
      </div>

      <h4>What needs doing?</h4>
      <input className="fld" placeholder="e.g. Take out the recycling" aria-label="Chore name" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />

      <h4>Emoji</h4>
      <div className="ems" role="radiogroup" aria-label="Emoji">
        {CHORE_EMOJIS.map((e) => (
          <button key={e} type="button" role="radio" aria-checked={emoji === e} aria-label={`Emoji ${e}`} className={`eb ${emoji === e ? 'on' : ''}`} onClick={() => setEmoji(e)}>
            {e}
          </button>
        ))}
      </div>

      <h4 id="chore-who">Who’s doing it?</h4>
      <div role="radiogroup" aria-labelledby="chore-who">
        {house.members.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={assigneeId === m.id} className="opt" onClick={() => setAssigneeId(m.id)}>
            <Avatar name={m.name} hue={m.hue} size={30} />
            <span>{m.id === house.me.id ? `Me (${m.name})` : m.name}</span>
            <i className="rd" />
          </button>
        ))}
      </div>

      <h4>How often?</h4>
      <Segmented
        label="How often"
        options={[
          ['none', 'Once'],
          ['daily', 'Daily'],
          ['weekly', 'Weekly'],
        ]}
        value={recurrence}
        onChange={setRecurrence}
        className="no-top"
      />

      <h4>{recurrence === 'none' ? 'Due date' : 'Starts on'}</h4>
      <input className="fld" type="date" min={house.today} aria-label="Due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />

      <button
        type="button"
        className="btn"
        style={{ marginTop: 18 }}
        disabled={!valid}
        onClick={() => {
          house.actions.addChore({ title: title.trim(), emoji, assigneeId, dueDate, recurrence })
          onClose()
        }}
      >
        Add chore
      </button>
      <button type="button" className="lk" onClick={onClose}>
        Cancel
      </button>
    </Sheet>
  )
}
