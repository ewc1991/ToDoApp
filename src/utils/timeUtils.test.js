import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  LAST_MINUTE, endAfter, blockEndMinutes, layoutBlocks,
  getNearestHalfHour, minutesToTime, timeToMinutes,
} from './timeUtils.js'

afterEach(() => vi.useRealTimers())

describe('end of day handling', () => {
  // 1440 minutes formats as "00:00" and reads back as zero, which used to put a
  // block's end before its start and hide it from the day view entirely.
  it('reads a block stored with a 00:00 end as running to end of day', () => {
    expect(blockEndMinutes({ startTime: '22:00', endTime: '00:00' })).toBe(1440)
  })

  it('leaves an ordinary block alone', () => {
    expect(blockEndMinutes({ startTime: '09:00', endTime: '10:30' })).toBe(630)
  })

  it('makes a previously invisible block survive the day-view filter', () => {
    const block = { startTime: '22:00', endTime: '00:00' }
    const displayStart = 7 * 60
    expect(timeToMinutes(block.endTime) > displayStart).toBe(false)  // the old reading
    expect(blockEndMinutes(block) > displayStart).toBe(true)         // the repaired one
  })

  it('lays out a midnight-ending block in a real column', () => {
    const [laid] = layoutBlocks([{ id: 'x', startTime: '22:00', endTime: '00:00' }])
    expect(laid.numCols).toBe(1)   // was 0, which produced an invalid CSS width
    expect(laid.colIdx).toBe(0)
  })

  it('still detects overlap against a midnight-ending block', () => {
    const laid = layoutBlocks([
      { id: 'a', startTime: '22:00', endTime: '00:00' },
      { id: 'b', startTime: '23:00', endTime: '23:30' },
    ])
    expect(laid.every(b => b.numCols === 2)).toBe(true)
  })
})

describe('endAfter', () => {
  it('adds the interval', () => {
    expect(endAfter('09:00')).toBe('09:30')
    expect(endAfter('09:00', 90)).toBe('10:30')
  })

  it('never spills past the end of the day', () => {
    expect(endAfter('23:30')).toBe(minutesToTime(LAST_MINUTE))
    expect(endAfter('23:50')).toBe('23:59')
  })

  it('keeps the last slot schedulable', () => {
    // End must be strictly after start or the dialog disables Save.
    expect(timeToMinutes(endAfter('23:30'))).toBeGreaterThan(timeToMinutes('23:30'))
  })
})

describe('getNearestHalfHour', () => {
  const at = (h, m) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 5, h, m))
    return getNearestHalfHour()
  }

  it('rounds up to the next half hour', () => {
    expect(at(9, 5)).toBe('09:30')
    expect(at(9, 40)).toBe('10:00')
  })

  it('holds at the last slot instead of wrapping to midnight', () => {
    // Rounding up from 23:45 gave "00:00" — the top of the day already in progress.
    expect(at(23, 45)).toBe('23:30')
    expect(at(23, 30)).toBe('23:30')
  })
})
