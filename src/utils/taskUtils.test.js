import { describe, it, expect } from 'vitest'
import { reorderPlan, duplicateRecurringIds } from './taskUtils.js'

const tasks = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

describe('reorderPlan', () => {
  it('assigns the dragged set the positions it already occupied', () => {
    expect(reorderPlan(tasks, ['c', 'a', 'b'])).toEqual([
      { id: 'c', sortIndex: 0 },
      { id: 'a', sortIndex: 1 },
      { id: 'b', sortIndex: 2 },
    ])
  })

  it('leaves positions outside the dragged set alone', () => {
    // 'b' and 'd' sit at 1 and 3, so only those two indexes are rewritten.
    expect(reorderPlan(tasks, ['d', 'b'])).toEqual([
      { id: 'd', sortIndex: 1 },
      { id: 'b', sortIndex: 3 },
    ])
  })

  it('drops ids that no longer exist rather than pairing them with undefined', () => {
    const plan = reorderPlan(tasks, ['a', 'ghost', 'b'])
    expect(plan).toEqual([
      { id: 'a', sortIndex: 0 },
      { id: 'b', sortIndex: 1 },
    ])
    expect(plan.every(p => Number.isInteger(p.sortIndex))).toBe(true)
  })

  it('never emits an undefined sortIndex even when everything is missing', () => {
    expect(reorderPlan(tasks, ['x', 'y'])).toEqual([])
    expect(reorderPlan([], ['a'])).toEqual([])
    expect(reorderPlan(tasks)).toEqual([])
  })
})

describe('duplicateRecurringIds', () => {
  const t = (id, over = {}) => ({
    id, recurringTemplateId: 'tmpl', assignedDate: '2026-09-05',
    completed: false, createdAt: '2026-09-05T08:00:00.000Z', ...over,
  })

  it('returns nothing when there are no duplicates', () => {
    expect(duplicateRecurringIds([t('a'), t('b', { recurringTemplateId: 'other' })])).toEqual([])
  })

  it('keeps one and returns the rest', () => {
    const dupes = duplicateRecurringIds([
      t('a', { createdAt: '2026-09-05T08:00:00.000Z' }),
      t('b', { createdAt: '2026-09-05T08:00:01.000Z' }),
      t('c', { createdAt: '2026-09-05T08:00:02.000Z' }),
    ])
    expect(dupes).toEqual(['b', 'c'])  // oldest survives
  })

  it('keeps a completed instance over an untouched one', () => {
    const dupes = duplicateRecurringIds([
      t('a', { createdAt: '2026-09-05T08:00:00.000Z' }),
      t('b', { createdAt: '2026-09-05T08:00:01.000Z', completed: true }),
    ])
    expect(dupes).toEqual(['a'])
  })

  it('keeps the instance a time block points at', () => {
    // Deleting this one would leave the block pointing at nothing.
    const dupes = duplicateRecurringIds(
      [t('a', { completed: true }), t('b')],
      new Set(['b'])
    )
    expect(dupes).toEqual(['a'])
  })

  it('treats different dates as separate occurrences', () => {
    expect(duplicateRecurringIds([t('a'), t('b', { assignedDate: '2026-09-06' })])).toEqual([])
  })

  it('ignores tasks that are not recurring instances', () => {
    expect(duplicateRecurringIds([
      { id: 'a', assignedDate: '2026-09-05' },
      { id: 'b', assignedDate: '2026-09-05' },
    ])).toEqual([])
  })
})
