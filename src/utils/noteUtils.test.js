import { describe, it, expect } from 'vitest'
import { noteToTask } from './noteUtils.js'

describe('noteToTask', () => {
  it('returns null for empty or whitespace-only notes', () => {
    expect(noteToTask('')).toBeNull()
    expect(noteToTask('   \n  ')).toBeNull()
    expect(noteToTask(undefined)).toBeNull()
  })

  it('uses a short single-line note as the title with no duplicated notes', () => {
    expect(noteToTask('Buy milk')).toEqual({ title: 'Buy milk', notes: '' })
  })

  it('keeps the full text in notes when the note has more than one line', () => {
    const body = 'Call the dentist\nAsk about the Thursday slot\nBring insurance card'
    expect(noteToTask(body)).toEqual({ title: 'Call the dentist', notes: body })
  })

  it('never loses text when the first line exceeds the title limit', () => {
    const long = 'a'.repeat(250)
    const result = noteToTask(long)
    expect(result.title).toHaveLength(100)
    expect(result.title.endsWith('…')).toBe(true)
    // The critical guarantee: the original note text survives the conversion.
    expect(result.notes).toBe(long)
  })

  it('trims surrounding whitespace', () => {
    expect(noteToTask('  Water the plants  ')).toEqual({ title: 'Water the plants', notes: '' })
  })
})
