// Small date helpers. All dates are ISO "YYYY-MM-DD" strings, handled in UTC
// so results don't shift with the server's time zone.

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parses "YYYY-MM-DD" (or a full ISO timestamp / Date) to UTC milliseconds.
export function toMs(d) {
  if (d == null || d === '') return NaN;
  if (d instanceof Date) return d.getTime();
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T00:00:00Z`);
  return Date.parse(s);
}

// Whole days from a to b (positive when b is later).
export function daysBetween(a, b) {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS);
}

// "YYYY-MM-DD" for a Date / ISO input.
export function isoDate(d) {
  return new Date(toMs(d)).toISOString().slice(0, 10);
}

// "12 Mar 2026"
export function formatDate(d) {
  const ms = toMs(d);
  if (Number.isNaN(ms)) return '';
  const dt = new Date(ms);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
}
