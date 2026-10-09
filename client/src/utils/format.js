const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function formatINR(paise, { whole = false } = {}) {
  if (paise == null) return '-';
  const rupees = paise / 100;
  return whole || Number.isInteger(rupees) ? inrWhole.format(rupees) : inr.format(rupees);
}

const dateTime = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : dateTime.format(date);
}

export const categoryLabel = (category) => (category === 'couple' ? 'Couple' : category === 'single' ? 'Single' : '-');

export function competitionsLabel({ rangoliSelected, drawingSelected }) {
  return [rangoliSelected && 'Rangoli', drawingSelected && 'Drawing'].filter(Boolean).join(' & ') || 'None';
}

/** Mirrors the server's Indian mobile validation for instant feedback. */
export function normalizeIndianMobile(input = '') {
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
