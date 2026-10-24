// Remembers an invite link while someone signs up or logs in, so they come back to it after.
const KEY = 'housemate.pendingInvite'

export function savePendingInvite(token: string) {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // private mode: the token also travels in the confirmation redirect URL
  }
}

export function readPendingInvite(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}

/** Where the confirmation email should send people: back to their invite if they have one. */
export function pendingInviteRedirect(): string {
  const token = readPendingInvite()
  return `${window.location.origin}${token ? `/join/${token}` : '/'}`
}
