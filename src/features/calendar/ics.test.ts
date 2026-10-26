import { describe, expect, it } from 'vitest';
import type { Task } from '../../types';
import { buildIcs, escapeText, foldLine } from './ics';
import type { ExperimentBlock } from './experimentBlocks';

const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);

function task(over: Partial<Task> = {}): Task {
  return { id: 't1', title: 'Feed mice', date: '2026-10-05', done: false, createdAt: 0, ...over };
}

function block(over: Partial<ExperimentBlock> = {}): ExperimentBlock {
  return {
    id: 'exp-1:ab:2026-10-05',
    experimentId: 'exp-1',
    experimentName: 'Run 1',
    phaseId: 'ab',
    phaseName: 'Antibody',
    date: '2026-10-05',
    dayNumber: 1,
    startMin: 1020,
    endMin: 1440,
    label: 'Western Blot — Day 1: Antibody',
    status: 'upcoming',
    colorIndex: 0,
    moveHandle: false,
    ...over,
  };
}

function unfold(ics: string): string {
  return ics.replace(/\r\n /g, '');
}

describe('buildIcs', () => {
  it('wraps events in a CRLF calendar with a stamp and no bare LF', () => {
    const ics = buildIcs({ tasks: [], blocks: [], now: NOW });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('writes a timed task as a floating local start and end with the default 30 minutes', () => {
    const ics = unfold(buildIcs({ tasks: [task({ time: '09:15' })], blocks: [], now: NOW }));
    expect(ics).toContain('UID:task-t1@bench-flow');
    expect(ics).toContain('DTSTART:20261005T091500\r\n');
    expect(ics).toContain('DTEND:20261005T094500\r\n');
    expect(ics).toContain('DTSTAMP:20261026T120000Z');
  });

  it('uses the task duration when given', () => {
    const ics = unfold(buildIcs({ tasks: [task({ time: '09:00', durationMin: 90 })], blocks: [], now: NOW }));
    expect(ics).toContain('DTEND:20261005T103000');
  });

  it('writes an untimed task as an all-day event that ends the next day', () => {
    const ics = unfold(buildIcs({ tasks: [task()], blocks: [], now: NOW }));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261005');
    expect(ics).toContain('DTEND;VALUE=DATE:20261006');
  });

  it('adds an RRULE for daily and weekly repeats', () => {
    const daily = unfold(buildIcs({ tasks: [task({ recurrence: 'daily' })], blocks: [], now: NOW }));
    const weekly = unfold(buildIcs({ tasks: [task({ recurrence: 'weekly' })], blocks: [], now: NOW }));
    expect(daily).toContain('RRULE:FREQ=DAILY');
    expect(weekly).toContain('RRULE:FREQ=WEEKLY');
    const once = unfold(buildIcs({ tasks: [task({ recurrence: 'none' })], blocks: [], now: NOW }));
    expect(once).not.toContain('RRULE');
  });

  it('marks a done task in its summary', () => {
    const ics = unfold(buildIcs({ tasks: [task({ done: true })], blocks: [], now: NOW }));
    expect(ics).toContain('SUMMARY:Done: Feed mice');
  });

  it('writes a phase block with its label, times and experiment category', () => {
    const ics = unfold(buildIcs({ tasks: [], blocks: [block()], now: NOW }));
    expect(ics).toContain('SUMMARY:Western Blot — Day 1: Antibody');
    expect(ics).toContain('DTSTART:20261005T170000');
    expect(ics).toContain('CATEGORIES:Run 1');
    expect(ics).toContain('UID:phase-exp-1-ab-2026-10-05@bench-flow');
  });

  it('rolls a block that ends at 24:00 over to midnight of the next day', () => {
    const ics = unfold(buildIcs({ tasks: [], blocks: [block({ startMin: 1020, endMin: 1440 })], now: NOW }));
    expect(ics).toContain('DTEND:20261006T000000');
  });

  it('escapes commas, semicolons and newlines in text', () => {
    const ics = unfold(buildIcs({ tasks: [task({ title: 'Buy A, B; C', notes: 'line one\nline two' })], blocks: [], now: NOW }));
    expect(ics).toContain('SUMMARY:Buy A\\, B\; C');
    expect(ics).toContain('DESCRIPTION:line one\\nline two');
  });
});

describe('escapeText and foldLine', () => {
  it('escapes backslashes first so they are not doubled', () => {
    expect(escapeText('a\\b,c')).toBe('a\\\\b\\,c');
  });

  it('folds long lines at 75 octets with a leading space on continuations', () => {
    const folded = foldLine('SUMMARY:' + 'x'.repeat(200));
    const physical = folded.split('\r\n');
    expect(physical[0].length).toBe(75);
    expect(physical.slice(1).every((l) => l.startsWith(' ') && l.length <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'x'.repeat(200));
  });

  it('never splits a multi-byte character across lines', () => {
    const folded = foldLine('SUMMARY:' + 'é'.repeat(80));
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + 'é'.repeat(80));
    for (const part of folded.split('\r\n')) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
  });
});
