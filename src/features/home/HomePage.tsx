import { useAuth } from '../../app/auth'
import { LogOutButton } from '../auth/LogOutButton'

/** Placeholder home. The real dashboard is ported from the prototype in Phase 1. */
export function HomePage() {
  const { profile, membership } = useAuth()
  return (
    <main className="page">
      <p className="brand">HouseMate</p>
      <h1>Hi {profile?.display_name}</h1>
      <p className="muted">
        You’re in <strong>{membership?.household.name}</strong> as {membership?.role === 'owner' ? 'the owner' : 'a member'}.
      </p>
      <LogOutButton />
    </main>
  )
}
