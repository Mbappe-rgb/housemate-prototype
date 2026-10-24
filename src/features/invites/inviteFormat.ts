/** K7QM2XPD9TCF -> K7QM-2XPD-9TCF (easier to read aloud and type). */
export function formatCode(token: string): string {
  return token.match(/.{1,4}/g)?.join('-') ?? token
}

/** Accepts a full link, a code with dashes or spaces, any case. Returns the bare token or null. */
export function parseInviteInput(input: string): string | null {
  const trimmed = input.trim()
  const fromLink = /\/join\/([A-Za-z0-9-]+)/.exec(trimmed)?.[1] ?? trimmed
  const token = fromLink.replace(/[\s-]/g, '').toUpperCase()
  return /^[A-HJ-NP-Z2-9]{12,16}$/.test(token) ? token : null
}

export function inviteLink(token: string, origin: string = window.location.origin): string {
  return `${origin}/join/${formatCode(token)}`
}
