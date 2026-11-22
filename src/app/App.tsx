import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth'
import { Gate } from './Gate'
import { useTheme } from './theme'
import { ToastProvider } from '../components/Toast'
import { OfflineBanner } from '../components/OfflineBanner'
import { WelcomePage } from '../features/auth/WelcomePage'
import { SignUpPage } from '../features/auth/SignUpPage'
import { LogInPage } from '../features/auth/LogInPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { PrivacyPage } from '../features/auth/PrivacyPage'
import { PayDetailsPage } from '../features/onboarding/PayDetailsPage'
import { NamePage } from '../features/onboarding/NamePage'
import { HouseholdChoicePage } from '../features/onboarding/HouseholdChoicePage'
import { CreateHouseholdPage } from '../features/onboarding/CreateHouseholdPage'
import { JoinCodePage } from '../features/onboarding/JoinCodePage'
import { JoinPage } from '../features/invites/JoinPage'
import { LiveHouseProvider } from '../features/house/LiveHouseProvider'
import { useHouse } from '../features/house/house'
import { AppShell } from '../features/app/AppShell'
import { HomeScreen } from '../features/app/screens/HomeScreen'
import { ScheduleScreen } from '../features/app/screens/ScheduleScreen'
import { ProfileScreen } from '../features/app/screens/ProfileScreen'
import { HouseholdScreen } from '../features/app/screens/HouseholdScreen'
import { DemoApp } from '../features/demo/DemoApp'

/** The main app screens, shared by the real app (/) and the demo (/demo). */
function appScreens() {
  return (
    <>
      <Route index element={<HomeScreen />} />
      <Route path="schedule" element={<ScheduleScreen />} />
      <Route path="household" element={<HouseholdScreen />} />
      <Route path="profile" element={<ProfileScreen />} />
      {/* addresses from before the v5 redesign */}
      <Route path="bills" element={<Navigate to="../schedule?range=month&type=bills" replace />} />
      <Route path="calendar" element={<Navigate to="../schedule?range=month" replace />} />
      <Route path="chores" element={<Navigate to="../schedule?range=week&type=chores" replace />} />
      <Route path="profile/household" element={<Navigate to="../household" replace />} />
    </>
  )
}

function LiveApp() {
  return (
    <LiveHouseProvider>
      <LiveTheme />
      <AppShell />
    </LiveHouseProvider>
  )
}

/** The theme saved in my profile (or the one I just picked) */
function LiveTheme() {
  useTheme(useHouse().settings.theme)
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <OfflineBanner />
        <BrowserRouter>
          <Routes>
            {/* Logged out */}
            <Route element={<Gate stage="/welcome" />}>
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
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
              <Route path="/setup/pay" element={<PayDetailsPage />} />
              <Route path="/setup/create" element={<CreateHouseholdPage />} />
              <Route path="/setup/join" element={<JoinCodePage />} />
            </Route>

            {/* Invite links and QR codes; works logged in or out */}
            <Route path="/join/:token" element={<JoinPage />} />

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
