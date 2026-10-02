# Scheduled jobs

This app has two routes that need to run on a timer:

| Route | Schedule | What it does |
|---|---|---|
| `/api/digest` | once a day | the morning email — see the comment atop `api/digest.js` |
| `/api/push-due` | every 30 minutes | push nudges for unfinished scheduled items — see `PUSH.md` |

Both are called with `CRON_SECRET` as a bearer token, both return quickly, and
neither needs anything beyond a GET request on schedule.

## Why cron-job.org instead of Vercel Cron

Vercel Cron is the obvious first choice, but the Hobby plan caps *every* cron
job on a project at once a day — fine for the digest, useless for a
30-minute push check. Rather than run one job through Vercel and one through
an external scheduler, every scheduled call in this app goes through
[cron-job.org](https://cron-job.org) (free), so there's one place to look
when something didn't fire. There's no `vercel.json` in this repo because of
this — it isn't needed for anything else either.

## Setup

For each route, create a cron-job.org job:

1. **Title** — anything recognizable, e.g. "Planner — digest" / "Planner —
   push-due".
2. **URL** — `https://<your-app>.vercel.app/api/digest` or `/api/push-due`.
3. **Schedule** — daily at the desired time (UTC) for the digest; every 30
   minutes for push-due.
4. **Request method** — GET.
5. **Advanced → Custom headers** — add `Authorization: Bearer <CRON_SECRET>`,
   the same secret already set in Vercel's env vars for both routes.
6. Save, then use the job's "Test run" / "Run now" button to confirm a 200
   response before trusting the schedule.

## Checking a job actually ran

cron-job.org's job detail page keeps an execution history with status codes
and response times — check there first if a digest didn't arrive or pushes
seem to have stopped. Both routes also support a `?dryRun=1` query param for
checking the matching logic by hand without it; see `PUSH.md` for `push-due`'s
version.
