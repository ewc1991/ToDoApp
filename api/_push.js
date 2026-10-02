// Pure helpers for deciding which scheduled blocks are "active right now" and
// building the push payload. Kept free of Firestore and web-push, same split
// as _digest.js, so this can be tested directly.
import { timeToMinutes, blockEndMinutes, isAllDay } from '../src/utils/timeUtils.js';
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

export function pushPayloadFor(blocks) {
  const title = blocks.length === 1
    ? blocks[0].title
    : `${blocks.length} unfinished tasks in progress`;
  const body = blocks.length === 1
    ? 'Still marked unfinished — tap to open today.'
    : blocks.map(b => b.title).join(', ');
  return { title, body, url: '/' };
}
