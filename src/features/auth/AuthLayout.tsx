import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from '../../components/Icon'
import { useTheme } from '../../app/theme'

type AuthPageProps = {
  title: string
  subtitle?: ReactNode
  /** a route to go back to, or a handler */
  back?: string | (() => void)
  /** onboarding progress, 1-3 */
  step?: number
  children: ReactNode
}

/**
 * Logged-out and setup pages (v5): a gradient header with an optional back button, title and one line,
 * over a white sheet that holds the form. Buttons sit at the bottom (put <Spacer /> above them).
 */
export function AuthPage({ title, subtitle, back, step, children }: AuthPageProps) {
  // Before sign-in there's no saved theme, so these pages use the default
  useTheme('forest')
  return (
    <main className="v2">
      <div className="hero2" style={{ paddingBottom: 54 }}>
        {typeof back === 'string' ? (
          <Link to={back} className="cbtn" aria-label="Back">
            <Icon name="left" size={22} />
          </Link>
        ) : back ? (
          <button type="button" className="cbtn" onClick={back} aria-label="Back">
            <Icon name="left" size={22} />
          </button>
        ) : (
          <div style={{ height: 48 }} />
        )}
        <h1 className="hh">{title}</h1>
        {subtitle && <p className="hs">{subtitle}</p>}
      </div>
      <div className="sh2 white pg">
        {step ? (
          <div className="dots2" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((i) => (
              <i key={i} className={i <= step ? 'on' : ''} />
            ))}
          </div>
        ) : null}
        {children}
      </div>
    </main>
  )
}

/** Pushes the buttons below it to the bottom of the sheet. */
export function Spacer() {
  return <div className="sp" />
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <small className="err" role="alert">
      {message}
    </small>
  )
}

/** Big option row ("Create a household", "Join a household"). */
export function BigOption({ icon, title, text, to, onClick }: { icon: 'household' | 'link'; title: string; text: string; to?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className="c">
        <Icon name={icon} size={26} />
      </span>
      <div>
        <b>{title}</b>
        <small>{text}</small>
      </div>
      <Icon name="right" size={18} />
    </>
  )
  return to ? (
    <Link to={to} className="bigopt">
      {inner}
    </Link>
  ) : (
    <button type="button" className="bigopt" onClick={onClick}>
      {inner}
    </button>
  )
}
