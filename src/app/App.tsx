import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from './auth'
import { Gate } from './Gate'
import { useTheme } from './theme'
import { ToastProvider } from '../components/Toast'
import { WelcomePage } from '../features/auth/WelcomePage'
import { SignUpPage } from '../features/auth/SignUpPage'
import { LogInPage } from '../features/auth/LogInPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { NamePage } from '../features/onboarding/NamePage'
import { HouseholdChoicePage } from '../features/onboarding/HouseholdChoicePage'
import { LiveHouseProvider } from '../features/house/LiveHouseProvider'
import { AppShell } from '../features/app/AppShell'
import { HomeScreen } from '../features/app/screens/HomeScreen'
import { BillsScreen } from '../features/app/screens/BillsScreen'
import { CalendarScreen } from '../features/app/screens/CalendarScreen'
import { ChoresScreen } from '../features/app/screens/ChoresScreen'
import { ProfileScreen } from '../features/app/screens/ProfileScreen'
import { HouseholdScreen } from '../features/app/screens/HouseholdScreen'
import { DemoApp } from '../features/demo/DemoApp'

/** The main app screens, shared by the real app (/) and the demo (/demo). */
function appScreens() {
  return (
    <>
      <Route index element={<HomeScreen />} />
      <Route path="bills" element={<BillsScreen />} />
      <Route path="calendar" element={<CalendarScreen />} />
      <Route path="chores" element={<ChoresScreen />} />
      <Route path="profile" element={<ProfileScreen />} />
      <Route path="profile/household" element={<HouseholdScreen />} />
    </>
  )
}

function LiveApp() {
  const { profile } = useAuth()
  useTheme(profile?.theme)
  return (
    <LiveHouseProvider>
      <AppShell />
    </LiveHouseProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* Logged out */}
            <Route element={<Gate stage="/welcome" />}>
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/login" element={<LogInPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Opened from the reset email; works whatever stage they're at */}
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Signed in, setting up */}
            <Route element={<Gate stage="/setup/name" />}>
              <Route path="/setup/name" element={<NamePage />} />
            </Route>
            <Route element={<Gate stage="/setup/household" />}>
              <Route path="/setup/household" element={<HouseholdChoicePage />} />
            </Route>

            {/* The app */}
            <Route element={<Gate stage="/" />}>
              <Route path="/" element={<LiveApp />}>
                {appScreens()}
              </Route>
            </Route>

            {/* Design review with sample data (no account needed) */}
            <Route path="/demo" element={<DemoApp />}>
              {appScreens()}
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
