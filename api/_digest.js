// Assembly and rendering for the morning digest. Kept free of Firestore and
// Resend so the shape of the email can be tested directly.
import { shouldRecurOnDate } from '../src/utils/recurringUtils.js';
import { timeToMinutes, formatTime, blockEndMinutes } from '../src/utils/timeUtils.js';

export const TIME_ZONE = 'America/New_York';

// The cron fires overnight, when the UTC date has already rolled over. Asking
// UTC for "today" would build tomorrow's digest, so the day is resolved in the
// reader's own zone.
export function dateInZone(now = new Date(), timeZone = TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function longDateInZone(dateStr, timeZone = TIME_ZONE) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

// A block stored with an end at or before its start ran to end of day.
export function blockTimeLabel(block) {
  const end = blockEndMinutes(block);
  const endLabel = end >= 1440 ? 'midnight' : formatTime(block.endTime);
  return `${formatTime(block.startTime)} – ${endLabel}`;
}

export function buildDigest({
  dateStr,
  tasks = [],
  blocks = [],
  templates = [],
  notes = [],
  lastSentAt = null,
  now = new Date(),
  backlogLimit = 15,
  archiveLimit = 40,
}) {
  // A task promoted to a time block is represented by the block, not twice.
  const promoted = new Set(blocks.filter(b => b.todoTaskId).map(b => b.todoTaskId));

  const schedule = blocks
    .filter(b => b.date === dateStr && !b.completed)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const dueToday = tasks
    .filter(t => t.assignedDate === dateStr && !t.completed && !promoted.has(t.id))
    .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));

  // Recurring instances are created by the app when a day is opened, which has
  // not happened yet at this hour. Work out today's occurrences from the
  // templates so the digest is complete — without writing anything, since a
  // second writer alongside the client is how duplicates got made before.
  const alreadyMaterialised = new Set(
    tasks.filter(t => t.assignedDate === dateStr && t.recurringTemplateId)
      .map(t => t.recurringTemplateId)
  );
  const recurringDue = templates
    .filter(t => !alreadyMaterialised.has(t.id) && shouldRecurOnDate(t, dateStr))
    .map(t => ({ id: `template-${t.id}`, title: t.title, notes: t.notes || '', recurring: true }));

  const backlogAll = tasks
    .filter(t => !t.assignedDate && !t.completed && !t.recurringTemplateId && !promoted.has(t.id))
    .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

  const byNewest = [...notes]
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  // With no watermark — the first ever run — treat the last day as new.
  const cutoff = lastSentAt || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const newNotes = byNewest.filter(n => String(n.createdAt || '') > cutoff);
  const archiveAll = byNewest.filter(n => !(String(n.createdAt || '') > cutoff));

  return {
    dateStr,
    heading: longDateInZone(dateStr),
    schedule,
    dueToday: [...dueToday, ...recurringDue],
    backlog: backlogAll.slice(0, backlogLimit),
    backlogHidden: Math.max(0, backlogAll.length - backlogLimit),
    newNotes,
    archive: archiveAll.slice(0, archiveLimit),
    archiveHidden: Math.max(0, archiveAll.length - archiveLimit),
    counts: {
      schedule: schedule.length,
      dueToday: dueToday.length + recurringDue.length,
      backlog: backlogAll.length,
      newNotes: newNotes.length,
      notes: notes.length,
    },
  };
}

export function subjectFor(digest) {
  const { schedule, dueToday, newNotes } = digest.counts;
  const bits = [];
  if (schedule) bits.push(`${schedule} scheduled`);
  if (dueToday) bits.push(`${dueToday} to do`);
  if (newNotes) bits.push(`${newNotes} new note${newNotes === 1 ? '' : 's'}`);
  const summary = bits.length ? bits.join(' · ') : 'nothing scheduled';
  return `${digest.heading} — ${summary}`;
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const noteDate = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(d);
};

// Inline styles throughout: mail clients strip stylesheets.
const S = {
  body: 'margin:0;padding:0;background:#FEFCF7;',
  // Single quotes only — these values land inside a double-quoted style
  // attribute, and a double quote here would close it and drop the rest.
  wrap: "max-width:600px;margin:0 auto;padding:28px 20px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2B2018;",
  h1: 'margin:0 0 4px;font-size:23px;font-weight:800;letter-spacing:-.5px;color:#2B2018;',
  sub: 'margin:0 0 26px;font-size:13px;color:#8A7B6B;',
  h2: 'margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#B35C3A;',
  section: 'margin:0 0 26px;',
  row: 'padding:9px 0;border-bottom:1px solid #EFE7DA;',
  title: 'font-size:15px;font-weight:600;color:#2B2018;line-height:1.35;',
  meta: 'font-size:12px;color:#8A7B6B;line-height:1.4;',
  time: 'font-size:12px;font-weight:700;color:#B35C3A;letter-spacing:.3px;',
  noteBody: 'font-size:14px;color:#3D2F24;line-height:1.5;white-space:pre-wrap;word-break:break-word;',
  empty: 'font-size:14px;color:#8A7B6B;font-style:italic;',
  more: 'margin:8px 0 0;font-size:12px;color:#8A7B6B;',
  tag: 'display:inline-block;margin-left:6px;padding:1px 6px;border-radius:8px;background:#F3ECFF;color:#7B42F6;font-size:10px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;vertical-align:1px;',
};

function section(title, inner) {
  return `<div style="${S.section}"><div style="${S.h2}">${esc(title)}</div>${inner}</div>`;
}

const emptyRow = (text) => `<div style="${S.empty}">${esc(text)}</div>`;

export function renderHtml(digest) {
  const parts = [];

  parts.push(section('Today’s schedule', digest.schedule.length
    ? digest.schedule.map(b => `
      <div style="${S.row}">
        <div style="${S.time}">${esc(blockTimeLabel(b))}</div>
        <div style="${S.title}">${esc(b.title)}</div>
        ${b.notes ? `<div style="${S.meta}">${esc(b.notes)}</div>` : ''}
      </div>`).join('')
    : emptyRow('Nothing on the calendar.')));

  parts.push(section('Unscheduled today', digest.dueToday.length
    ? digest.dueToday.map(t => `
      <div style="${S.row}">
        <div style="${S.title}">${esc(t.title)}${t.recurring ? `<span style="${S.tag}">Recurring</span>` : ''}</div>
        ${t.notes ? `<div style="${S.meta}">${esc(t.notes)}</div>` : ''}
      </div>`).join('')
    : emptyRow('Nothing due today.')));

  if (digest.backlog.length) {
    parts.push(section('Backlog', digest.backlog.map(t => `
      <div style="${S.row}">
        <div style="${S.title}">${esc(t.title)}</div>
      </div>`).join('')
      + (digest.backlogHidden ? `<p style="${S.more}">+${digest.backlogHidden} more in the app</p>` : '')));
  }

  parts.push(section(`New notes${digest.newNotes.length ? ` (${digest.newNotes.length})` : ''}`,
    digest.newNotes.length
      ? digest.newNotes.map(n => `
        <div style="${S.row}">
          <div style="${S.meta}">${esc(noteDate(n.createdAt))}</div>
          <div style="${S.noteBody}">${esc(n.body)}</div>
        </div>`).join('')
      : emptyRow('Nothing new since yesterday.')));

  if (digest.archive.length) {
    parts.push(section('All notes', digest.archive.map(n => `
      <div style="${S.row}">
        <div style="${S.meta}">${esc(noteDate(n.createdAt))}</div>
        <div style="${S.noteBody}">${esc(n.body)}</div>
      </div>`).join('')
      + (digest.archiveHidden ? `<p style="${S.more}">+${digest.archiveHidden} older notes in the app</p>` : '')));
  }

  return `<!doctype html><html><body style="${S.body}"><div style="${S.wrap}">
    <h1 style="${S.h1}">${esc(digest.heading)}</h1>
    <p style="${S.sub}">${esc(subjectFor(digest).split('— ')[1] || '')}</p>
    ${parts.join('')}
  </div></body></html>`;
}

export function renderText(digest) {
  const lines = [digest.heading, ''];
  const block = (title, rows, fallback, hidden = 0, hiddenLabel = 'more') => {
    lines.push(title.toUpperCase(), '');
    if (rows.length) lines.push(...rows);
    else lines.push(`  ${fallback}`);
    if (hidden) lines.push(`  +${hidden} ${hiddenLabel} in the app`);
    lines.push('');
  };

  block('Today’s schedule',
    digest.schedule.map(b => `  ${blockTimeLabel(b)}  ${b.title}`),
    'Nothing on the calendar.');

  block('Unscheduled today',
    digest.dueToday.map(t => `  - ${t.title}${t.recurring ? '  (recurring)' : ''}`),
    'Nothing due today.');

  if (digest.backlog.length) {
    block('Backlog', digest.backlog.map(t => `  - ${t.title}`), '', digest.backlogHidden);
  }

  block('New notes',
    digest.newNotes.flatMap(n => [`  ${noteDate(n.createdAt)}`, `  ${n.body}`, '']),
    'Nothing new since yesterday.');

  if (digest.archive.length) {
    block('All notes',
      digest.archive.flatMap(n => [`  ${noteDate(n.createdAt)}`, `  ${n.body}`, '']),
      '', digest.archiveHidden, 'older notes');
  }

  return lines.join('\n');
}
