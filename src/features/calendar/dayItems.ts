import type { ExperimentBlock } from './experimentBlocks';
import type { TaskOccurrence } from './recurrence';
import type { CalendarItems } from './calendarData';

/** A row on one day: a general task or a run phase. Untimed tasks sort first. */
export type DayItem =
  | { kind: 'task'; key: string; sortMin: number; occurrence: TaskOccurrence }
  | { kind: 'block'; key: string; sortMin: number; block: ExperimentBlock };

const UNTIMED = -1;

function taskMinutes(occurrence: TaskOccurrence): number {
  const time = occurrence.task.time;
  if (!time) return UNTIMED;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** Groups calendar items by day key. Within a day: untimed tasks, then timed tasks and phases by start time. */
export function groupItemsByDay(items: CalendarItems): Map<string, DayItem[]> {
  const byDay = new Map<string, DayItem[]>();
  const push = (date: string, item: DayItem) => byDay.set(date, [...(byDay.get(date) ?? []), item]);

  for (const occurrence of items.tasks) {
    push(occurrence.date, { kind: 'task', key: occurrence.key, sortMin: taskMinutes(occurrence), occurrence });
  }
  for (const block of items.blocks) {
    push(block.date, { kind: 'block', key: block.id, sortMin: block.startMin, block });
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.sortMin - b.sortMin || a.key.localeCompare(b.key));
  }
  return byDay;
}
