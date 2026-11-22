import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Icon } from '../../components/Icon'
import { useTheme } from '../../app/theme'
import { PrivacyIllustration } from './illustrations'
import { setPrivacyAccepted } from './privacy'

function Check({ on, onToggle, children }: { on: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button type="button" className="pck" role="checkbox" aria-checked={on} onClick={onToggle}>
      <span className={`pcb ${on ? 'on' : ''}`}>
        <Icon name="check" size={14} />
      </span>
      <span>{children}</span>
    </button>
  )
}

/** Shown before Sign up only (Log in skips it). Next stays disabled until both boxes are ticked. */
export function PrivacyPage() {
  useTheme('forest')
  const navigate = useNavigate()
  const [understand, setUnderstand] = useState(false)
  const [agree, setAgree] = useState(false)

  return (
    <main className="prv">
      <Link to="/welcome" className="cbtn2" aria-label="Back">
        <Icon name="left" size={20} />
      </Link>
      <div className="prill">
        <PrivacyIllustration />
      </div>
      <h1 className="prt">Your money. Your data.</h1>
      <p className="prp">
        HouseMate doesn’t collect or process your personal data, and you’ll never connect a bank account or enter sensitive banking information.
      </p>
      <div className="pcl">
        <Check on={understand} onToggle={() => setUnderstand(!understand)}>
          I understand HouseMate doesn’t collect or process my data, and I won’t share banking details in the app.
        </Check>
        <Check on={agree} onToggle={() => setAgree(!agree)}>
          I agree to the <u>Privacy Policy</u> and <u>Terms of Use</u>.
        </Check>
      </div>
      <button type="button" className="lk pacc" onClick={() => (setUnderstand(true), setAgree(true))}>
        Accept all
      </button>
      <button
        type="button"
        className="btn pnx"
        disabled={!(understand && agree)}
        onClick={() => {
          setPrivacyAccepted()
          navigate('/signup', { state: { privacy: true } })
        }}
      >
        Next
      </button>
    </main>
  )
}
