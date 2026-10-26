/*
 * Time helpers for recorded data. Elapsed time is always wall-clock time between
 * a real start and stop, so pauses inside a run are included.
 */

/** Seconds between two wall-clock timestamps in ms. Never negative; rounded to 1 ms. */
export function elapsedSecBetween(startedAt: number, stoppedAt: number): number {
  return Math.max(0, Math.round(stoppedAt - startedAt)) / 1000;
}

/** h:mm:ss for an hour or more, otherwise m:ss. Seconds are rounded to the nearest whole second. */
export function formatElapsed(sec: number | undefined): string {
  if (sec === undefined || !Number.isFinite(sec)) return '';
  const total = Math.max(0, Math.round(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * Parses a manual "time taken" entry: m:ss, h:mm:ss, or mm:ss.s with fractions.
 * Returns undefined when the text is not a valid duration (seconds or minutes of 60 or more are rejected).
 */
export function parseDuration(text: string): number | undefined {
  const trimmed = text.trim();
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(trimmed) ?? /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(trimmed);
  if (!match) return undefined;
  if (match.length === 4) {
    const [, h, m, s] = match;
    if (Number(m) >= 60 || Number(s) >= 60) return undefined;
    return (h ? Number(h) * 3600 : 0) + Number(m) * 60 + Number(s);
  }
  const [, m, s] = match;
  if (Number(s) >= 60) return undefined;
  return Number(m) * 60 + Number(s);
}

/** Local date and time for CSV and table output, e.g. 2026-10-26 14:05:09. Empty when unset. */
export function formatTimestamp(ms: number | undefined): string {
  if (ms === undefined) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
