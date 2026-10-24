import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth'
import { Gate } from './Gate'
import { WelcomePage } from '../features/auth/WelcomePage'
import { SignUpPage } from '../features/auth/SignUpPage'
import { LogInPage } from '../features/auth/LogInPage'
import { ForgotPasswordPage } from '../features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage'
import { NamePage } from '../features/onboarding/NamePage'
import { HouseholdChoicePage } from '../features/onboarding/HouseholdChoicePage'
import { HomePage } from '../features/home/HomePage'

export default function App() {
  return (
    <AuthProvider>
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
            <Route index element={<HomePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
