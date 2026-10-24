import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './auth'
import { stageFor, type Stage } from './stage'

/**
 * Route guard. Renders the nested routes only when the person is at the `stage` they belong in
 * (see stageFor), otherwise sends them there.
 */
export function Gate({ stage }: { stage: Stage }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.loading) return <Splash />
  if (auth.session && auth.loadError) return <LoadError message={auth.loadError} retry={auth.refresh} />

  const target = stageFor(auth)
  if (target !== stage) return <Navigate to={target} replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function Splash() {
  return (
    <main className="page page-center" aria-busy="true">
      <p className="muted">Loading…</p>
    </main>
  )
}

function LoadError({ message, retry }: { message: string; retry: () => Promise<void> }) {
  return (
    <main className="page page-center">
      <p role="alert">{message}</p>
      <button type="button" className="btn" onClick={() => void retry()}>
        Try again
      </button>
    </main>
  )
}
