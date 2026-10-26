/** Post-operative monitoring schedule. Day 0 is the surgery day; checks are due on each day from the surgery onward. */

export const POST_OP_DAYS = [0, 1, 2, 3, 7] as const;

export interface PostOpCheck {
  /** Day offset the check was done for (0, 1, 2, 3 or 7). */
  day: number;
  /** Wall-clock ms when the check was recorded. */
  at: number;
}

export type PostOpStatus = 'upcoming' | 'due' | 'overdue' | 'done';

export interface PostOpItem {
  day: number;
  label: string;
  /** Start of the due day, in wall-clock ms. */
  dueAt: number;
  status: PostOpStatus;
  completedAt?: number;
}

export const POST_OP_STATUS_LABEL: Record<PostOpStatus, string> = {
  upcoming: 'Upcoming',
  due: 'Due',
  overdue: 'Overdue',
  done: 'Done',
};

const LABELS: Record<number, string> = {
  0: 'Surgery day: wound, breathing, temperature',
  1: 'Day 1: wound, weight, pain score',
  2: 'Day 2: wound, weight, pain score',
  3: 'Day 3: wound, weight, pain score',
  7: 'Day 7: wound healed, weight, suture removal',
};

/** Local midnight on the day of `ts`. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local midnight `days` calendar days after the day of `ts`. */
export function addDays(ts: number, days: number): number {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/**
 * The checklist for one surgery. A day is done when a check for that day exists. It is overdue once the
 * day has ended without a check, and due during the day itself.
 */
export function postOpChecklist(surgeryAt: number, checks: PostOpCheck[], now: number): PostOpItem[] {
  return POST_OP_DAYS.map((day) => {
    const dueAt = addDays(surgeryAt, day);
    const endsAt = addDays(surgeryAt, day + 1);
    const completed = checks
      .filter((c) => c.day === day)
      .map((c) => c.at)
      .sort((a, b) => a - b)[0];
    const label = LABELS[day];
    if (completed !== undefined) return { day, label, dueAt, status: 'done', completedAt: completed };
    if (now >= endsAt) return { day, label, dueAt, status: 'overdue' };
    if (now >= dueAt) return { day, label, dueAt, status: 'due' };
    return { day, label, dueAt, status: 'upcoming' };
  });
}
