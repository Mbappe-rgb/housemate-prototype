import type { useAuth } from './auth'

export type Stage = '/welcome' | '/setup/name' | '/setup/household' | '/'

/**
 * Where this person belongs right now:
 * logged out -> Welcome; no name -> name step; no household -> Create or Join; otherwise the app.
 */
export function stageFor(auth: ReturnType<typeof useAuth>): Stage {
  if (!auth.session) return '/welcome'
  if (!auth.profile?.display_name) return '/setup/name'
  if (!auth.membership) return '/setup/household'
  return '/'
}
