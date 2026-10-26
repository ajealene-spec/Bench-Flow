import type { Task } from '../../types';
import { addDays, dayDiff } from './dates';

/** One task as it appears on one day. Recurring tasks produce one occurrence per repeat. */
export interface TaskOccurrence {
  /** Stable per day: the task id plus the date. */
  key: string;
  task: Task;
  date: string;
  recurring: boolean;
}

/**
 * Days (inclusive range start..end) on which a task falls. A task with no repeat falls only on its
 * own day. Daily repeats every day from the task's date; weekly repeats on the same weekday.
 */
export function occurrenceDates(task: Task, start: string, end: string): string[] {
  const repeat = task.recurrence ?? 'none';
  const offsetEnd = dayDiff(task.date, end);
  if (offsetEnd < 0) return [];

  if (repeat === 'none') {
    const own = task.date;
    return own >= start && own <= end ? [own] : [];
  }

  const step = repeat === 'weekly' ? 7 : 1;
  const fromOffset = Math.max(0, dayDiff(task.date, start));
  const first = Math.ceil(fromOffset / step) * step;
  const dates: string[] = [];
  for (let k = first; k <= offsetEnd; k += step) {
    dates.push(addDays(task.date, k));
  }
  return dates;
}

/** Expands tasks into the occurrences that fall in start..end (inclusive day keys), in date order. */
export function expandTaskOccurrences(tasks: Task[], start: string, end: string): TaskOccurrence[] {
  const out: TaskOccurrence[] = [];
  for (const task of tasks) {
    const recurring = (task.recurrence ?? 'none') !== 'none';
    for (const date of occurrenceDates(task, start, end)) {
      out.push({ key: `${task.id}@${date}`, task, date, recurring });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || compareTaskTime(a.task, b.task));
}

function compareTaskTime(a: Task, b: Task): number {
  if (a.time && b.time) return a.time.localeCompare(b.time) || a.title.localeCompare(b.title);
  if (a.time) return -1;
  if (b.time) return 1;
  return a.title.localeCompare(b.title);
}
