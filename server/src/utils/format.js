const IST_OFFSET_MS = 330 * 60 * 1000;

/** Firestore Timestamp | Date | ISO string -> Date | null */
export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const toIso = (value) => toDate(value)?.toISOString() ?? null;

/** 'YYYY-MM-DD' interpreted as an Indian Standard Time calendar day. */
export function istDayStart(day) {
  return new Date(`${day}T00:00:00.000+05:30`);
}

export function istDayEnd(day) {
  return new Date(`${day}T23:59:59.999+05:30`);
}

/** Shift a UTC instant so that spreadsheet/PDF rendering shows IST wall-clock time. */
export function toIstWallClock(value) {
  const date = toDate(value);
  return date ? new Date(date.getTime() + IST_OFFSET_MS) : null;
}

export function formatIstDateTime(value) {
  const date = toDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export const paiseToRupees = (paise) => Math.round(paise) / 100;

/** PDF standard fonts lack the ₹ glyph, so PDFs use "INR". */
export function formatInr(paise, { symbol = '₹' } = {}) {
  const amount = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    paiseToRupees(paise),
  );
  return symbol === 'INR' ? `INR ${amount}` : `${symbol}${amount}`;
}

/** Accepts 9876543210, +91 98765 43210, 091-9876543210 … returns 10 digits or null. */
export function normalizeIndianMobile(input) {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function maskMobile(mobile) {
  return mobile ? `${mobile.slice(0, 2)}******${mobile.slice(-2)}` : '';
}
