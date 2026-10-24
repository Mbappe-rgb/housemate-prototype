// Dates are calendar days as ISO strings ("2026-10-24"), compared in the household's time zone.
// Working with plain strings avoids time-zone surprises around midnight.

export type ISODate = string

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function parts(d: ISODate): [number, number, number] {
  const [y, m, day] = d.split('-').map(Number)
  return [y, m, day]
}

function toUTC(d: ISODate): number {
  const [y, m, day] = parts(d)
  return Date.UTC(y, m - 1, day)
}

function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Today's date in a time zone, e.g. todayIn('America/Toronto'). */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(d: ISODate, days: number): ISODate {
  return fromUTC(toUTC(d) + days * 86_400_000)
}

/** Whole days from a to b (positive if b is later). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000)
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

/**
 * Same day n months later, clamped to the month's last day.
 * Recurring bills: Jan 31 -> Feb 28 (or 29) -> Mar 31 when computed from the series' original day.
 */
export function addMonthsClamped(d: ISODate, months: number, anchorDay?: number): ISODate {
  const [y, m, day] = parts(d)
  const index = y * 12 + (m - 1) + months
  const ny = Math.floor(index / 12)
  const nm = (index % 12) + 1
  const target = Math.min(anchorDay ?? day, daysInMonth(ny, nm))
  return `${ny}-${String(nm).padStart(2, '0')}-${String(target).padStart(2, '0')}`
}

export function weekday(d: ISODate): string {
  return WEEKDAYS[new Date(toUTC(d)).getUTCDay()]
}

/** "Oct 15" */
export function shortDate(d: ISODate): string {
  const [, m, day] = parts(d)
  return `${MONTHS[m - 1]} ${day}`
}

export function dayOfMonth(d: ISODate): number {
  return parts(d)[2]
}

export function monthName(month1to12: number): string {
  return MONTHS_LONG[month1to12 - 1]
}

/** "Today", "Tomorrow", or the weekday. */
export function dayName(d: ISODate, today: ISODate): string {
  const diff = daysBetween(today, d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return weekday(d)
}

/** Lower-case status for list rows: "due today", "due Oct 15, in 8 days", "past due since Oct 3". */
export function dueText(due: ISODate, today: ISODate): string {
  const diff = daysBetween(today, due)
  if (diff < 0) return `past due since ${shortDate(due)}`
  if (diff === 0) return 'due today'
  if (diff === 1) return 'due tomorrow'
  return `due ${shortDate(due)}, in ${diff} days`
}

/** Headline status: "Due today", "Due Oct 8 (tomorrow)", "Due Oct 15 (8 days)", "Past due since Oct 3". */
export function dueHeadline(due: ISODate, today: ISODate): string {
  const diff = daysBetween(today, due)
  if (diff < 0) return `Past due since ${shortDate(due)}`
  if (diff === 0) return 'Due today'
  if (diff === 1) return `Due ${shortDate(due)} (tomorrow)`
  return `Due ${shortDate(due)} (${diff} days)`
}

/** The 7 days starting today, for the home week strip. */
export function weekStrip(today: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(today, i))
}

/**
 * Calendar grid for a month: `blanks` empty cells before the 1st (weeks start on Sunday),
 * then every day of the month.
 */
export function monthGrid(year: number, month1to12: number): { blanks: number; days: ISODate[] } {
  const first = `${year}-${String(month1to12).padStart(2, '0')}-01`
  const blanks = new Date(toUTC(first)).getUTCDay()
  const days = Array.from({ length: daysInMonth(year, month1to12) }, (_, i) => addDays(first, i))
  return { blanks, days }
}

export function yearMonth(d: ISODate): { year: number; month: number } {
  const [y, m] = parts(d)
  return { year: y, month: m }
}

export function greeting(now: Date = new Date()): string {
  const h = now.getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
