// POST /api/notes — drop a note straight into Firestore from anywhere.
//
// The app has no server of its own; this is the one write path for outside
// callers. It writes the exact shape ADD_NOTE writes in AppContext, so the
// onSnapshot listener on users/{uid}/notes picks it up live in an open tab.
//
// The note text is read from JSON, form-encoded, or raw-text bodies, under any
// of the keys in BODY_KEYS, because callers vary in what they can send.
//
// Env (set in Vercel → Settings → Environment Variables):
//   FIREBASE_SERVICE_ACCOUNT  service-account JSON, pasted whole
//   NOTES_WEBHOOK_SECRET      shared secret callers send as a bearer token
//   NOTES_USER_UID            the Firebase uid notes land under
import { db, secretMatches } from './_firebase.js';

const MAX_BODY = 10_000;
const TOO_BIG = Symbol('too-big');

const WINDOW_MS = 60_000;
const MAX_WRITES = 30; // notes per minute

// Sliding-window arithmetic, kept pure so it can be tested without Firestore.
// Returns the state to store plus whether this request is allowed.
export function nextWindow(prev, now, limit, windowMs = WINDOW_MS) {
  const live = prev && now - prev.windowStart < windowMs;
  const windowStart = live ? prev.windowStart : now;
  const count = (live ? prev.count : 0) + 1;
  return { windowStart, count, allowed: count <= limit };
}

// Counted in Firestore rather than in memory: instances are not shared, and a
// module-level counter measurably never fires for traffic like this. Only
// authenticated requests are counted — making an unauthenticated caller able to
// drive database writes would be its own amplification bug.
async function withinWriteLimit(uid) {
  const ref = db().collection('users').doc(uid).collection('rateLimits').doc('notesWebhook');
  try {
    return await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const state = nextWindow(snap.exists ? snap.data() : null, Date.now(), MAX_WRITES);
      tx.set(ref, { windowStart: state.windowStart, count: state.count });
      return state.allowed;
    });
  } catch (err) {
    // A limiter that cannot read its own counter must not take the endpoint down.
    console.error('Rate limit check failed, allowing request:', err);
    return true;
  }
}

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const ts = () => new Date().toISOString();



function presentedSecret(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (req.headers['x-webhook-secret'] || '').trim();
}

// 'transcription' is what the voice-recorder ring names its field.
const BODY_KEYS = ['body', 'text', 'note', 'transcription', 'content', 'message'];

function fromObject(obj) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of BODY_KEYS) {
    if (typeof obj[key] === 'string' && obj[key].trim()) return obj[key];
  }
  return '';
}

// Vercel only pre-parses bodies whose Content-Type it recognises; anything else
// arrives as a Buffer, or not at all. Callers we do not control get all of it
// wrong in different ways, so unwrap every layer we might be handed.
async function readRawBody(req) {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      // Stop reading rather than buffering a whole oversized body only to reject
      // it afterwards. The cap is in bytes and MAX_BODY is characters, so leave
      // room for multi-byte UTF-8 before giving up.
      if (size > MAX_BODY * 4) return TOO_BIG;
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch {
    return '';
  }
}

// Vercel never parses multipart/form-data, so the raw envelope arrives intact
// and we pull the text fields out ourselves.
function parseMultipart(raw, boundary) {
  const fields = {};
  for (const chunk of raw.split(`--${boundary}`)) {
    const part = chunk.replace(/^\r?\n/, '');
    if (!part || part.startsWith('--')) continue;
    const split = part.search(/\r?\n\r?\n/);
    if (split === -1) continue;
    const name = /name="([^"]*)"/i.exec(part.slice(0, split));
    if (!name) continue;
    fields[name[1]] = part.slice(split).replace(/^\r?\n\r?\n/, '').replace(/\r?\n$/, '');
  }
  return fields;
}

function boundaryFrom(contentType, raw) {
  const declared = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (declared) return (declared[1] || declared[2]).trim();
  // No usable Content-Type reached us — the envelope opens with the boundary.
  const firstLine = raw.split(/\r?\n/, 1)[0].trim();
  return firstLine.startsWith('--') ? firstLine.slice(2) : '';
}

const looksMultipart = (raw) =>
  raw.startsWith('--') && /content-disposition:\s*form-data/i.test(raw);

export async function extractBody(req) {
  const contentType = req.headers['content-type'] || '';
  let payload = req.body;
  if (Buffer.isBuffer(payload)) payload = payload.toString('utf8');
  if (payload === undefined || payload === null || payload === '') {
    payload = await readRawBody(req);
    if (payload === TOO_BIG) return TOO_BIG;
  }

  if (payload && typeof payload === 'object') {
    const found = fromObject(payload);
    if (found) return found;
    // A body sent without a usable Content-Type gets form-decoded anyway, which
    // turns the whole payload into keys with empty values. Rejoin them and let
    // the string handling below have a go at the real content.
    const entries = Object.entries(payload);
    if (!entries.length || !entries.every(([, v]) => v === '')) return '';
    payload = entries.map(([k]) => k).join('&');
  }
  if (typeof payload !== 'string') return '';

  const raw = payload.trim();
  if (!raw) return '';

  // Multipart, either declared in the header or sniffed from the envelope.
  if (contentType.startsWith('multipart/form-data') || looksMultipart(raw)) {
    const boundary = boundaryFrom(contentType, raw);
    if (boundary) {
      // Never fall through to the raw-text path from here: storing a whole
      // multipart envelope as the note is worse than a clear 400.
      return fromObject(parseMultipart(raw, boundary));
    }
  }

  // JSON that arrived unparsed, e.g. sent with no Content-Type.
  if (raw.startsWith('{')) {
    try {
      const found = fromObject(JSON.parse(raw));
      if (found) return found;
    } catch { /* not JSON after all — fall through to plain text */ }
  }

  // Form-encoded, but only when it actually yields one of our keys; otherwise a
  // plain note that happens to contain "=" would be mangled.
  if (raw.includes('=')) {
    const found = fromObject(Object.fromEntries(new URLSearchParams(raw)));
    if (found) return found;
  }

  return raw;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!secretMatches(presentedSecret(req), process.env.NOTES_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const uid = process.env.NOTES_USER_UID;
  if (!uid) {
    console.error('NOTES_USER_UID is not set');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  if (!(await withinWriteLimit(uid))) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: `At most ${MAX_WRITES} notes per minute.` });
  }

  const extracted = await extractBody(req);
  if (extracted === TOO_BIG) {
    return res.status(413).json({ error: `Note body exceeds ${MAX_BODY} characters` });
  }

  const body = extracted.trim();
  if (!body) {
    // Say what showed up, so a misconfigured caller is diagnosable from its own
    // response instead of from the function logs.
    return res.status(400).json({
      error: 'Missing note body',
      hint: `Send the note as JSON, form-encoded, multipart, or raw text, under any of: ${BODY_KEYS.join(", ")}. Received Content-Type "${req.headers['content-type'] || '(none)'}" parsed as ${Buffer.isBuffer(req.body) ? 'buffer' : typeof req.body}.`,
    });
  }
  if (body.length > MAX_BODY) {
    return res.status(413).json({ error: `Note body exceeds ${MAX_BODY} characters` });
  }

  // ISO strings, not Firestore Timestamps — the client sorts and formats these
  // with `new Date(note.createdAt)`.
  const note = { id: genId(), body, createdAt: ts(), updatedAt: ts() };

  try {
    await db().collection('users').doc(uid).collection('notes').doc(note.id).set(note);
  } catch (err) {
    console.error('Failed to write note:', err);
    return res.status(500).json({ error: 'Failed to save note' });
  }

  return res.status(201).json({ ok: true, id: note.id });
}
