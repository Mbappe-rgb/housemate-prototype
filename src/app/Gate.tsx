import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './auth'
import { stageFor, type Stage } from './stage'
import { LoadingScreen } from '../components/LoadingScreen'

/**
 * Route guard. Renders the nested routes only when the person is at the `stage` they belong in
 * (see stageFor), otherwise sends them there.
 */
export function Gate({ stage }: { stage: Stage }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.loading) return <LoadingScreen />
  if (auth.session && auth.loadError) {
    return (
      <div className="center-screen">
        <div>
          <p role="alert">{auth.loadError}</p>
          <button type="button" className="btn" onClick={() => void auth.refresh()}>
            Try again
          </button>
        </div>
      </div>
    )
  }

  const target = stageFor(auth)
  if (target !== stage) return <Navigate to={target} replace state={{ from: location.pathname }} />
  return <Outlet />
}
