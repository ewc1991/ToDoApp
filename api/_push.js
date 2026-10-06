// Pure helpers for deciding which scheduled blocks are "active right now" and
// building the push payload. Kept free of Firestore and web-push, same split
// as _digest.js, so this can be tested directly.
import { timeToMinutes, blockEndMinutes, isAllDay, formatTime } from '../src/utils/timeUtils.js';
import { TIME_ZONE } from './_digest.js';

// Minutes since midnight in the given zone. hourCycle: 'h23' is deliberate —
// some ICU builds return "24" instead of "00" at midnight with hour12: false,
// which would silently skip every block that starts right after midnight.
export function minutesNowInZone(now = new Date(), timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit',
  }).formatToParts(now);
  const h = Number(parts.find(p => p.type === 'hour').value);
  const m = Number(parts.find(p => p.type === 'minute').value);
  return h * 60 + m;
}

// Timed, incomplete blocks on the given date whose window contains the given
// minute. All-day items have no clock to be "in progress" against, so they
// never page here — they are already covered by the morning digest.
export function activeIncompleteBlocks(blocks, dateStr, nowMinutes) {
  return blocks.filter(b =>
    b.date === dateStr && !b.completed && !isAllDay(b) &&
    timeToMinutes(b.startTime) <= nowMinutes && nowMinutes < blockEndMinutes(b)
  );
}

// How far ahead each run looks for blocks about to start.
export const LOOKAHEAD_MINUTES = 60;

// Timed, incomplete blocks on the given date that start after the given minute
// but within the lookahead, soonest first. Strictly after, so a block starting
// right now counts as active rather than both. nowMinutes may be negative to
// check the next date when the lookahead runs past midnight (e.g. 23:30 is
// -30 against tomorrow).
export function upcomingIncompleteBlocks(blocks, dateStr, nowMinutes, lookahead = LOOKAHEAD_MINUTES) {
  return blocks
    .filter(b => {
      if (b.date !== dateStr || b.completed || isAllDay(b)) return false;
      const start = timeToMinutes(b.startTime);
      return nowMinutes < start && start <= nowMinutes + lookahead;
    })
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

const withTime = b => `${b.title} (${formatTime(b.startTime)})`;

export function pushPayloadFor(active, upcoming = []) {
  if (!active.length) {
    const title = upcoming.length === 1
      ? `Up next: ${upcoming[0].title}`
      : `${upcoming.length} tasks in the next hour`;
    const body = upcoming.length === 1
      ? `Starts at ${formatTime(upcoming[0].startTime)} — tap to open today.`
      : upcoming.map(withTime).join(', ');
    return { title, body, url: '/' };
  }

  const title = active.length === 1
    ? active[0].title
    : `${active.length} unfinished tasks in progress`;
  const now = active.length === 1
    ? (upcoming.length ? 'Still marked unfinished.' : 'Still marked unfinished — tap to open today.')
    : active.map(b => b.title).join(', ');
  const body = upcoming.length
    ? `${now}\nNext hour: ${upcoming.map(withTime).join(', ')}`
    : now;
  return { title, body, url: '/' };
}
