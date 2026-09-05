// POST /api/notes — drop a note straight into Firestore from anywhere.
//
// The app has no server of its own; this is the one write path for outside
// callers. It writes the exact shape ADD_NOTE writes in AppContext, so the
// onSnapshot listener on users/{uid}/notes picks it up live in an open tab.
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

// Accepts {body|text|note} as JSON, or a raw text/plain body.
function extractBody(payload) {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object') {
    for (const key of ['body', 'text', 'note']) {
      if (typeof payload[key] === 'string') return payload[key];
    }
  }
  return '';
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

  const body = extractBody(req.body).trim();
  if (!body) return res.status(400).json({ error: 'Missing note body' });
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
