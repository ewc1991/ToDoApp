import { describe, it, expect } from 'vitest'
import { reorderPlan, duplicateRecurringIds, byPriority, isHighPriority, groupUnscheduled, sortableOrder } from './taskUtils.js'

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

describe('byPriority', () => {
  const hi = (id) => ({ id, priority: 'high' })
  const lo = (id) => ({ id })

  it('lifts flagged tasks above the rest', () => {
    expect(byPriority([lo('a'), hi('b'), lo('c'), hi('d')]).map(t => t.id))
      .toEqual(['b', 'd', 'a', 'c'])
  })

  it('preserves the incoming order within each group', () => {
    // The caller has already sorted by sortIndex / createdAt; only the split
    // between flagged and unflagged is ours to impose.
    expect(byPriority([lo('a'), lo('b'), hi('c'), lo('d'), hi('e')]).map(t => t.id))
      .toEqual(['c', 'e', 'a', 'b', 'd'])
  })

  it('does not mutate its input', () => {
    const input = [lo('a'), hi('b')]
    byPriority(input)
    expect(input.map(t => t.id)).toEqual(['a', 'b'])
  })

  it('treats a missing or unknown priority as normal', () => {
    expect(isHighPriority({ id: 'a' })).toBe(false)
    expect(isHighPriority({ id: 'a', priority: null })).toBe(false)
    expect(isHighPriority({ id: 'a', priority: 'low' })).toBe(false)
    expect(isHighPriority({ id: 'a', priority: 'high' })).toBe(true)
    expect(isHighPriority(undefined)).toBe(false)
  })
})

describe('groupUnscheduled', () => {
  const t = (id, over = {}) => ({ id, ...over })
  const rec = (id, over = {}) => ({ id, recurringTemplateId: 'r1', ...over })

  it('separates what is genuinely due from what a recurrence put there', () => {
    const groups = groupUnscheduled([t('a'), rec('b'), t('c'), rec('d')])
    expect(groups.due.incomplete.map(x => x.id)).toEqual(['a', 'c'])
    expect(groups.recurring.incomplete.map(x => x.id)).toEqual(['b', 'd'])
  })

  it('sinks completed items within their own group, not into one pile', () => {
    const groups = groupUnscheduled([
      t('a', { completed: true }), t('b'), rec('c', { completed: true }), rec('d'),
    ])
    expect(groups.due.incomplete.map(x => x.id)).toEqual(['b'])
    expect(groups.due.completed.map(x => x.id)).toEqual(['a'])
    expect(groups.recurring.incomplete.map(x => x.id)).toEqual(['d'])
    expect(groups.recurring.completed.map(x => x.id)).toEqual(['c'])
  })

  it('floats flagged tasks to the top of each group independently', () => {
    const groups = groupUnscheduled([
      t('a'), t('b', { priority: 'high' }), rec('c'), rec('d', { priority: 'high' }),
    ])
    expect(groups.due.incomplete.map(x => x.id)).toEqual(['b', 'a'])
    expect(groups.recurring.incomplete.map(x => x.id)).toEqual(['d', 'c'])
  })

  it('copes with an empty group on either side', () => {
    expect(groupUnscheduled([rec('a')]).due.incomplete).toEqual([])
    expect(groupUnscheduled([t('a')]).recurring.incomplete).toEqual([])
    expect(sortableOrder(groupUnscheduled([]))).toEqual([])
  })
})

describe('sortableOrder', () => {
  it('is the rendered order: due before recurring, flagged first in each', () => {
    // This is the list dnd-kit indexes against. If it ever diverges from what
    // UnscheduledSection renders, a drag resolves against the wrong row.
    const tasks = [
      { id: 'a' },
      { id: 'b', priority: 'high' },
      { id: 'c', recurringTemplateId: 'r1' },
      { id: 'd', recurringTemplateId: 'r1', priority: 'high' },
      { id: 'e', completed: true },
    ]
    expect(sortableOrder(groupUnscheduled(tasks)).map(x => x.id)).toEqual(['b', 'a', 'd', 'c'])
  })

  it('leaves completed tasks out entirely — they are not draggable', () => {
    const tasks = [{ id: 'a', completed: true }, { id: 'b' }]
    expect(sortableOrder(groupUnscheduled(tasks)).map(x => x.id)).toEqual(['b'])
  })
})
