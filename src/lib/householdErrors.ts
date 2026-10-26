// Turn the error names our database functions raise into short, friendly messages.
const MESSAGES: Record<string, string> = {
  not_signed_in: 'Please log in again.',
  invalid_name: 'Give it a name (up to 60 characters).',
  already_in_household: 'You’re already in a household. Leave it first to join another.',
  not_a_member: 'You’re not a member of that household.',
  not_admin: 'Only the household admin can do that.',
  invite_invalid: 'That invite link has expired or was reset. Ask for a new one.',
  household_full: 'That household is full (8 people max).',
  request_closed: 'That request was already handled.',
  choose_new_admin: 'Choose who becomes admin before you leave.',
  cannot_remove_self: 'To leave, use “Leave household” instead.',
  // bills and chores
  not_found: 'That no longer exists. Pull the latest by reopening the app.',
  not_allowed: 'Only the person who created it, or the admin, can do that.',
  not_creator: 'Only the person who added this bill can change the split.',
  split_locked: 'The split is locked because a housemate already paid.',
  split_mismatch: 'The amounts must add up to the bill total.',
  payer_not_member: 'The payer must be someone in the household.',
  bill_has_payments: 'This bill has payments, so it can’t be deleted. Undo them first.',
  not_on_bill: 'That person isn’t on this bill.',
  invalid_amount: 'Enter an amount more than $0.',
  invalid_date: 'Pick a date within a year from today.',
  invalid_option: 'Something about that choice isn’t valid. Please try again.',
  assignee_not_member: 'Pick someone in the household.',
}

export function friendlyHouseholdError(error: { message?: string } | null | undefined): string {
  const message = error?.message ?? ''
  const code = Object.keys(MESSAGES).find((k) => message.includes(k))
  return code ? MESSAGES[code] : 'Something went wrong. Please try again.'
}
