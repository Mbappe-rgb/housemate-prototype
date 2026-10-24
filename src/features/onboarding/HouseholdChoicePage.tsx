import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toast'
import { AuthLayout, Hero } from '../auth/AuthLayout'
import { LogOutButton } from '../auth/LogOutButton'

function BigOption({ emoji, title, text, onClick }: { emoji: string; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" className="bigopt" onClick={onClick}>
      <span className="em" aria-hidden="true">
        {emoji}
      </span>
      <div>
        <b>{title}</b>
        <small>{text}</small>
      </div>
      <Icon name="next" size={18} />
    </button>
  )
}

/** Signed in with a name but no household yet. */
export function HouseholdChoicePage() {
  const toast = useToast()
  const soon = () => toast('Creating and joining households arrive in the next update')
  return (
    <AuthLayout>
      <Hero title="Welcome to HouseMate" text="Split bills and share the chores, all in one place." />
      <BigOption emoji="✨" title="Create a household" text="Start fresh and invite your housemates" onClick={soon} />
      <BigOption emoji="🔑" title="Join a household" text="Use an invite link, code or QR" onClick={soon} />
      <LogOutButton />
    </AuthLayout>
  )
}
