import { describe, it, expect } from 'vitest'
import { minutesNowInZone, activeIncompleteBlocks, upcomingIncompleteBlocks, pushPayloadFor } from './_push.js'

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

describe('upcomingIncompleteBlocks', () => {
  const DAY = '2026-09-06'

  it('keeps blocks starting after now and within the hour, soonest first', () => {
    const blocks = [
      { id: 'a', date: DAY, startTime: '10:00', endTime: '10:30', title: 'At the hour' },
      { id: 'b', date: DAY, startTime: '09:30', endTime: '10:00', title: 'Half past' },
      { id: 'c', date: DAY, startTime: '09:00', endTime: '09:30', title: 'Starting now' },
      { id: 'd', date: DAY, startTime: '10:01', endTime: '10:30', title: 'Too far' },
      { id: 'e', date: DAY, startTime: '09:45', endTime: '10:00', title: 'Done', completed: true },
      { id: 'f', date: DAY, allDay: true, title: 'All day' },
    ]
    expect(upcomingIncompleteBlocks(blocks, DAY, 9 * 60).map(b => b.title))
      .toEqual(['Half past', 'At the hour'])
  })

  it('reaches into the next date with a negative minute', () => {
    const blocks = [
      { id: 'a', date: '2026-09-07', startTime: '00:15', endTime: '00:45', title: 'Just after midnight' },
      { id: 'b', date: '2026-09-07', startTime: '00:45', endTime: '01:00', title: 'Too far' },
    ]
    // 23:30 is 30 minutes before the next date starts.
    expect(upcomingIncompleteBlocks(blocks, '2026-09-07', 23 * 60 + 30 - 1440).map(b => b.title))
      .toEqual(['Just after midnight'])
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

  it('announces a single upcoming task with its start time', () => {
    const payload = pushPayloadFor([], [{ title: 'Gym', startTime: '17:30' }])
    expect(payload.title).toBe('Up next: Gym')
    expect(payload.body).toBe('Starts at 5:30 PM — tap to open today.')
  })

  it('lists several upcoming tasks', () => {
    const payload = pushPayloadFor([], [
      { title: 'A', startTime: '09:30' }, { title: 'B', startTime: '10:00' },
    ])
    expect(payload.title).toBe('2 tasks in the next hour')
    expect(payload.body).toBe('A (9:30 AM), B (10:00 AM)')
  })

  it('adds the next hour under what is in progress', () => {
    const payload = pushPayloadFor([{ title: 'Now' }], [{ title: 'Soon', startTime: '14:00' }])
    expect(payload.title).toBe('Now')
    expect(payload.body).toBe('Still marked unfinished.\nNext hour: Soon (2:00 PM)')
  })
})
