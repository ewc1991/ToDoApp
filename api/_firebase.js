// Shared Firestore admin handle for the API routes. The leading underscore
// keeps Vercel from exposing this as an endpoint of its own.
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'node:crypto';

export function db() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return getFirestore();
}

// Every route works against one user's subtree.
export function userDoc() {
  const uid = process.env.NOTES_USER_UID;
  if (!uid) throw new Error('NOTES_USER_UID is not set');
  return db().collection('users').doc(uid);
}

// Constant-time-ish comparison for the shared secrets guarding these routes.
export function secretMatches(given, expected) {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
