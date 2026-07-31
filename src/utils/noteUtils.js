const TITLE_MAX = 100;

// A note becomes a task title, but the full text has to survive the conversion —
// the note itself is deleted afterwards, so anything dropped here is gone for good.
export function noteToTask(body) {
  const text = (body || '').trim();
  if (!text) return null;
  const firstLine = text.split('\n')[0].trim();
  const title = firstLine.length > TITLE_MAX
    ? `${firstLine.slice(0, TITLE_MAX - 1).trimEnd()}…`
    : firstLine;
  // Keep the remainder (and the untruncated first line) in the task's notes.
  const notes = text === title ? '' : text;
  return { title, notes };
}
