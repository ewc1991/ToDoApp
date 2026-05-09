export const HOUR_HEIGHT = 64; // px per hour

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

export const getNearestHalfHour = () => {
  const now = new Date();
  const m = now.getMinutes();
  const h = now.getHours();
  if (m < 30) return minutesToTime(h * 60 + 30);
  return minutesToTime((h + 1) * 60);
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
      if (timeToMinutes(last.endTime) <= bStart) {
        columns[i].push(block);
        placed = true;
        break;
      }
    }
    if (!placed) columns.push([block]);
  });

  return sorted.map(block => {
    const bStart = timeToMinutes(block.startTime);
    const bEnd = timeToMinutes(block.endTime);
    let colIdx = 0;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].includes(block)) { colIdx = i; break; }
    }
    const concurrentCols = columns.filter(col =>
      col.some(b => timeToMinutes(b.startTime) < bEnd && timeToMinutes(b.endTime) > bStart)
    ).length;
    return { ...block, colIdx, numCols: concurrentCols };
  });
};
