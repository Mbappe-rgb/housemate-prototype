import { useRef, useState } from 'react'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { useToast } from '../../../components/Toast'
import { copyText } from '../../../lib/clipboard'
import { balanceWith, isFullySettled } from '../../../lib/bills'
import { formatMoney } from '../../../lib/money'
import { useHouse } from '../../house/house'
import { InvitePanel } from '../../invites/InvitePanel'
import { formatCode } from '../../invites/inviteFormat'
import { Sec } from '../parts'
import { useAppUI } from '../ui'

/** Household: everyone's balances, reports and invites. */
export function HouseholdScreen() {
  const house = useHouse()
  const ui = useAppUI()
  const toast = useToast()
  const [inviting, setInviting] = useState(false)
  const inviteRef = useRef<HTMLDivElement>(null)
  const me = house.me.id

  const open = house.bills.filter((b) => !isFullySettled(b)).length
  const recurring = house.bills.filter((b) => b.recurrence === 'monthly')
  const perMonth = recurring.reduce((s, b) => s + b.totalCents, 0)

  const startInvite = () => {
    setInviting(true)
    window.setTimeout(() => inviteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  return (
    <div className="v2">
      <div className="hero2 short">
        <div className="hrow">
          <h1 className="hey">Household</h1>
          <button type="button" className="cbtn" onClick={startInvite} aria-label="Invite a housemate">
            <Icon name="add" size={22} />
          </button>
        </div>
        <div className="hhd">
          <span className="hhi" aria-hidden="true">
            🏠
          </span>
          <div>
            <b>{house.household.name}</b>
            <small>
              {house.members.length} {house.members.length === 1 ? 'housemate' : 'housemates'}
            </small>
          </div>
        </div>
      </div>

      <div className="sh2">
        <div className="stats">
          <div>
            <b>{open}</b>
            <small>Open bills</small>
          </div>
          <div>
            <b>{recurring.length}</b>
            <small>Recurring</small>
          </div>
          <div>
            <b>{formatMoney(Math.round(perMonth / 100) * 100)}</b>
            <small>Per month</small>
          </div>
        </div>

        {house.isAdmin && house.joinRequests.length > 0 && (
          <button type="button" className="notice" onClick={ui.openNotifications}>
            <Icon name="household" size={20} />
            <span>
              {house.joinRequests.length === 1 ? `${house.joinRequests[0].name} wants` : `${house.joinRequests.length} people want`} to join
            </span>
            <Icon name="right" size={18} />
          </button>
        )}

        <Sec title="Housemates" />
        <div className="card2 lst">
          {house.members.map((m) => {
            const isMe = m.id === me
            const net = balanceWith(house.bills, me, m.id)
            const chip = net > 0 ? ['ok', `Owes you ${formatMoney(net)}`] : net < 0 ? ['w', `You owe ${formatMoney(-net)}`] : ['', 'Settled']
            return (
              <button key={m.id} type="button" className="mr2" onClick={() => (isMe ? ui.openEditProfile() : ui.openMember(m.id))} aria-label={isMe ? 'Your account' : `${m.name}, ${chip[1]}`}>
                <Avatar name={m.name} hue={m.hue} size={40} />
                <span className="mn">
                  <b>
                    {m.name}
                    {isMe && <em className="tg">You</em>}
                    {m.role === 'owner' && <em className="tg ok">Admin</em>}
                  </b>
                  <small>{isMe ? 'Your account' : m.etransfer || 'No e-transfer details yet'}</small>
                </span>
                {!isMe && <em className={`tg ${chip[0]}`}>{chip[1]}</em>}
                <Icon name="right" size={16} />
              </button>
            )
          })}
        </div>

        <Sec title="Payments" />
        <div className="card2 lst">
          <button type="button" className="mr2" onClick={ui.openReports}>
            <span className="hic">
              <Icon name="clock" size={20} />
            </span>
            <span className="mn">
              <b>Reports</b>
              <small>Personal and household · any period</small>
            </span>
            <Icon name="right" size={16} />
          </button>
        </div>

        <Sec title="Invite housemates" />
        <div className="card2" ref={inviteRef}>
          {house.inviteCode && (
            <div className="icode">
              <div>
                <small>Invite code</small>
                <div className="mono">{formatCode(house.inviteCode)}</div>
              </div>
              <button type="button" className="tg lnk" onClick={() => copyText(formatCode(house.inviteCode!), toast)}>
                Copy
              </button>
            </div>
          )}
          {inviting ? (
            <div style={{ marginTop: 14 }}>
              <InvitePanel />
            </div>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setInviting(true)}>
              <Icon name="mail" size={18} />
              Invite by email, link or QR
            </button>
          )}
          <small className="hint">{house.isAdmin ? 'You approve everyone who asks to join.' : 'The admin approves everyone who asks to join.'}</small>
        </div>

        <button type="button" className="lvrow" onClick={ui.confirmLeave}>
          <Icon name="close" size={16} />
          Leave household
        </button>
      </div>
    </div>
  )
}
