import { useState } from 'react'
import { Segmented } from '../../components/Segmented'
import { useToast } from '../../components/Toast'
import { copyText } from '../../lib/clipboard'
import { useHouse } from '../house/house'
import { formatCode, inviteLink } from './inviteFormat'
import { QrCode } from './QrCode'

type Tab = 'email' | 'link' | 'qr'

type InvitePanelProps = {
  token: string | null
  householdName: string
  /** shown instead of the panel when there's no active invite */
  emptyMessage?: string
  onReset?: () => void
  resetting?: boolean
}

/** Email / Link / QR tabs. All three share one invite token. */
export function InvitePanelView({ token, householdName, emptyMessage, onReset, resetting }: InvitePanelProps) {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('link')
  const [email, setEmail] = useState('')
  const [emails, setEmails] = useState<string[]>([])

  if (!token) return <div className="card empty">{emptyMessage ?? 'Invites aren’t available right now.'}</div>

  const link = inviteLink(token)
  const code = formatCode(token)
  const message = `Join ${householdName} on HouseMate to split bills and chores: ${link}`

  const addEmail = () => {
    const e = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(e)) {
      if (e) toast('Check that email address')
      return
    }
    if (!emails.includes(e)) setEmails([...emails, e])
    setEmail('')
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Join ${householdName}`, text: message, url: link })
        return
      } catch {
        // cancelled or unsupported: fall back to copying
      }
    }
    copyText(link, toast, 'invite link')
  }

  return (
    <>
      <Segmented
        label="Invite by"
        options={[
          ['email', 'Email'],
          ['link', 'Link'],
          ['qr', 'QR code'],
        ]}
        value={tab}
        onChange={setTab}
        className="no-top"
      />

      {tab === 'email' && (
        <>
          <div className="two">
            <input
              className="fld"
              type="email"
              inputMode="email"
              placeholder="name@email.com"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addEmail()
              }}
            />
            <button type="button" className="btn addb" onClick={addEmail}>
              Add
            </button>
          </div>
          <div className="ecs">
            {emails.length ? (
              emails.map((e) => (
                <span key={e} className="ec">
                  {e}
                  <button type="button" aria-label={`Remove ${e}`} onClick={() => setEmails(emails.filter((x) => x !== e))}>
                    ×
                  </button>
                </span>
              ))
            ) : (
              <small>Add the emails of the people you live with. We’ll open your email app with the invite ready to send.</small>
            )}
          </div>
          {emails.length > 0 && (
            <a
              className="btn"
              style={{ marginTop: 12 }}
              href={`mailto:${emails.map(encodeURIComponent).join(',')}?subject=${encodeURIComponent(
                `Join ${householdName} on HouseMate`,
              )}&body=${encodeURIComponent(message)}`}
            >
              Email {emails.length} {emails.length > 1 ? 'people' : 'person'}
            </a>
          )}
        </>
      )}

      {tab === 'link' && (
        <>
          <div className="card lk2">
            <small>Invite link</small>
            <b className="mono">{link.replace(/^https?:\/\//, '')}</b>
            <div className="two" style={{ marginTop: 12 }}>
              <button type="button" className="btn" onClick={() => copyText(link, toast, 'invite link')}>
                Copy link
              </button>
              <button type="button" className="btn sec" onClick={() => void share()}>
                Share
              </button>
            </div>
          </div>
          <small className="hint" style={{ margin: '10px 4px' }}>
            Anyone with this link can ask to join. You approve each request.{' '}
            {onReset && (
              <button type="button" className="lk2b" onClick={onReset} disabled={resetting}>
                {resetting ? 'Resetting…' : 'Reset link'}
              </button>
            )}
          </small>
        </>
      )}

      {tab === 'qr' && (
        <>
          <QrCode text={link} label={`QR code to join ${householdName}`} />
          <p style={{ textAlign: 'center', margin: '12px 0', color: 'var(--mute)', fontSize: 15 }}>
            Housemates scan this with their phone camera to join.
          </p>
          <div className="card lk2" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <small>Or enter this code</small>
              <b className="mono" style={{ display: 'block' }}>
                {code}
              </b>
            </div>
            <button type="button" className="tg lnk" onClick={() => copyText(code, toast)}>
              Copy
            </button>
          </div>
        </>
      )}
    </>
  )
}

/** Invite panel for the current household. */
export function InvitePanel() {
  const house = useHouse()
  return (
    <InvitePanelView
      token={house.inviteCode}
      householdName={house.household.name}
      emptyMessage="Invite links arrive in the next update."
    />
  )
}
