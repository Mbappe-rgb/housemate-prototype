import { useState } from 'react'
import { Sheet } from '../../../components/Sheet'
import { dayName, shortDate } from '../../../lib/dates'
import { nameFor, useHouse } from '../../house/house'
import { useAppUI } from '../ui'

const REPEATS = { none: 'Once', daily: 'Every day', weekly: 'Every week' } as const

/** Chore details: who, when, repeats, done/undo and delete (creator or admin). */
export function ChoreSheet({ choreId, onClose }: { choreId: string; onClose: () => void }) {
  const house = useHouse()
  const ui = useAppUI()
  const chore = house.chores.find((c) => c.id === choreId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!chore) return null
  const canDelete = chore.createdBy === house.me.id || house.isAdmin
  const done = !!chore.doneAt

  return (
    <Sheet label="Chore details" onClose={onClose}>
      <div className="top">
        <span className="em" aria-hidden="true">
          {chore.emoji}
        </span>
        <div>
          <b>{chore.title}</b>
          <small>{done ? 'Done' : `${dayName(chore.dueDate, house.today)}, ${shortDate(chore.dueDate)}`}</small>
        </div>
      </div>
      <div className="dl" style={{ marginTop: 14 }}>
        <div>
          <span>For</span>
          <b>{nameFor(house, chore.assigneeId)}</b>
        </div>
        <div>
          <span>Due</span>
          <b>{shortDate(chore.dueDate)}</b>
        </div>
        <div>
          <span>Repeats</span>
          <b>{REPEATS[chore.recurrence]}</b>
        </div>
        {chore.createdBy && (
          <div>
            <span>Added by</span>
            <b>{nameFor(house, chore.createdBy)}</b>
          </div>
        )}
      </div>
      {chore.recurrence !== 'none' && !done && (
        <small className="hint" style={{ margin: '0 2px 12px' }}>
          When it’s done, the next one is added for {chore.recurrence === 'daily' ? 'the next day' : 'a week later'}.
        </small>
      )}
      {done ? (
        <button
          type="button"
          className="btn sec"
          onClick={() => {
            house.actions.reopenChore(chore.id)
            onClose()
          }}
        >
          Undo, it’s not done
        </button>
      ) : (
        <button type="button" className="btn" onClick={() => ui.confirmChore(chore.id)}>
          Mark as done
        </button>
      )}
      {canDelete &&
        (confirmDelete ? (
          <button
            type="button"
            className="btn danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const err = await house.actions.deleteChore(chore.id)
              setBusy(false)
              if (!err) onClose()
            }}
          >
            {busy ? 'Deleting…' : `Yes, delete ${chore.title}`}
          </button>
        ) : (
          <button type="button" className="lk" style={{ color: 'var(--warn)' }} onClick={() => setConfirmDelete(true)}>
            Delete chore
          </button>
        ))}
      <button type="button" className="lk" onClick={onClose}>
        Close
      </button>
    </Sheet>
  )
}
