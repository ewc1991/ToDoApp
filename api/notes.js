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
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'node:crypto';

const MAX_BODY = 10_000;

const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const ts = () => new Date().toISOString();

function db() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getFirestore();
}

// Constant-time compare so the secret can't be guessed a byte at a time.
function secretMatches(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function presentedSecret(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return (req.headers['x-webhook-secret'] || '').trim();
}

const BODY_KEYS = ['body', 'text', 'note', 'content', 'message'];

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
    for await (const chunk of req) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
  } catch {
    return '';
  }
}

export async function extractBody(req) {
  let payload = req.body;
  if (Buffer.isBuffer(payload)) payload = payload.toString('utf8');
  if (payload === undefined || payload === null || payload === '') {
    payload = await readRawBody(req);
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

  const body = (await extractBody(req)).trim();
  if (!body) {
    // Say what showed up, so a misconfigured caller is diagnosable from its own
    // response instead of from the function logs.
    return res.status(400).json({
      error: 'Missing note body',
      hint: `Send JSON {"body": "..."} or a raw text/plain body. Received Content-Type "${req.headers['content-type'] || '(none)'}" parsed as ${Buffer.isBuffer(req.body) ? 'buffer' : typeof req.body}.`,
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
