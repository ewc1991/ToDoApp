export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];
export const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const DAY_NAMES_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export const formatDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export const today = () => formatDate(new Date());

export const makeDateStr = (year, month1based, day) =>
  `${year}-${String(month1based).padStart(2,'0')}-${String(day).padStart(2,'0')}`;

export const parseDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
export const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

export const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};

export const formatShortDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const isToday = (dateStr) => dateStr === today();

export const getDayOfWeek = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

export const getDayOfMonth = (dateStr) => Number(dateStr.split('-')[2]);
