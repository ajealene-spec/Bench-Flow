/**
 * Turns the value of a <input type="datetime-local"> ("2026-11-02T09:30") into a timestamp for plannedStart.
 * Returns undefined for an empty or unreadable value, so the run is simply not scheduled.
 */
export function parseScheduleStart(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  // datetime-local has no time zone, so it is read as local time. Date-only input gets 09:00 by default.
  const withTime = /T\d{2}:\d{2}/.test(trimmed) ? trimmed : `${trimmed}T09:00`;
  const time = new Date(withTime).getTime();
  return Number.isFinite(time) ? time : undefined;
}

/** Formats a timestamp as the value a datetime-local input expects. */
export function toScheduleInputValue(timestamp: number): string {
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
