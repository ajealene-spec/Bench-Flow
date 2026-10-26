/**
 * Local-calendar helpers. Days are "yyyy-mm-dd" strings in the device's local time zone, so a task
 * saved on a day stays on that day. Pure: pass the time in.
 */

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MINUTES = 24 * 60;

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local "yyyy-mm-dd" for a timestamp. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a day key, as a timestamp. */
export function dayStartMs(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const next = new Date(y, m - 1, d + n);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

/** Whole calendar days from a to b (b - a). */
export function dayDiff(a: string, b: string): number {
  return Math.round((dayStartMs(b) - dayStartMs(a)) / (24 * HOUR_MS));
}

/** Sunday of the week containing the day. */
export function startOfWeek(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return addDays(key, -new Date(y, m - 1, d).getDay());
}

/** Six-week grid (42 days) that covers the month of the anchor day, starting on Sunday. */
export function monthGridDays(anchor: string): string[] {
  const [y, m] = anchor.split('-').map(Number);
  const first = `${y}-${pad(m)}-01`;
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function monthStart(anchor: string): string {
  return `${anchor.slice(0, 7)}-01`;
}

/** Inclusive list of day keys from start to end. */
export function daysBetween(start: string, end: string): string[] {
  const n = dayDiff(start, end);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(start, i));
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60) % 24;
  return `${pad(h)}:${pad(min % 60)}`;
}

/** "HH:mm" to minutes after midnight. Returns undefined for anything else. */
export function parseTime(hhmm: string | undefined): number | undefined {
  if (!hhmm) return undefined;
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return undefined;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return undefined;
  return h * 60 + m;
}

export function timestampAt(key: string, minutes: number): number {
  return dayStartMs(key) + minutes * MINUTE_MS;
}

export function formatDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
