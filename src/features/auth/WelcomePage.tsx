import { Link } from 'react-router'
import { AuthLayout, Hero } from './AuthLayout'

export function WelcomePage() {
  return (
    <AuthLayout>
      <Hero title="HouseMate" text="Split bills, share chores and keep the peace at home." />
      <Link to="/signup" className="btn">
        Create account
      </Link>
      <Link to="/login" className="btn sec" style={{ marginTop: 10 }}>
        Log in
      </Link>
    </AuthLayout>
  )
}
