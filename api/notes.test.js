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

describe('bodies mangled by Content-Type guessing', () => {
  // Vercel form-decodes anything it can, so a caller that posts JSON without
  // setting Content-Type hands us {'{"body":"hi"}': ''} rather than a string.
  it('recovers JSON that was form-decoded into a junk key', async () => {
    expect(await extractBody(req({ '{"body":"hi"}': '' }, 'application/x-www-form-urlencoded'))).toBe('hi')
  })

  it('recovers plain text that was form-decoded into a junk key', async () => {
    expect(await extractBody(req({ 'just a note': '' }, 'application/x-www-form-urlencoded'))).toBe('just a note')
  })

  it('rejoins a payload that got split on "&"', async () => {
    expect(await extractBody(req({ '{"body":"a': '', 'b"}': '' }))).toBe('a&b')
  })

  it('still ignores an object with real keys but no note', async () => {
    expect(await extractBody(req({ title: 'x', tag: 'y' }, 'application/json'))).toBe('')
  })
})

describe('multipart/form-data from the voice ring', () => {
  // Verbatim shape the ring posts: CRLF line endings, the note in a field
  // called `transcription`, alongside metadata we ignore.
  const B = 'e1ce4698-bff3-4ef9-b062-a5693a6668d8'
  const envelope = [
    `--${B}`,
    'Content-Disposition: form-data; name="transcription"',
    '',
    'Test, test, test.',
    `--${B}`,
    'Content-Disposition: form-data; name="recordedAt"',
    '',
    '1788583020066',
    `--${B}`,
    'Content-Disposition: form-data; name="client"',
    '',
    'ring',
    `--${B}--`,
    '',
  ].join('\r\n')

  it('takes only the transcription, not the whole envelope', async () => {
    const got = await extractBody(req(Buffer.from(envelope), `multipart/form-data; boundary=${B}`))
    expect(got).toBe('Test, test, test.')
  })

  it('sniffs the boundary when no Content-Type survives', async () => {
    expect(await extractBody(req(Buffer.from(envelope)))).toBe('Test, test, test.')
  })

  it('handles a quoted boundary and bare LF endings', async () => {
    const lf = envelope.replace(/\r\n/g, '\n')
    expect(await extractBody(req(Buffer.from(lf), `multipart/form-data; boundary="${B}"`))).toBe('Test, test, test.')
  })

  it('ignores an envelope whose fields are all unknown', async () => {
    const other = `--${B}\r\nContent-Disposition: form-data; name="client"\r\n\r\nring\r\n--${B}--\r\n`
    expect(await extractBody(req(Buffer.from(other), `multipart/form-data; boundary=${B}`))).toBe('')
  })
})

describe('oversized bodies', () => {
  // The cap has to stop the read, not buffer everything and reject afterwards.
  const streamOf = (totalBytes, chunk = 64 * 1024) => {
    let sent = 0
    return {
      headers: {},
      body: undefined,
      chunksRead: 0,
      async *[Symbol.asyncIterator]() {
        while (sent < totalBytes) {
          const size = Math.min(chunk, totalBytes - sent)
          sent += size
          this.chunksRead++
          yield Buffer.alloc(size, 'x')
        }
      },
    }
  }

  it('gives up partway instead of reading the whole body', async () => {
    const req = streamOf(8 * 1024 * 1024)
    await extractBody(req)
    // 10k chars * 4 bytes = ~40KB ceiling, so it must bail in the first chunk or two.
    expect(req.chunksRead).toBeLessThanOrEqual(2)
  })

  it('still reads a body that fits', async () => {
    const req = {
      headers: {},
      body: undefined,
      async *[Symbol.asyncIterator]() { yield Buffer.from('a normal note') },
    }
    expect(await extractBody(req)).toBe('a normal note')
  })
})
