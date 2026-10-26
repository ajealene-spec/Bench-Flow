/** Age of an animal from its date of birth. Calendar days, so daylight-saving changes do not shift the count. */

const DAY_MS = 86_400_000;

export interface AgeParts {
  totalDays: number;
  weeks: number;
  days: number;
}

/** Parses a YYYY-MM-DD date as a local calendar date. Returns undefined for anything that is not a real date. */
export function parseIsoDate(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return date;
}

/** Age in whole weeks and remaining days. Undefined when the date of birth is invalid or in the future. */
export function computeAge(dob: string, today: Date = new Date()): AgeParts | undefined {
  const born = parseIsoDate(dob);
  if (!born) return undefined;
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const totalDays = Math.round((todayStart.getTime() - born.getTime()) / DAY_MS);
  if (totalDays < 0) return undefined;
  return { totalDays, weeks: Math.floor(totalDays / 7), days: totalDays % 7 };
}

/** Short label such as "3 wk 2 d". Returns "Unknown" when the age cannot be computed. */
export function formatAge(dob: string, today: Date = new Date()): string {
  const age = computeAge(dob, today);
  if (!age) return 'Unknown';
  return `${age.weeks} wk ${age.days} d`;
}
