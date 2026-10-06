// GET /api/push-due — nags about whatever's still unfinished right now, and
// gives a heads-up on anything starting in the next hour.
//
// cron-job.org calls this every 30 minutes with the CRON_SECRET as a bearer
// token (see CRON.md — this app uses cron-job.org for every scheduled job,
// not Vercel Cron, since the Hobby plan caps Vercel's own crons at once a
// day).
//
// Env (alongside the digest's CRON_SECRET and FIREBASE_SERVICE_ACCOUNT):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   from `npx web-push generate-vapid-keys`
//   VAPID_SUBJECT                          a mailto: address or site URL — required by the push spec
import webpush from 'web-push';
import { userDoc, secretMatches } from './_firebase.js';
import { dateInZone } from './_digest.js';
import {
  minutesNowInZone, activeIncompleteBlocks, upcomingIncompleteBlocks, pushPayloadFor, LOOKAHEAD_MINUTES,
} from './_push.js';

export default async function handler(req, res) {
  const presented = (req.headers.authorization || '').replace(/^Bearer /, '').trim();
  if (!secretMatches(presented, process.env.CRON_SECRET)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or VAPID_SUBJECT is not set');
    return res.status(500).json({ error: 'Push is not configured yet' });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  try {
    const user = userDoc();
    const now = new Date();
    const dateStr = dateInZone(now);
    const nowMinutes = minutesNowInZone(now);

    const [blocksSnap, subsSnap] = await Promise.all([
      user.collection('scheduledBlocks').get(),
      user.collection('pushSubscriptions').get(),
    ]);

    const blocks = blocksSnap.docs.map(d => d.data());
    const due = activeIncompleteBlocks(blocks, dateStr, nowMinutes);
    const upcoming = upcomingIncompleteBlocks(blocks, dateStr, nowMinutes);
    // Late in the evening the lookahead runs into tomorrow — check its early
    // blocks too, measuring "now" as minutes before tomorrow's midnight.
    const laterDateStr = dateInZone(new Date(now.getTime() + LOOKAHEAD_MINUTES * 60000));
    if (laterDateStr !== dateStr) {
      upcoming.push(...upcomingIncompleteBlocks(blocks, laterDateStr, nowMinutes - 1440));
    }

    // dryRun renders without sending, so the matching logic can be checked
    // against real data without actually paging the phone.
    if (req.query?.dryRun) {
      return res.status(200).json({
        ok: true, dryRun: true,
        due: due.map(b => b.title), upcoming: upcoming.map(b => b.title),
        subscriptions: subsSnap.size,
      });
    }

    if ((!due.length && !upcoming.length) || subsSnap.empty) {
      return res.status(200).json({ ok: true, sent: 0, due: due.length, upcoming: upcoming.length });
    }

    const payload = JSON.stringify(pushPayloadFor(due, upcoming));
    let sent = 0;
    await Promise.all(subsSnap.docs.map(async (docSnap) => {
      try {
        await webpush.sendNotification(docSnap.data(), payload);
        sent++;
      } catch (err) {
        // 404/410 means the browser dropped the subscription (uninstalled, cleared
        // site data, expired) — nothing will ever deliver to it again.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await docSnap.ref.delete().catch(() => {});
        } else {
          console.error('Push failed:', err);
        }
      }
    }));

    return res.status(200).json({ ok: true, sent, due: due.length, upcoming: upcoming.length });
  } catch (err) {
    console.error('push-due failed:', err);
    return res.status(500).json({ error: 'Failed to send push' });
  }
}
