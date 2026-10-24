import { useAuth } from '../../app/auth'
import { AuthLayout } from '../auth/AuthLayout'
import { LogOutButton } from '../auth/LogOutButton'

/** Signed in with a name but no household yet. Creating and joining arrive in Phase 3. */
export function HouseholdChoicePage() {
  const { profile } = useAuth()
  return (
    <AuthLayout title={`Hi ${profile?.display_name ?? 'there'}!`} subtitle="Start a household or join your housemates.">
      <div className="stack">
        <button type="button" className="btn" disabled aria-describedby="phase3-note">
          Create a household
        </button>
        <button type="button" className="btn sec" disabled aria-describedby="phase3-note">
          Join with an invite code
        </button>
        <p id="phase3-note" className="muted hint">
          Creating and joining households arrive in the next update.
        </p>
      </div>
      <LogOutButton />
    </AuthLayout>
  )
}
