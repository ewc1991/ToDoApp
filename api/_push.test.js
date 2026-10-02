import { describe, it, expect } from 'vitest'
import { minutesNowInZone, activeIncompleteBlocks, pushPayloadFor } from './_push.js'

describe('minutesNowInZone', () => {
  it('reads minutes since midnight in the given zone, not UTC', () => {
    // 14:30 UTC is 10:30 AM EDT in September.
    expect(minutesNowInZone(new Date('2026-09-06T14:30:00Z'))).toBe(10 * 60 + 30)
  })

  it('does not misread midnight as 24:00', () => {
    // 04:00 UTC is midnight EDT.
    expect(minutesNowInZone(new Date('2026-09-06T04:00:00Z'))).toBe(0)
  })
})

describe('activeIncompleteBlocks', () => {
  const DAY = '2026-09-06'

  it('keeps only blocks on the date whose window contains the minute', () => {
    const blocks = [
      { id: 'a', date: DAY, startTime: '09:00', endTime: '09:30', title: 'In progress' },
      { id: 'b', date: DAY, startTime: '10:00', endTime: '10:30', title: 'Not yet' },
      { id: 'c', date: DAY, startTime: '08:00', endTime: '09:00', title: 'Already over' },
      { id: 'd', date: '2026-09-07', startTime: '09:00', endTime: '09:30', title: 'Tomorrow' },
    ]
    expect(activeIncompleteBlocks(blocks, DAY, 9 * 60 + 15).map(b => b.title)).toEqual(['In progress'])
  })

  it('skips completed blocks and all-day items', () => {
    const blocks = [
      { id: 'a', date: DAY, startTime: '09:00', endTime: '09:30', title: 'Done', completed: true },
      { id: 'b', date: DAY, allDay: true, title: 'All day' },
    ]
    expect(activeIncompleteBlocks(blocks, DAY, 9 * 60 + 15)).toEqual([])
  })

  it('treats an end at or before the start as running to end of day', () => {
    const blocks = [{ id: 'a', date: DAY, startTime: '20:00', endTime: '00:00', title: 'Overnight' }]
    expect(activeIncompleteBlocks(blocks, DAY, 23 * 60).map(b => b.title)).toEqual(['Overnight'])
  })
})

describe('pushPayloadFor', () => {
  it('names the one task directly', () => {
    expect(pushPayloadFor([{ title: 'Write report' }]).title).toBe('Write report')
  })

  it('summarises more than one', () => {
    const payload = pushPayloadFor([{ title: 'A' }, { title: 'B' }])
    expect(payload.title).toBe('2 unfinished tasks in progress')
    expect(payload.body).toBe('A, B')
  })
})
