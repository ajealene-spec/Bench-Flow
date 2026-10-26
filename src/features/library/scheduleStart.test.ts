import { describe, expect, it } from 'vitest';
import { parseScheduleStart, toScheduleInputValue } from './scheduleStart';

describe('parseScheduleStart', () => {
  it('returns undefined for an empty value', () => {
    expect(parseScheduleStart('')).toBeUndefined();
    expect(parseScheduleStart('   ')).toBeUndefined();
  });

  it('reads a date and time as local time', () => {
    const ts = parseScheduleStart('2026-11-02T09:30');
    expect(ts).toBe(new Date(2026, 10, 2, 9, 30).getTime());
  });

  it('defaults a date-only value to 09:00', () => {
    expect(parseScheduleStart('2026-11-02')).toBe(new Date(2026, 10, 2, 9, 0).getTime());
  });

  it('rejects text that is not a date', () => {
    expect(parseScheduleStart('next tuesday')).toBeUndefined();
  });

  it('round-trips through the input format', () => {
    const ts = new Date(2026, 0, 15, 14, 5).getTime();
    expect(parseScheduleStart(toScheduleInputValue(ts))).toBe(ts);
  });
});
