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
