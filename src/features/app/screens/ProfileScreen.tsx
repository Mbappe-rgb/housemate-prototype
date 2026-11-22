import { Link } from 'react-router'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { useToast } from '../../../components/Toast'
import { THEMES, normalizeTheme } from '../../../app/theme'
import { supabase } from '../../../lib/supabase'
import { useHouse } from '../../house/house'
import { Sec } from '../parts'
import { useAppUI } from '../ui'

function Toggle({ label, sub, on, onChange }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" className="srow" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      <div>
        <b>{label}</b>
        {sub && <small>{sub}</small>}
      </div>
      <i className={`sw ${on ? 'on' : ''}`} />
    </button>
  )
}

/** Profile (v5): you, your household, settings, log out. */
export function ProfileScreen() {
  const house = useHouse()
  const ui = useAppUI()
  const toast = useToast()
  const { settings } = house
  const save = house.actions.saveSettings
  const theme = normalizeTheme(settings.theme)

  return (
    <div className="pfv">
      <h1 className="pft2">Profile</h1>
      <button type="button" className="pcd" onClick={ui.openEditProfile} aria-label="Edit profile">
        <Avatar name={house.me.name} hue={house.me.hue} size={64} />
        <span className="pcn">
          <b>{house.me.name}</b>
          <small>{house.me.email ?? house.me.etransfer ?? 'Add your e-transfer details'}</small>
        </span>
        <Icon name="right" size={18} />
      </button>

      <Sec title="Household" />
      <Link to="../household" className="pcd hh">
        <span className="bi" aria-hidden="true">
          🏠
        </span>
        <span className="pcn">
          <b>{house.household.name}</b>
          <small>
            {house.members.length} {house.members.length === 1 ? 'housemate' : 'housemates'}
          </small>
        </span>
        <Icon name="right" size={18} />
      </Link>

      <Sec title="Appearance" />
      <div className="chips" role="radiogroup" aria-label="Colour theme">
        {THEMES.map(([key, label]) => (
          <button key={key} type="button" role="radio" aria-checked={theme === key} className={`ch ${theme === key ? 'on' : ''}`} onClick={() => save({ theme: key })}>
            {label}
          </button>
        ))}
      </div>

      <Sec title="Settings" />
      <div className="card2" style={{ padding: '2px 16px' }}>
        <Toggle label="Notifications" on={settings.notifyEnabled} onChange={(v) => save({ notifyEnabled: v })} />
        {settings.notifyEnabled && (
          <>
            <Toggle label="Bill reminders" sub="2 days before a bill is due" on={settings.notifyBills} onChange={(v) => save({ notifyBills: v })} />
            <Toggle label="Chore reminders" sub="The morning a chore is due" on={settings.notifyChores} onChange={(v) => save({ notifyChores: v })} />
          </>
        )}
      </div>
      <small className="hint" style={{ margin: '0 4px 12px' }}>
        Reminders show in the app today. Emails start soon.
      </small>

      <button
        type="button"
        className="btn sec"
        onClick={() => (house.mode === 'demo' ? toast('This is the demo, there’s no account to log out of') : void supabase.auth.signOut())}
      >
        Log out
      </button>
    </div>
  )
}
