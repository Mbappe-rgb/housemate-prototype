import { useNavigate } from 'react-router'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { useHouse } from '../../house/house'
import { InvitePanel } from '../../invites/InvitePanel'
import { Section } from '../parts'
import { useAppUI } from '../ui'

export function HouseholdScreen() {
  const house = useHouse()
  const ui = useAppUI()
  const navigate = useNavigate()

  return (
    <div className="scr">
      <div className="obh" style={{ marginBottom: 10 }}>
        <button type="button" className="ib" onClick={() => navigate('..')} aria-label="Back">
          <Icon name="back" size={20} />
        </button>
        <h1 style={{ flex: 1, fontSize: 17, margin: 0 }}>Household</h1>
        <span className="end" />
      </div>

      <div className="card" style={{ padding: 18, textAlign: 'center' }}>
        <div className="logo sm" aria-hidden="true">
          🏠
        </div>
        <b style={{ fontSize: 20 }}>{house.household.name}</b>
        <small style={{ display: 'block', marginTop: 4 }}>
          {house.members.length} {house.members.length === 1 ? 'housemate' : 'housemates'}
        </small>
      </div>

      <Section title="Members">
        <div className="card" style={{ padding: '4px 14px' }}>
          {house.members.map((m) => (
            <div key={m.id} className="mr" style={{ padding: '11px 0' }}>
              <Avatar name={m.name} hue={m.hue} size={40} />
              <span>
                {m.id === house.me.id ? 'You' : m.name}
                {m.etransferEmail && <small style={{ display: 'block', fontWeight: 400 }}>{m.etransferEmail}</small>}
              </span>
              {m.role === 'owner' && <em className="tg ok">Admin</em>}
              {m.id === house.me.id ? (
                <em className="tg">You</em>
              ) : (
                house.isAdmin && (
                  <button type="button" className="tg" onClick={() => ui.confirmRemove(m.id)} aria-label={`Remove ${m.name}`}>
                    Remove
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Invite housemates">
        <InvitePanel />
        {!house.isAdmin && <small className="hint">The admin approves everyone who asks to join.</small>}
      </Section>

      <button type="button" className="btn sec" style={{ marginTop: 18, color: 'var(--warn)' }} onClick={ui.confirmLeave}>
        Leave household
      </button>
    </div>
  )
}
