import type { Task } from '../../types';
import { addDays, pad } from './dates';
import type { ExperimentBlock } from './experimentBlocks';

const PRODID = '-//Bench Flow//Calendar//EN';
const DEFAULT_TASK_MIN = 30;

export interface IcsInput {
  tasks: Task[];
  blocks: ExperimentBlock[];
  /** Used for DTSTAMP. */
  now: number;
  calendarName?: string;
}

/**
 * An iCalendar (RFC 5545) file of general tasks and experiment phases, for Apple or Google Calendar
 * import. Times are floating (local), so they show at the same clock time on the importing device.
 * Recurring tasks become one event with an RRULE.
 */
export function buildIcs(input: IcsInput): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(input.calendarName ?? 'Bench Flow')}`,
  ];
  const stamp = utcStamp(input.now);

  for (const task of input.tasks) {
    lines.push(...taskEvent(task, stamp));
  }
  for (const block of input.blocks) {
    lines.push(...blockEvent(block, stamp));
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

function taskEvent(task: Task, stamp: string): string[] {
  const recurrence = task.recurrence ?? 'none';
  const lines = ['BEGIN:VEVENT', `UID:task-${task.id}@bench-flow`, `DTSTAMP:${stamp}`];
  const summary = task.done ? `Done: ${task.title}` : task.title;
  lines.push(`SUMMARY:${escapeText(summary)}`);

  if (task.time) {
    const [h, m] = task.time.split(':').map(Number);
    const startMin = h * 60 + m;
    const duration = task.durationMin && task.durationMin > 0 ? task.durationMin : DEFAULT_TASK_MIN;
    lines.push(`DTSTART:${dateTime(task.date, startMin)}`);
    lines.push(`DTEND:${dateTime(task.date, startMin + duration)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateOnly(task.date)}`);
    lines.push(`DTEND;VALUE=DATE:${dateOnly(addDays(task.date, 1))}`);
  }
  if (recurrence !== 'none') {
    lines.push(`RRULE:FREQ=${recurrence === 'weekly' ? 'WEEKLY' : 'DAILY'}`);
  }
  if (task.notes) lines.push(`DESCRIPTION:${escapeText(task.notes)}`);
  lines.push('END:VEVENT');
  return lines;
}

function blockEvent(block: ExperimentBlock, stamp: string): string[] {
  const endDate = block.endMin >= 24 * 60 ? addDays(block.date, 1) : block.date;
  const endMin = block.endMin >= 24 * 60 ? 0 : block.endMin;
  return [
    'BEGIN:VEVENT',
    `UID:phase-${block.id.replace(/[^A-Za-z0-9-]/g, '-')}@bench-flow`,
    `DTSTAMP:${stamp}`,
    `SUMMARY:${escapeText(block.label)}`,
    `DTSTART:${dateTime(block.date, block.startMin)}`,
    `DTEND:${dateTime(endDate, endMin)}`,
    `CATEGORIES:${escapeText(block.experimentName)}`,
    `DESCRIPTION:${escapeText(`Bench Flow run. Status: ${block.status}.`)}`,
    'END:VEVENT',
  ];
}

/** Escapes a TEXT value per RFC 5545 section 3.3.11. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Folds a content line at 75 octets, continuing with a leading space. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function dateOnly(key: string): string {
  return key.replace(/-/g, '');
}

/** Floating local date-time. Minutes may reach 1440 (midnight of the next day) and roll over. */
function dateTime(key: string, minutes: number): string {
  const dayOffset = Math.floor(minutes / (24 * 60));
  const day = dayOffset ? addDays(key, dayOffset) : key;
  const withinDay = minutes - dayOffset * 24 * 60;
  return `${dateOnly(day)}T${pad(Math.floor(withinDay / 60))}${pad(withinDay % 60)}00`;
}

function utcStamp(ms: number): string {
  const d = new Date(ms);
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}
