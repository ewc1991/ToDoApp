import { describe, it, expect } from 'vitest'
import { reorderPlan } from './taskUtils.js'

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
