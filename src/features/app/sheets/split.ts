import type { Member } from '../../../lib/bills'
import { parseMoney, sumCents } from '../../../lib/money'

export type SplitState = {
  mode: 'equal' | 'custom'
  /** what's typed in each person's box */
  inputs: Record<string, string>
}

/** Cents per member from the typed inputs (invalid boxes count as null). */
export function splitAmounts(state: SplitState, members: Member[]): Record<string, number | null> {
  return Object.fromEntries(members.map((m) => [m.id, parseMoney(state.inputs[m.id] ?? '')]))
}

/** Is the custom split complete and equal to the total? */
export function splitIsValid(state: SplitState, members: Member[], totalCents: number | null): boolean {
  if (state.mode === 'equal') return true
  if (!totalCents) return false
  const amounts = Object.values(splitAmounts(state, members))
  return amounts.every((a) => a !== null) && sumCents(amounts as number[]) === totalCents
}
