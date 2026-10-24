import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { useTheme } from '../../app/theme'

/** Back button row, optionally with onboarding progress dots (1-3). */
export function BackBar({ to, onBack, step }: { to?: string; onBack?: () => void; step?: number }) {
  const button = to ? (
    <Link to={to} className="ib" aria-label="Back">
      <Icon name="back" size={20} />
    </Link>
  ) : onBack ? (
    <button type="button" className="ib" aria-label="Back" onClick={onBack}>
      <Icon name="back" size={20} />
    </button>
  ) : (
    <span className="end" />
  )
  return (
    <div className="obh">
      {button}
      {step ? (
        <div className="dots2" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
      ) : (
        <span className="sp" />
      )}
      <span className="end" />
    </div>
  )
}

/** Full-screen onboarding/auth layout from the prototype. */
export function AuthLayout({ children }: { children: ReactNode }) {
  // Logged-out and setup screens always use the default theme
  useTheme('lime')
  return <main className="ob">{children}</main>
}

/** Big centred logo + title, for landing and "all done" screens. */
export function Hero({ emoji = '🏠', title, text }: { emoji?: string; title: string; text?: ReactNode }) {
  return (
    <div className="obm">
      <div className="logo" aria-hidden="true">
        {emoji}
      </div>
      <h1>{title}</h1>
      {text && <p>{text}</p>}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <small className="err" role="alert">
      {message}
    </small>
  )
}
