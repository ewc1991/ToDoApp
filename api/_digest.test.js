import { describe, it, expect } from 'vitest'
import {
  buildDigest, dateInZone, blockTimeLabel, subjectFor, renderHtml, renderText,
} from './_digest.js'

const DAY = '2026-09-06'

const base = {
  dateStr: DAY,
  now: new Date('2026-09-06T07:00:00.000Z'),
  lastSentAt: '2026-09-05T07:00:00.000Z',
}

describe('dateInZone', () => {
  // The cron fires at 07:00 UTC, when New York is still on the previous day's
  // evening in winter and the small hours in summer. Either way the digest must
  // be for the day the reader is waking into.
  it('resolves the local day, not the UTC one', () => {
    // 03:00 EDT on 6 Sep — UTC has already rolled over to the 6th too.
    expect(dateInZone(new Date('2026-09-06T07:00:00Z'))).toBe('2026-09-06')
    // 23:30 EDT on 5 Sep is already the 6th in UTC; locally it is still the 5th.
    expect(dateInZone(new Date('2026-09-06T03:30:00Z'))).toBe('2026-09-05')
  })
})

describe('schedule', () => {
  it('lists only blocks for the day, in time order, skipping completed ones', () => {
    const d = buildDigest({
      ...base,
      blocks: [
        { id: 'b', date: DAY, startTime: '14:00', endTime: '15:00', title: 'Afternoon' },
        { id: 'a', date: DAY, startTime: '09:00', endTime: '09:30', title: 'Standup' },
        { id: 'c', date: DAY, startTime: '11:00', endTime: '12:00', title: 'Done', completed: true },
        { id: 'd', date: '2026-09-07', startTime: '10:00', endTime: '11:00', title: 'Tomorrow' },
      ],
    })
    expect(d.schedule.map(b => b.title)).toEqual(['Standup', 'Afternoon'])
  })

  it('labels a block that runs to end of day', () => {
    expect(blockTimeLabel({ startTime: '22:00', endTime: '00:00' })).toBe('10:00 PM – midnight')
    expect(blockTimeLabel({ startTime: '09:00', endTime: '10:30' })).toBe('9:00 AM – 10:30 AM')
  })
})

describe('unscheduled today', () => {
  it('excludes tasks already promoted to a time block', () => {
    const d = buildDigest({
      ...base,
      tasks: [
        { id: 't1', title: 'Loose', assignedDate: DAY },
        { id: 't2', title: 'Already scheduled', assignedDate: DAY },
      ],
      blocks: [{ id: 'b', date: DAY, startTime: '09:00', endTime: '10:00', title: 'Block', todoTaskId: 't2' }],
    })
    expect(d.dueToday.map(t => t.title)).toEqual(['Loose'])
  })

  it('includes recurring occurrences the app has not created yet', () => {
    // Nobody has opened the app today, so no instance row exists.
    const d = buildDigest({
      ...base,
      templates: [{ id: 'r1', title: 'Vitamins', recurrenceType: 'daily' }],
    })
    expect(d.dueToday.map(t => t.title)).toEqual(['Vitamins'])
    expect(d.dueToday[0].recurring).toBe(true)
  })

  it('does not double up when the instance already exists', () => {
    const d = buildDigest({
      ...base,
      tasks: [{ id: 't1', title: 'Vitamins', assignedDate: DAY, recurringTemplateId: 'r1' }],
      templates: [{ id: 'r1', title: 'Vitamins', recurrenceType: 'daily' }],
    })
    expect(d.dueToday.map(t => t.title)).toEqual(['Vitamins'])
  })

  it('leaves out completed and other days', () => {
    const d = buildDigest({
      ...base,
      tasks: [
        { id: 'a', title: 'Done', assignedDate: DAY, completed: true },
        { id: 'b', title: 'Tomorrow', assignedDate: '2026-09-07' },
      ],
    })
    expect(d.dueToday).toEqual([])
  })
})

describe('backlog', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({
    id: `b${i}`, title: `Backlog ${i}`, createdAt: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
  }))

  it('caps the list and reports the remainder', () => {
    const d = buildDigest({ ...base, tasks: many })
    expect(d.backlog).toHaveLength(15)
    expect(d.backlogHidden).toBe(5)
  })

  it('excludes dated, completed and recurring tasks', () => {
    const d = buildDigest({
      ...base,
      tasks: [
        { id: 'a', title: 'Undated' },
        { id: 'b', title: 'Dated', assignedDate: DAY },
        { id: 'c', title: 'Done', completed: true },
        { id: 'd', title: 'Recurring instance', recurringTemplateId: 'r1' },
      ],
    })
    expect(d.backlog.map(t => t.title)).toEqual(['Undated'])
  })
})

describe('notes', () => {
  const notes = [
    { id: 'n1', body: 'oldest', createdAt: '2026-09-01T10:00:00.000Z' },
    { id: 'n2', body: 'before the last digest', createdAt: '2026-09-05T06:00:00.000Z' },
    { id: 'n3', body: 'overnight from the ring', createdAt: '2026-09-06T04:00:00.000Z' },
  ]

  it('splits on the watermark, newest first', () => {
    const d = buildDigest({ ...base, notes })
    expect(d.newNotes.map(n => n.body)).toEqual(['overnight from the ring'])
    expect(d.archive.map(n => n.body)).toEqual(['before the last digest', 'oldest'])
  })

  it('falls back to the last 24 hours on the first ever run', () => {
    const d = buildDigest({ ...base, notes, lastSentAt: null })
    expect(d.newNotes.map(n => n.body)).toEqual(['overnight from the ring'])
  })

  it('caps the archive and reports the remainder', () => {
    const lots = Array.from({ length: 50 }, (_, i) => ({
      id: `x${i}`, body: `note ${i}`, createdAt: `2026-08-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    }))
    const d = buildDigest({ ...base, notes: lots })
    expect(d.archive).toHaveLength(40)
    expect(d.archiveHidden).toBe(10)
  })
})

describe('rendering', () => {
  const full = () => buildDigest({
    ...base,
    blocks: [{ id: 'b', date: DAY, startTime: '09:00', endTime: '09:30', title: 'Standup' }],
    tasks: [{ id: 't', title: 'Call the dentist', assignedDate: DAY }],
    notes: [{ id: 'n', body: 'buy milk', createdAt: '2026-09-06T04:00:00.000Z' }],
  })

  it('summarises the day in the subject', () => {
    expect(subjectFor(full())).toBe('Sunday, September 6 — 1 scheduled · 1 to do · 1 new note')
  })

  it('says so plainly when there is nothing on', () => {
    expect(subjectFor(buildDigest(base))).toBe('Sunday, September 6 — nothing scheduled')
  })

  it('renders every section into the HTML', () => {
    const html = renderHtml(full())
    expect(html).toContain('Standup')
    expect(html).toContain('Call the dentist')
    expect(html).toContain('buy milk')
    expect(html).toContain('9:00 AM – 9:30 AM')
  })

  it('escapes note text rather than letting it become markup', () => {
    const d = buildDigest({
      ...base,
      notes: [{ id: 'n', body: '<script>alert(1)</script>', createdAt: '2026-09-06T04:00:00.000Z' }],
    })
    const html = renderHtml(d)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('produces a plain-text alternative covering the same ground', () => {
    const text = renderText(full())
    expect(text).toContain('Standup')
    expect(text).toContain('Call the dentist')
    expect(text).toContain('buy milk')
    expect(text).not.toContain('<div')
  })

  it('states the empty cases instead of showing blank sections', () => {
    const html = renderHtml(buildDigest(base))
    expect(html).toContain('Nothing on the calendar.')
    expect(html).toContain('Nothing due today.')
    expect(html).toContain('Nothing new since yesterday.')
  })
})

describe('inline style attributes', () => {
  // Style values are interpolated into double-quoted attributes. A double quote
  // inside one (a font name, say) closes the attribute early and silently drops
  // every declaration after it — the email still renders, just wrong.
  it('never emits a double quote inside a style attribute', () => {
    const html = renderHtml(buildDigest({
      ...base,
      blocks: [{ id: 'b', date: DAY, startTime: '09:00', endTime: '10:00', title: 'Block' }],
      tasks: [{ id: 't', title: 'Task', assignedDate: DAY }],
      notes: [{ id: 'n', body: 'Note', createdAt: '2026-09-06T04:00:00.000Z' }],
    }))
    for (const attr of html.matchAll(/style="([^"]*)"/g)) {
      expect(attr[1]).not.toContain('"')
    }
    // The declaration that broke: the font stack must survive intact.
    expect(html).toMatch(/font-family:[^"]*sans-serif/)
    expect(html).toContain('max-width:600px')
  })
})
