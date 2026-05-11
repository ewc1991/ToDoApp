function matchesWeekOccurrence(date, occurrence) {
  if (occurrence === -1) {
    const next = new Date(date); next.setDate(date.getDate() + 7);
    return next.getMonth() !== date.getMonth();
  }
  return Math.ceil(date.getDate() / 7) === occurrence;
}

export const shouldRecurOnDate = (template, dateStr) => {
  if (template.startDate && dateStr < template.startDate) return false;
  if (template.endDate   && dateStr > template.endDate)   return false;

  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow  = date.getDay(); // 0=Sun

  switch (template.recurrenceType) {
    case 'daily':    return true;
    case 'weekdays': return dow >= 1 && dow <= 5;
    case 'weekends': return dow === 0 || dow === 6;
    case 'weekly':   return dow === (template.dayOfWeek ?? 0);
    case 'biweekly': {
      if (dow !== (template.dayOfWeek ?? 0)) return false;
      if (!template.startDate) return true;
      const [sy, sm, sd] = template.startDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd);
      const diffDays  = Math.round((date - start) / 86400000);
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks % 2 === 0 && diffDays >= 0;
    }
    case 'monthly': {
      const mode = template.monthlyMode || 'dayOfMonth';
      if (mode === 'dayOfMonth') return d === (template.dayOfMonth ?? 1);
      if (dow !== (template.dayOfWeek ?? 0)) return false;
      return matchesWeekOccurrence(date, template.monthlyWeekOccurrence ?? 1);
    }
    case 'custom': {
      const interval = template.customInterval ?? 1;
      const unit     = template.customUnit ?? 'weeks';
      if (unit === 'weeks') {
        if (dow !== (template.dayOfWeek ?? 0)) return false;
        if (!template.startDate || interval <= 1) return true;
        const [sy, sm, sd] = template.startDate.split('-').map(Number);
        const start     = new Date(sy, sm - 1, sd);
        const diffDays  = Math.round((date - start) / 86400000);
        if (diffDays < 0) return false;
        return Math.floor(diffDays / 7) % interval === 0;
      } else { // months
        let monthMatches;
        if (!template.startDate || interval <= 1) {
          monthMatches = true;
        } else {
          const [sy, sm] = template.startDate.split('-').map(Number);
          const mDiff    = (y - sy) * 12 + (m - sm);
          monthMatches   = mDiff >= 0 && mDiff % interval === 0;
        }
        if (!monthMatches) return false;
        const mode = template.monthlyMode || 'dayOfMonth';
        if (mode === 'dayOfMonth') return d === (template.dayOfMonth ?? 1);
        if (dow !== (template.dayOfWeek ?? 0)) return false;
        return matchesWeekOccurrence(date, template.monthlyWeekOccurrence ?? 1);
      }
    }
    default: return false;
  }
};
