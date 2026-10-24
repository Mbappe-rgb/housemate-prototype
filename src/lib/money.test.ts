import { describe, expect, it } from 'vitest'
import { centsToInput, formatMoney, parseMoney, splitEqual, sumCents } from './money'

describe('formatMoney', () => {
  it('drops cents for whole dollars, like the prototype', () => {
    expect(formatMoney(320000)).toBe('$3,200')
    expect(formatMoney(0)).toBe('$0')
  })
  it('shows two decimals otherwise', () => {
    expect(formatMoney(19280)).toBe('$192.80')
    expect(formatMoney(5)).toBe('$0.05')
    expect(formatMoney(-150)).toBe('-$1.50')
  })
})

describe('parseMoney', () => {
  it('reads typical inputs as cents', () => {
    expect(parseMoney('192.8')).toBe(19280)
    expect(parseMoney('192.80')).toBe(19280)
    expect(parseMoney('$1,200')).toBe(120000)
    expect(parseMoney('15.')).toBe(1500)
    expect(parseMoney('.5')).toBe(50)
    expect(parseMoney(' 0 ')).toBe(0)
  })
  it('avoids floating point errors', () => {
    expect(parseMoney('0.29')).toBe(29)
    expect(parseMoney('1.13')).toBe(113)
  })
  it('rejects bad input', () => {
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('.')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('-5')).toBeNull()
    expect(parseMoney('1.234')).toBeNull()
  })
})

describe('centsToInput', () => {
  it('round-trips with parseMoney', () => {
    expect(centsToInput(19280)).toBe('192.80')
    expect(centsToInput(3200)).toBe('32')
    expect(parseMoney(centsToInput(4801))).toBe(4801)
  })
})

describe('splitEqual', () => {
  it('splits evenly when it can', () => {
    expect(splitEqual(8000, 2)).toEqual([4000, 4000])
  })
  it('gives leftover cents to the first people', () => {
    expect(splitEqual(10001, 3)).toEqual([3334, 3334, 3333])
    expect(splitEqual(19280, 4)).toEqual([4820, 4820, 4820, 4820])
    expect(splitEqual(10003, 4)).toEqual([2501, 2501, 2501, 2500])
  })
  it('always adds up to the total', () => {
    for (const total of [1, 99, 100, 10001, 123457]) {
      for (const n of [1, 2, 3, 7, 8]) {
        expect(sumCents(splitEqual(total, n))).toBe(total)
      }
    }
  })
  it('handles nobody', () => {
    expect(splitEqual(100, 0)).toEqual([])
  })
})
