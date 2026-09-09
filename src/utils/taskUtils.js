// Pair each still-existing dragged id with the position it should occupy.
//
// Reordering only rewrites the sortIndex values already occupied by the dragged
// set, so tasks outside it keep theirs without collisions. Ids that vanished
// mid-drag — deleted on another device, or rolled over at midnight — are dropped
// first: zipping the full id list against the filtered position list left the
// tail paired with undefined, which Firestore rejects by throwing.
export const reorderPlan = (tasks, orderedIds = []) => {
  const positionById = new Map(tasks.map((t, i) => [t.id, i]));
  const ids = orderedIds.filter(id => positionById.has(id));
  const positions = ids.map(id => positionById.get(id)).sort((a, b) => a - b);
  return ids.map((id, i) => ({ id, sortIndex: positions[i] }));
};

// Ids of duplicate recurring instances — the same template materialised more
// than once for the same date. Two generation triggers could fire in one commit
// and both read the same pre-update snapshot, so each wrote a full set of docs.
//
// Keeps the instance carrying the most history and returns the rest for
// deletion: one promoted to a time block first (deleting it would orphan the
// block), then a completed one, then the oldest.
export const duplicateRecurringIds = (tasks, linkedTaskIds = new Set()) => {
  const groups = new Map();
  for (const t of tasks) {
    if (!t.recurringTemplateId || !t.assignedDate) continue;
    const key = `${t.recurringTemplateId}|${t.assignedDate}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const score = (t) => (linkedTaskIds.has(t.id) ? 2 : 0) + (t.completed ? 1 : 0);

  const doomed = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ranked = [...group].sort((a, b) => {
      const byScore = score(b) - score(a);
      if (byScore !== 0) return byScore;
      const byAge = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
      if (byAge !== 0) return byAge;
      return String(a.id).localeCompare(String(b.id));
    });
    doomed.push(...ranked.slice(1).map(t => t.id));
  }
  return doomed;
};

// A task is either flagged 'high' or carries no priority at all. Stored as a
// string rather than a boolean so a second tier could be added without a
// migration of every existing doc.
export const isHighPriority = (task) => task?.priority === 'high';

// High-priority tasks float to the top of whichever group they are shown in.
// Sort is stable, so everything else keeps the order it arrived in — the
// caller's own sortIndex, createdAt or date ordering survives untouched.
export const byPriority = (tasks) =>
  [...tasks].sort((a, b) => (isHighPriority(b) ? 1 : 0) - (isHighPriority(a) ? 1 : 0));
