import { describe, expect, it } from 'vitest';
import type { Task } from '../../types';
import { occurrenceDates, expandTaskOccurrences } from './recurrence';

function task(over: Partial<Task> = {}): Task {
  return { id: 't1', title: 'Feed mice', date: '2026-10-05', done: false, createdAt: 0, ...over };
}

describe('occurrenceDates', () => {
  it('a one-off task falls only on its own day inside the range', () => {
    expect(occurrenceDates(task(), '2026-10-01', '2026-10-31')).toEqual(['2026-10-05']);
    expect(occurrenceDates(task(), '2026-10-06', '2026-10-31')).toEqual([]);
  });

  it('daily repeats every day from the task date, clipped to the range', () => {
    const t = task({ recurrence: 'daily' });
    expect(occurrenceDates(t, '2026-10-03', '2026-10-07')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ]);
  });

  it('weekly repeats on the same weekday as the task date', () => {
    // 2026-10-05 is a Monday.
    const t = task({ recurrence: 'weekly' });
    expect(occurrenceDates(t, '2026-10-01', '2026-10-31')).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
  });

  it('weekly from a range that starts mid-cycle lands on the next matching weekday', () => {
    const t = task({ recurrence: 'weekly' });
    expect(occurrenceDates(t, '2026-10-06', '2026-10-13')).toEqual(['2026-10-12']);
  });

  it('a repeating task never produces days before its own date', () => {
    const t = task({ recurrence: 'daily', date: '2026-10-20' });
    expect(occurrenceDates(t, '2026-10-01', '2026-10-21')).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('returns nothing when the range ends before the task starts', () => {
    expect(occurrenceDates(task({ recurrence: 'daily' }), '2026-09-01', '2026-10-04')).toEqual([]);
  });
});

describe('expandTaskOccurrences', () => {
  it('orders by date, then timed tasks first by time', () => {
    const tasks = [
      task({ id: 'a', title: 'Untimed', date: '2026-10-05' }),
      task({ id: 'b', title: 'Late', date: '2026-10-05', time: '15:00' }),
      task({ id: 'c', title: 'Early', date: '2026-10-05', time: '08:30' }),
    ];
    expect(expandTaskOccurrences(tasks, '2026-10-05', '2026-10-05').map((o) => o.task.id)).toEqual(['c', 'b', 'a']);
  });

  it('gives each repeat a key that includes the date and flags it as recurring', () => {
    const [first] = expandTaskOccurrences([task({ recurrence: 'daily' })], '2026-10-05', '2026-10-06');
    expect(first.key).toBe('t1@2026-10-05');
    expect(first.recurring).toBe(true);
  });
});
