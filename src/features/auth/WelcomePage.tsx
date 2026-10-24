import { Link } from 'react-router'
import { AuthLayout } from './AuthLayout'

export function WelcomePage() {
  return (
    <AuthLayout title="Share the house, not the stress" subtitle="Split bills and chores with your housemates.">
      <div className="stack">
        <Link to="/signup" className="btn">
          Create an account
        </Link>
        <Link to="/login" className="btn sec">
          I already have an account
        </Link>
      </div>
    </AuthLayout>
  )
}
