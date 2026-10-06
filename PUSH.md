# Push notifications

Every 30 minutes, `GET /api/push-due` checks for scheduled blocks whose time
window contains right now and that aren't marked complete, and pushes a
notification for each device subscribed. The point is the same nudge you'd
get from a phone's native reminders — if a task you scheduled for this slot
is still sitting there unfinished, you get told about it again, on a loop,
until you either finish it or move it.

Each run also looks an hour ahead: unfinished blocks starting within the next
60 minutes (including just past midnight, late in the evening) are listed in
the same notification with their start times, so you get a heads-up before
they begin, not just once they're underway.

## Setup

**1. VAPID keys** — identify this server to the push services (Apple's,
Google's, etc.) without a per-provider account:

```
npx web-push generate-vapid-keys --json
```

**2. Set env vars** in Vercel → Project → Settings → Environment Variables:

| Name | Value | Where |
|---|---|---|
| `VAPID_PUBLIC_KEY` | `publicKey` from step 1 | Production (+ Preview) |
| `VAPID_PRIVATE_KEY` | `privateKey` from step 1 | same, keep secret |
| `VAPID_SUBJECT` | `mailto:you@example.com` | same — required by the push spec, some services use it to contact you if a deployment misbehaves |
| `VITE_VAPID_PUBLIC_KEY` | same value as `VAPID_PUBLIC_KEY` | same — this one is `VITE_`-prefixed because the browser needs it too, to open the subscription |

(`CRON_SECRET` and `FIREBASE_SERVICE_ACCOUNT` already exist for the digest —
`push-due` reuses both.)

**3. Schedule it** — see `CRON.md`. This app calls every scheduled route from
cron-job.org rather than Vercel Cron, so `/api/push-due` needs a job there set
to run every 30 minutes.

**4. Deploy**, then open the app on the phone that should get the nudges and
use the avatar menu → **Enable notifications**. That's what actually creates
the subscription and saves it to `users/{uid}/pushSubscriptions/*` — nothing
sends until at least one device has done this.

**5. iPhone only:** push (and the permission prompt itself) only works from
the **installed home-screen app**, iOS 16.4+. A Safari tab can't do it at
all. Android Chrome works either installed or in a regular tab.

## Checking it without waiting for a real nudge

```bash
curl "https://<your-app>.vercel.app/api/push-due?dryRun=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Reports which blocks it considers "due right now" (`due`), which start in
the next hour (`upcoming`), and how many devices are subscribed, without
actually sending anything.

## Notification behavior

- Repeated nudges share one notification tag (`planner-due`), so a fresh one
  replaces the last instead of piling up a stack by the end of the day.
- Tapping it focuses an already-open tab if there is one, otherwise opens a
  new one.
- All-day items never nudge — they have no clock to be "in progress" against,
  and already show up in the morning digest.
- A subscription the push service reports as gone (device uninstalled the
  app, cleared site data, etc.) is deleted from Firestore automatically on
  the next run that tries it.
