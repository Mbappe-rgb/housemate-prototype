// Turn Supabase auth errors into short, friendly messages.
type MaybeAuthError = { message?: string; status?: number; code?: string } | null | undefined

export function friendlyAuthError(error: MaybeAuthError): string {
  const message = (error?.message ?? '').toLowerCase()
  const code = error?.code ?? ''

  if (message.includes('invite-only') || code.startsWith('hook')) {
    return 'This demo is invite-only. Ask the HouseMate team to add your email.'
  }
  if (code === 'user_already_exists' || message.includes('already registered')) {
    return 'An account with this email already exists. Try logging in.'
  }
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Email or password is incorrect.'
  }
  if (code === 'weak_password' || message.includes('password should be')) {
    return 'Please choose a longer password (at least 8 characters).'
  }
  if (code === 'same_password') {
    return 'Your new password must be different from the old one.'
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error?.status === 429) {
    return 'Too many attempts. Please wait a minute and try again.'
  }
  if (code === 'email_address_invalid' || message.includes('invalid format')) {
    return 'Please enter a valid email address.'
  }
  return 'Something went wrong. Please try again.'
}
