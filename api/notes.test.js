import { describe, it, expect } from 'vitest'
import { extractBody } from './notes.js'

// Callers we don't control send the note text every which way. Vercel only
// pre-parses Content-Types it recognises, so the handler has to cope with
// parsed objects, raw buffers, and unparsed strings alike.
const req = (body, contentType) => ({
  headers: contentType ? { 'content-type': contentType } : {},
  body,
  // Async-iterable, so the raw-stream fallback has something to read.
  async *[Symbol.asyncIterator]() {},
})

const streamed = (raw) => ({
  headers: {},
  body: undefined,
  async *[Symbol.asyncIterator]() { yield Buffer.from(raw) },
})

describe('extractBody', () => {
  it('reads pre-parsed JSON', async () => {
    expect(await extractBody(req({ body: 'buy milk' }, 'application/json'))).toBe('buy milk')
  })

  it('accepts the alternate key names', async () => {
    for (const key of ['text', 'note', 'content', 'message']) {
      expect(await extractBody(req({ [key]: 'hi' }, 'application/json'))).toBe('hi')
    }
  })

  it('parses JSON that arrived as a buffer with no Content-Type', async () => {
    expect(await extractBody(req(Buffer.from('{"body":"from buffer"}')))).toBe('from buffer')
  })

  it('treats a plain-text buffer as the note itself', async () => {
    expect(await extractBody(req(Buffer.from('just text'), 'text/plain'))).toBe('just text')
  })

  it('reads form-encoded bodies', async () => {
    expect(await extractBody(req('body=buy+milk', 'application/x-www-form-urlencoded'))).toBe('buy milk')
    expect(await extractBody(req({ body: 'buy milk' }, 'application/x-www-form-urlencoded'))).toBe('buy milk')
  })

  it('keeps a plain note containing "=" intact', async () => {
    const note = 'remember: x = y + 1'
    expect(await extractBody(req(note, 'text/plain'))).toBe(note)
  })

  it('falls back to the raw stream when nothing was pre-parsed', async () => {
    expect(await extractBody(streamed('{"body":"streamed"}'))).toBe('streamed')
    expect(await extractBody(streamed('streamed text'))).toBe('streamed text')
  })

  it('returns empty for genuinely empty bodies', async () => {
    expect(await extractBody(req(undefined))).toBe('')
    expect(await extractBody(req('   ', 'text/plain'))).toBe('')
    expect(await extractBody(req({ unrelated: 'x' }, 'application/json'))).toBe('')
  })
})
