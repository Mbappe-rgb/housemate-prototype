import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../../../components/Avatar'
import { Icon } from '../../../components/Icon'
import { useToast } from '../../../components/Toast'
import { supabase } from '../../../lib/supabase'
import { useHouse } from '../../house/house'
import { Section } from '../parts'
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

export function ProfileScreen() {
  const house = useHouse()
  const ui = useAppUI()
  const toast = useToast()
  const me = house.me
  // Notification settings are saved with email reminders in Phase 7
  const [notify, setNotify] = useState({ all: true, bills: true, chores: true })

  return (
    <div className="scr">
      <header className="hd">
        <div>
          <h1 className="title" style={{ margin: 0 }}>
            Profile
          </h1>
        </div>
      </header>

      <div className="card pcard">
        <div className="pcw">
          <Avatar name={me.name} hue={me.hue} size={72} />
          <div>
            <b style={{ fontSize: 20 }}>{me.name}</b>
            {me.email && <small style={{ display: 'block', overflowWrap: 'anywhere' }}>{me.email}</small>}
            {me.phone && <small>{me.phone}</small>}
          </div>
          <button type="button" className="tg lnk" onClick={ui.openEditProfile}>
            Edit
          </button>
        </div>
        <div className="dl" style={{ margin: '14px 0 0' }}>
          <div>
            <span>E-transfer</span>
            <b>{me.etransferEmail || 'Not added'}</b>
          </div>
          <div>
            <span>Bank</span>
            <b>{me.bankName || 'Not added'}</b>
          </div>
        </div>
        <small className="hint" style={{ margin: '8px 4px 0' }}>
          Housemates see these details when they pay you.
        </small>
      </div>

      <Section title="Household">
        <Link to="household" className="card hcard" style={{ textDecoration: 'none' }}>
          <div className="hch">
            <span className="em" aria-hidden="true">
              🏠
            </span>
            <div>
              <b>{house.household.name}</b>
              <small>
                {house.members.length} {house.members.length === 1 ? 'housemate' : 'housemates'}
              </small>
            </div>
            <Icon name="next" size={18} />
          </div>
          <div className="avs" style={{ justifyContent: 'flex-start', margin: '12px 0 0' }}>
            {house.members.map((m) => (
              <Avatar key={m.id} name={m.name} hue={m.hue} size={38} />
            ))}
          </div>
        </Link>
      </Section>

      <Section title="Settings">
        <div className="card sgrp">
          <Toggle label="Notifications" on={notify.all} onChange={(all) => setNotify({ ...notify, all })} />
          <Toggle label="Bill reminders" sub="2 days before a bill is due" on={notify.bills} onChange={(bills) => setNotify({ ...notify, bills })} />
          <Toggle label="Chore reminders" sub="The morning a chore is due" on={notify.chores} onChange={(chores) => setNotify({ ...notify, chores })} />
          <div className="srow" style={{ cursor: 'default' }}>
            <div>
              <b>Currency</b>
            </div>
            <small>{house.household.currency}</small>
          </div>
          <button type="button" className="srow" onClick={() => toast('Help and feedback arrives soon')}>
            <div>
              <b>Help and feedback</b>
            </div>
            <Icon name="next" size={16} />
          </button>
        </div>
      </Section>

      <button
        type="button"
        className="btn sec"
        style={{ marginTop: 12 }}
        onClick={() => (house.mode === 'demo' ? toast('This is the demo, there’s no account to log out of') : void supabase.auth.signOut())}
      >
        Log out
      </button>
    </div>
  )
}
