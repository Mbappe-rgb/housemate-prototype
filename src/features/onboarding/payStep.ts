// The "How do housemates pay you?" step shows once after sign-up; Continue or Skip marks it done.
const KEY = 'housemate.payStepDone'

export function payStepDone(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function markPayStepDone() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // private mode: the step simply won't show again this visit
  }
}
