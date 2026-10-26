/** Locale-formatted date for dates shown in the UI, or a dash when the date is not set. */
export function formatDate(timestamp?: number): string {
  return timestamp === undefined ? '—' : new Date(timestamp).toLocaleDateString();
}
