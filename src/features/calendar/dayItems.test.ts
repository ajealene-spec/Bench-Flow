import { describe, expect, it } from 'vitest';
import type { Task } from '../../types';
import { groupItemsByDay } from './dayItems';
import { expandTaskOccurrences } from './recurrence';

function task(id: string, over: Partial<Task> = {}): Task {
  return { id, title: id, date: '2026-10-05', done: false, createdAt: 0, ...over };
}

describe('groupItemsByDay', () => {
  it('puts untimed tasks first, then timed items by start time', () => {
    const tasks = expandTaskOccurrences(
      [task('late', { time: '15:00' }), task('free'), task('early', { time: '08:00' })],
      '2026-10-05',
      '2026-10-05',
    );
    const byDay = groupItemsByDay({ tasks, blocks: [] });
    const order = byDay.get('2026-10-05')?.map((i) => (i.kind === 'task' ? i.occurrence.task.id : i.key));
    expect(order).toEqual(['free', 'early', 'late']);
  });

  it('returns no entry for days with nothing planned', () => {
    const byDay = groupItemsByDay({ tasks: [], blocks: [] });
    expect(byDay.has('2026-10-05')).toBe(false);
  });
});
