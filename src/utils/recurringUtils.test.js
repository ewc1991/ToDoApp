import { describe, it, expect } from 'vitest'
import { shouldRecurOnDate, templatesNeedingInstance } from './recurringUtils.js'

// Reference calendar — March 2026 starts on a Sunday:
//   Sun  1  8 15 22 29
//   Mon  2  9 16 23 30
//   Tue  3 10 17 24 31
//   Wed  4 11 18 25
//   Sat  7 14 21 28
const MON = ['2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23', '2026-03-30']

const t = (over) => ({ recurrenceType: 'daily', ...over })

describe('date bounds', () => {
  it('excludes dates before startDate', () => {
    const tmpl = t({ startDate: '2026-03-10' })
    expect(shouldRecurOnDate(tmpl, '2026-03-09')).toBe(false)
    expect(shouldRecurOnDate(tmpl, '2026-03-10')).toBe(true)
  })

  it('excludes dates after endDate', () => {
    const tmpl = t({ endDate: '2026-03-20' })
    expect(shouldRecurOnDate(tmpl, '2026-03-20')).toBe(true)
    expect(shouldRecurOnDate(tmpl, '2026-03-21')).toBe(false)
  })

  it('returns false for an unknown recurrence type', () => {
    expect(shouldRecurOnDate(t({ recurrenceType: 'yearly' }), '2026-03-02')).toBe(false)
  })
})

describe('simple recurrences', () => {
  it('daily matches every day', () => {
    expect(shouldRecurOnDate(t(), '2026-03-01')).toBe(true)
    expect(shouldRecurOnDate(t(), '2026-03-07')).toBe(true)
  })

  it('weekdays matches Mon–Fri only', () => {
    const tmpl = t({ recurrenceType: 'weekdays' })
    expect(shouldRecurOnDate(tmpl, '2026-03-02')).toBe(true)  // Mon
    expect(shouldRecurOnDate(tmpl, '2026-03-06')).toBe(true)  // Fri
    expect(shouldRecurOnDate(tmpl, '2026-03-07')).toBe(false) // Sat
    expect(shouldRecurOnDate(tmpl, '2026-03-01')).toBe(false) // Sun
  })

  it('weekends matches Sat and Sun only', () => {
    const tmpl = t({ recurrenceType: 'weekends' })
    expect(shouldRecurOnDate(tmpl, '2026-03-07')).toBe(true)  // Sat
    expect(shouldRecurOnDate(tmpl, '2026-03-01')).toBe(true)  // Sun
    expect(shouldRecurOnDate(tmpl, '2026-03-02')).toBe(false) // Mon
  })

  it('weekly matches its day of week', () => {
    const tmpl = t({ recurrenceType: 'weekly', dayOfWeek: 1 })
    MON.forEach(d => expect(shouldRecurOnDate(tmpl, d)).toBe(true))
    expect(shouldRecurOnDate(tmpl, '2026-03-03')).toBe(false)
  })
})

describe('biweekly', () => {
  it('alternates weeks from startDate', () => {
    const tmpl = t({ recurrenceType: 'biweekly', dayOfWeek: 1, startDate: '2026-03-02' })
    expect(MON.map(d => shouldRecurOnDate(tmpl, d))).toEqual([true, false, true, false, true])
  })

  it('does not collapse to weekly when startDate is absent (falls back to createdAt)', () => {
    const tmpl = t({
      recurrenceType: 'biweekly',
      dayOfWeek: 1,
      createdAt: '2026-03-02T09:30:00.000Z',
    })
    expect(MON.map(d => shouldRecurOnDate(tmpl, d))).toEqual([true, false, true, false, true])
  })

  it('normalizes a startDate that is not on the chosen weekday', () => {
    // startDate is a Wednesday but the task recurs on Mondays — the anchor should
    // shift forward to the first Monday on/after it (Mar 9), not stay on Mar 4.
    const tmpl = t({ recurrenceType: 'biweekly', dayOfWeek: 1, startDate: '2026-03-04' })
    expect(MON.map(d => shouldRecurOnDate(tmpl, d))).toEqual([false, true, false, true, false])
  })

  it('never matches before the anchor', () => {
    const tmpl = t({ recurrenceType: 'biweekly', dayOfWeek: 1, startDate: '2026-03-16' })
    expect(shouldRecurOnDate(tmpl, '2026-03-02')).toBe(false)
  })
})

describe('monthly', () => {
  it('matches a fixed day of month', () => {
    const tmpl = t({ recurrenceType: 'monthly', monthlyMode: 'dayOfMonth', dayOfMonth: 15 })
    expect(shouldRecurOnDate(tmpl, '2026-03-15')).toBe(true)
    expect(shouldRecurOnDate(tmpl, '2026-03-14')).toBe(false)
    expect(shouldRecurOnDate(tmpl, '2026-04-15')).toBe(true)
  })

  it('matches the Nth weekday of the month', () => {
    const tmpl = t({
      recurrenceType: 'monthly',
      monthlyMode: 'dayOfWeek',
      dayOfWeek: 1,
      monthlyWeekOccurrence: 2,
    })
    expect(shouldRecurOnDate(tmpl, '2026-03-09')).toBe(true)  // 2nd Monday
    expect(shouldRecurOnDate(tmpl, '2026-03-02')).toBe(false) // 1st Monday
    expect(shouldRecurOnDate(tmpl, '2026-03-16')).toBe(false) // 3rd Monday
  })

  it('matches the last weekday of the month', () => {
    const tmpl = t({
      recurrenceType: 'monthly',
      monthlyMode: 'dayOfWeek',
      dayOfWeek: 1,
      monthlyWeekOccurrence: -1,
    })
    expect(shouldRecurOnDate(tmpl, '2026-03-30')).toBe(true)  // last Monday
    expect(shouldRecurOnDate(tmpl, '2026-03-23')).toBe(false)
  })
})

describe('custom intervals', () => {
  it('repeats every N weeks from startDate', () => {
    const tmpl = t({
      recurrenceType: 'custom',
      customUnit: 'weeks',
      customInterval: 3,
      dayOfWeek: 1,
      startDate: '2026-03-02',
    })
    expect(MON.map(d => shouldRecurOnDate(tmpl, d))).toEqual([true, false, false, true, false])
  })

  it('repeats every N months from startDate', () => {
    const tmpl = t({
      recurrenceType: 'custom',
      customUnit: 'months',
      customInterval: 2,
      monthlyMode: 'dayOfMonth',
      dayOfMonth: 10,
      startDate: '2026-03-10',
    })
    expect(shouldRecurOnDate(tmpl, '2026-03-10')).toBe(true)
    expect(shouldRecurOnDate(tmpl, '2026-04-10')).toBe(false)
    expect(shouldRecurOnDate(tmpl, '2026-05-10')).toBe(true)
    expect(shouldRecurOnDate(tmpl, '2026-05-11')).toBe(false)
  })

  it('does not match months before startDate', () => {
    const tmpl = t({
      recurrenceType: 'custom',
      customUnit: 'months',
      customInterval: 2,
      monthlyMode: 'dayOfMonth',
      dayOfMonth: 10,
      startDate: '2026-03-10',
    })
    expect(shouldRecurOnDate(tmpl, '2026-01-10')).toBe(false)
  })
})

describe('custom intervals with no start date', () => {
  // startDate is optional in the popup. Without one the interval used to be
  // ignored entirely, so "every 2 weeks" fired every week.
  it('anchors a weekly interval to createdAt', () => {
    const tmpl = t({
      recurrenceType: 'custom',
      customUnit: 'weeks',
      customInterval: 2,
      dayOfWeek: 1,
      startDate: null,
      createdAt: '2026-03-02T09:00:00.000Z',
    })
    expect(MON.map(d => shouldRecurOnDate(tmpl, d))).toEqual([true, false, true, false, true])
  })

  it('anchors a monthly interval to createdAt', () => {
    const tmpl = t({
      recurrenceType: 'custom',
      customUnit: 'months',
      customInterval: 3,
      monthlyMode: 'dayOfMonth',
      dayOfMonth: 10,
      startDate: null,
      createdAt: '2026-03-10T09:00:00.000Z',
    })
    expect(shouldRecurOnDate(tmpl, '2026-03-10')).toBe(true)
    expect(shouldRecurOnDate(tmpl, '2026-04-10')).toBe(false)
    expect(shouldRecurOnDate(tmpl, '2026-06-10')).toBe(true)
  })

  it('still fires every occurrence when the interval is 1', () => {
    const tmpl = t({
      recurrenceType: 'custom',
      customUnit: 'weeks',
      customInterval: 1,
      dayOfWeek: 1,
      startDate: null,
      createdAt: '2026-03-02T09:00:00.000Z',
    })
    expect(MON.map(d => shouldRecurOnDate(tmpl, d))).toEqual([true, true, true, true, true])
  })
})

describe('templatesNeedingInstance', () => {
  const daily = { id: 'a', recurrenceType: 'daily' }
  const mondays = { id: 'b', recurrenceType: 'weekly', dayOfWeek: 1 }

  it('returns the templates due on that date', () => {
    const got = templatesNeedingInstance([daily, mondays], [], '2026-03-02')
    expect(got.map(x => x.id)).toEqual(['a', 'b'])
  })

  it('skips templates that already have an instance on that date', () => {
    const tasks = [{ id: 't1', assignedDate: '2026-03-02', recurringTemplateId: 'a' }]
    const got = templatesNeedingInstance([daily, mondays], tasks, '2026-03-02')
    expect(got.map(x => x.id)).toEqual(['b'])
  })

  it('ignores instances belonging to another date', () => {
    const tasks = [{ id: 't1', assignedDate: '2026-03-09', recurringTemplateId: 'a' }]
    const got = templatesNeedingInstance([daily], tasks, '2026-03-02')
    expect(got.map(x => x.id)).toEqual(['a'])
  })
})
