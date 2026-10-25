import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonthsClamped,
  dayName,
  daysBetween,
  dueHeadline,
  dueText,
  monthGrid,
  shortDate,
  todayIn,
  weekStrip,
  weekday,
} from './dates'

describe('day math', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('counts days between dates', () => {
    expect(daysBetween('2026-10-07', '2026-10-15')).toBe(8)
    expect(daysBetween('2026-10-15', '2026-10-07')).toBe(-8)
    // across the DST change in November
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })
})

describe('addMonthsClamped (recurring bills)', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsClamped('2026-10-30', 4)).toBe('2027-02-28')
  })
  it('returns to the original day with an anchor', () => {
    expect(addMonthsClamped('2026-02-28', 1, 31)).toBe('2026-03-31')
  })
  it('rolls over the year', () => {
    expect(addMonthsClamped('2026-12-15', 1)).toBe('2027-01-15')
  })
})

describe('labels', () => {
  const today = '2026-10-07'
  it('formats short dates and weekdays', () => {
    expect(shortDate('2026-10-15')).toBe('Oct 15')
    expect(weekday('2026-10-07')).toBe('Wed')
  })
  it('names nearby days', () => {
    expect(dayName('2026-10-07', today)).toBe('Today')
    expect(dayName('2026-10-08', today)).toBe('Tomorrow')
    expect(dayName('2026-10-09', today)).toBe('Fri')
  })
  it('describes due dates like the prototype', () => {
    expect(dueText('2026-10-03', today)).toBe('past due since Oct 3')
    expect(dueText('2026-10-07', today)).toBe('due today')
    expect(dueText('2026-10-08', today)).toBe('due tomorrow')
    expect(dueText('2026-10-15', today)).toBe('due Oct 15, in 8 days')
    expect(dueHeadline('2026-10-08', today)).toBe('Due Oct 8 (tomorrow)')
    expect(dueHeadline('2026-10-15', today)).toBe('Due Oct 15 (8 days)')
    expect(dueHeadline('2026-10-03', today)).toBe('Past due since Oct 3')
  })
})

describe('calendar', () => {
  it('builds the month grid with leading blanks (weeks start Sunday)', () => {
    const oct = monthGrid(2026, 10) // Oct 1 2026 is a Thursday
    expect(oct.blanks).toBe(4)
    expect(oct.days).toHaveLength(31)
    expect(oct.days[0]).toBe('2026-10-01')
    expect(monthGrid(2026, 2).days).toHaveLength(28)
    expect(monthGrid(2028, 2).days).toHaveLength(29)
  })
  it('builds the 7-day strip from today', () => {
    expect(weekStrip('2026-10-29')).toEqual([
      '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04',
    ])
  })
})

describe('todayIn', () => {
  it('uses the household time zone', () => {
    const lateEvening = new Date('2026-10-08T03:30:00Z') // 11:30 pm Oct 7 in Toronto
    expect(todayIn('America/Toronto', lateEvening)).toBe('2026-10-07')
    expect(todayIn('Europe/London', lateEvening)).toBe('2026-10-08')
  })
})
