// Turn the error names our database functions raise into short, friendly messages.
const MESSAGES: Record<string, string> = {
  not_signed_in: 'Please log in again.',
  invalid_name: 'Give your household a name (up to 60 characters).',
  already_in_household: 'You’re already in a household. Leave it first to join another.',
  not_a_member: 'You’re not a member of that household.',
  not_admin: 'Only the household admin can do that.',
  invite_invalid: 'That invite link has expired or was reset. Ask for a new one.',
  household_full: 'That household is full (8 people max).',
  request_closed: 'That request was already handled.',
  choose_new_admin: 'Choose who becomes admin before you leave.',
  cannot_remove_self: 'To leave, use “Leave household” instead.',
}

export function friendlyHouseholdError(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? ''
  const code = Object.keys(MESSAGES).find((k) => message.includes(k))
  return code ? MESSAGES[code] : 'Something went wrong. Please try again.'
}
