export const HOUR_HEIGHT = 64; // px per hour

// Last minute a block may end on. 1440 would be the true end of day, but it
// formats as "00:00" and reads back as zero, which puts the end before the
// start and makes the block vanish.
export const LAST_MINUTE = 1439;

export const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

export const minutesToTime = (minutes) => {
  const h = Math.floor(((minutes % 1440) + 1440) % 1440 / 60);
  const m = ((minutes % 60) + 60) % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};

export const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`;
};

export const formatHour = (hour) => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
};

// Label for a slot given minutes from midnight — always shows :00 or :30
export const formatSlot = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
};

// End time N minutes after a start, never spilling past the end of the day.
export const endAfter = (startTime, mins = 30) =>
  minutesToTime(Math.min(LAST_MINUTE, timeToMinutes(startTime) + mins));

// A block whose end is at or before its start ran to the end of the day. Older
// records hold "00:00" from when the resize handle could clamp to 1440, so read
// them as end-of-day rather than letting them disappear.
export const blockEndMinutes = (block) => {
  const start = timeToMinutes(block.startTime);
  const end = timeToMinutes(block.endTime);
  return end <= start ? 1440 : end;
};

export const getNearestHalfHour = () => {
  const now = new Date();
  const m = now.getMinutes();
  const h = now.getHours();
  // Late enough that rounding up would land on tomorrow — hold at the last slot.
  const next = m < 30 ? h * 60 + 30 : (h + 1) * 60;
  return minutesToTime(Math.min(23 * 60 + 30, next));
};

export const layoutBlocks = (blocks) => {
  if (!blocks.length) return [];

  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  const columns = []; // each column = array of blocks placed there

  sorted.forEach(block => {
    const bStart = timeToMinutes(block.startTime);
    let placed = false;
    for (let i = 0; i < columns.length; i++) {
      const last = columns[i][columns[i].length - 1];
      if (blockEndMinutes(last) <= bStart) {
        columns[i].push(block);
        placed = true;
        break;
      }
    }
    if (!placed) columns.push([block]);
  });

  return sorted.map(block => {
    const bStart = timeToMinutes(block.startTime);
    const bEnd = blockEndMinutes(block);
    let colIdx = 0;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].includes(block)) { colIdx = i; break; }
    }
    const concurrentCols = columns.filter(col =>
      col.some(b => timeToMinutes(b.startTime) < bEnd && blockEndMinutes(b) > bStart)
    ).length;
    return { ...block, colIdx, numCols: concurrentCols };
  });
};
