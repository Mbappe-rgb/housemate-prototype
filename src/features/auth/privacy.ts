// Remembers, for this visit, that the person accepted the privacy page before signing up.
const KEY = 'housemate.privacyAccepted'

export function setPrivacyAccepted() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    // private mode: the sign-up page also gets it through navigation state
  }
}

export function privacyAccepted(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
