// Money is always integer cents. Never store or add dollars as decimals.

/** $3,200 for whole dollars, $192.80 otherwise (matches the prototype). */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const whole = abs % 100 === 0
  const text = (abs / 100).toLocaleString('en-CA', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return `${sign}$${text}`
}

/**
 * Read what someone typed into a money field ("192.8", "$1,200", "15.") as cents.
 * Returns null if it isn't a valid non-negative amount with at most 2 decimals.
 */
export function parseMoney(input: string): number | null {
  const clean = input.trim().replace(/[$,\s]/g, '')
  const match = /^(\d{0,9})(?:\.(\d{0,2}))?$/.exec(clean)
  if (!match || (match[1] === '' && (match[2] ?? '') === '')) return null
  const dollars = Number(match[1] || '0')
  const cents = Number((match[2] ?? '').padEnd(2, '0'))
  return dollars * 100 + cents
}

/** Cents back to a plain input value: 19280 -> "192.80", 3200 -> "32". */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
}

/**
 * Split a total equally between `count` people. Leftover cents go to the first people
 * (by join order), so $100.01 / 3 = [3334, 3334, 3333]. Always adds up to the total.
 */
export function splitEqual(totalCents: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(totalCents / count)
  const extra = totalCents - base * count
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}

export function sumCents(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0)
}
