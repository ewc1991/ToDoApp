export const shouldRecurOnDate = (template, dateStr) => {
  if (template.startDate && dateStr < template.startDate) return false;
  if (template.endDate && dateStr > template.endDate) return false;

  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay(); // 0=Sun

  switch (template.recurrenceType) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekends':
      return dow === 0 || dow === 6;
    case 'weekly':
      return dow === (template.dayOfWeek ?? 0);
    case 'biweekly': {
      if (dow !== (template.dayOfWeek ?? 0)) return false;
      if (!template.startDate) return true;
      const [sy, sm, sd] = template.startDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd);
      const diffDays = Math.round((date - start) / 86400000);
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks % 2 === 0 && diffDays >= 0;
    }
    case 'monthly':
      return d === (template.dayOfMonth ?? 1);
    default:
      return false;
  }
};
