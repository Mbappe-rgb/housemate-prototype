import { Avatar } from '../../../components/Avatar'
import { Dialog } from '../../../components/Sheet'
import { useToast } from '../../../components/Toast'
import { copyText } from '../../../lib/clipboard'
import { iOweTo, owedBy } from '../../../lib/bills'
import { formatMoney } from '../../../lib/money'
import { memberById, useHouse } from '../../house/house'
import { useAppUI } from '../ui'

/** A housemate: their e-transfer detail, what they owe you and what you owe them. */
export function MemberSheet({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const house = useHouse()
  const ui = useAppUI()
  const toast = useToast()
  const m = memberById(house, memberId)
  if (!m) return null
  const me = house.me.id
  return (
    <Dialog label={m.name} onClose={onClose} className="mpop">
      <Avatar name={m.name} hue={m.hue} size={64} />
      <b style={{ display: 'block', marginTop: 10 }}>{m.name}</b>
      {m.role === 'owner' && (
        <em className="tg ok" style={{ display: 'inline-block', marginTop: 6 }}>
          Admin
        </em>
      )}
      <div className="dl" style={{ margin: '14px 0 6px', textAlign: 'left' }}>
        <div>
          <span>E-transfer</span>
          <b>{m.etransfer || 'Not added yet'}</b>
        </div>
      </div>
      <div className="dl" style={{ margin: '6px 0 14px', textAlign: 'left' }}>
        <div>
          <span>They owe you</span>
          <b>{formatMoney(owedBy(house.bills, me, m.id))}</b>
        </div>
        <div>
          <span>You owe them</span>
          <b>{formatMoney(iOweTo(house.bills, me, m.id))}</b>
        </div>
      </div>
      {m.etransfer && (
        <button
          type="button"
          className="btn"
          onClick={() => {
            copyText(m.etransfer!, toast)
            onClose()
          }}
        >
          Copy e-transfer details
        </button>
      )}
      {house.isAdmin && (
        <button type="button" className="lk" style={{ color: 'var(--warn)' }} onClick={() => ui.confirmRemove(m.id)}>
          Remove from household
        </button>
      )}
      <button type="button" className="lk" onClick={onClose}>
        Close
      </button>
    </Dialog>
  )
}
