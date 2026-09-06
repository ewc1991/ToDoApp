// GET /api/digest — the morning email.
//
// Vercel Cron calls this overnight with the CRON_SECRET as a bearer token. It
// reads the day ahead out of Firestore, sends one email through Resend, and
// records when it ran so the next digest knows which notes are new.
//
// Env (alongside the webhook's FIREBASE_SERVICE_ACCOUNT and NOTES_USER_UID):
//   CRON_SECRET     supplied by Vercel to authorise the scheduled call
//   RESEND_API_KEY  from resend.com
//   DIGEST_TO       where to send it
//   DIGEST_FROM     optional; defaults to Resend's shared sender
import { Resend } from 'resend';
import { userDoc, secretMatches } from './_firebase.js';
import {
  buildDigest, renderHtml, renderText, subjectFor, dateInZone,
} from './_digest.js';

const DEFAULT_FROM = 'Planner <onboarding@resend.dev>';

const docsOf = (snap) => snap.docs.map(d => d.data());

export default async function handler(req, res) {
  const presented = (req.headers.authorization || '').replace(/^Bearer /, '').trim();
  if (!secretMatches(presented, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = userDoc();
    const stateRef = user.collection('settings').doc('digest');

    const [tasks, blocks, templates, notes, state] = await Promise.all([
      user.collection('tasks').get().then(docsOf),
      user.collection('scheduledBlocks').get().then(docsOf),
      user.collection('recurringTemplates').get().then(docsOf),
      user.collection('notes').get().then(docsOf),
      stateRef.get(),
    ]);

    const now = new Date();
    const digest = buildDigest({
      dateStr: dateInZone(now),
      tasks, blocks, templates, notes,
      lastSentAt: state.exists ? state.data().lastSentAt : null,
      now,
    });

    // dryRun renders without sending or moving the watermark, so the digest can
    // be checked against real data without burning a day's worth of new notes.
    // Deliberately before the email config check, so it works before the mail
    // provider is wired up at all.
    if (req.query?.dryRun) {
      return res.status(200).json({
        ok: true, dryRun: true, subject: subjectFor(digest), counts: digest.counts,
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.DIGEST_TO;
    if (!apiKey || !to) {
      console.error('RESEND_API_KEY or DIGEST_TO is not set');
      return res.status(500).json({ error: 'Email is not configured yet' });
    }

    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.DIGEST_FROM || DEFAULT_FROM,
      to,
      subject: subjectFor(digest),
      html: renderHtml(digest),
      text: renderText(digest),
    });

    if (error) {
      console.error('Resend rejected the digest:', error);
      return res.status(502).json({ error: 'Email provider rejected the message' });
    }

    // Only after a successful send, so a failed run does not silently consume
    // the notes it never delivered.
    await stateRef.set({ lastSentAt: now.toISOString() }, { merge: true });

    return res.status(200).json({ ok: true, counts: digest.counts });
  } catch (err) {
    console.error('Digest failed:', err);
    return res.status(500).json({ error: 'Failed to build or send the digest' });
  }
}
