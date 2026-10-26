import { describe, expect, it } from 'vitest';
import { addDays, postOpChecklist, startOfDay } from './postOp';

// Surgery at 10:00 on 1 Oct 2026. Day N is due from local midnight of 1 Oct + N days.
const surgeryAt = new Date(2026, 9, 1, 10, 0).getTime();
const at = (day: number, hour = 9) => new Date(2026, 9, 1 + day, hour).getTime();

function statusOf(list: ReturnType<typeof postOpChecklist>, day: number) {
  return list.find((item) => item.day === day)?.status;
}

describe('postOpChecklist', () => {
  it('schedules days 0, 1, 2, 3 and 7', () => {
    const list = postOpChecklist(surgeryAt, [], surgeryAt);
    expect(list.map((item) => item.day)).toEqual([0, 1, 2, 3, 7]);
  });

  it('marks the surgery day due straight away and later days upcoming', () => {
    const list = postOpChecklist(surgeryAt, [], surgeryAt);
    expect(statusOf(list, 0)).toBe('due');
    expect(statusOf(list, 1)).toBe('upcoming');
    expect(statusOf(list, 7)).toBe('upcoming');
  });

  it('becomes overdue only after the due day has ended without a check', () => {
    const endOfDay1 = addDays(surgeryAt, 2) - 1;
    expect(statusOf(postOpChecklist(surgeryAt, [], at(1, 23)), 1)).toBe('due');
    expect(statusOf(postOpChecklist(surgeryAt, [], endOfDay1 + 1), 1)).toBe('overdue');
  });

  it('marks a day done when a check for that day is recorded, and keeps the first time', () => {
    const checks = [
      { day: 2, at: at(2, 14) },
      { day: 2, at: at(2, 9) },
    ];
    const list = postOpChecklist(surgeryAt, checks, at(9));
    const day2 = list.find((item) => item.day === 2);
    expect(day2?.status).toBe('done');
    expect(day2?.completedAt).toBe(at(2, 9));
  });

  it('does not let a check for one day complete another', () => {
    const list = postOpChecklist(surgeryAt, [{ day: 3, at: at(3) }], at(4));
    expect(statusOf(list, 3)).toBe('done');
    expect(statusOf(list, 2)).toBe('overdue');
  });

  it('uses calendar days, not 24-hour blocks, for the due dates', () => {
    expect(startOfDay(surgeryAt)).toBe(new Date(2026, 9, 1).getTime());
    expect(addDays(surgeryAt, 7)).toBe(new Date(2026, 9, 8).getTime());
  });
});
