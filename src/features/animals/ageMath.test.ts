import { describe, expect, it } from 'vitest';
import { computeAge, formatAge, parseIsoDate } from './ageMath';

describe('computeAge', () => {
  const today = new Date(2026, 9, 26, 15, 30); // 26 Oct 2026, afternoon

  it('counts whole weeks and remaining days from the date of birth', () => {
    // 2026-10-26 minus 23 days is 2026-10-03: 3 weeks and 2 days.
    expect(computeAge('2026-10-03', today)).toEqual({ totalDays: 23, weeks: 3, days: 2 });
  });

  it('gives zero for an animal born today', () => {
    expect(computeAge('2026-10-26', today)).toEqual({ totalDays: 0, weeks: 0, days: 0 });
  });

  it('ignores the time of day on the date of birth and today', () => {
    expect(computeAge('2026-10-25', new Date(2026, 9, 26, 0, 1))?.totalDays).toBe(1);
    expect(computeAge('2026-10-25', new Date(2026, 9, 26, 23, 59))?.totalDays).toBe(1);
  });

  it('is exact across a daylight-saving change', () => {
    // US clocks change on 2026-03-08, so the gap is 24 calendar days regardless of hours.
    expect(computeAge('2026-02-12', new Date(2026, 2, 8, 12))?.totalDays).toBe(24);
  });

  it('returns undefined for a future date of birth', () => {
    expect(computeAge('2026-10-27', today)).toBeUndefined();
  });

  it('returns undefined for malformed or impossible dates', () => {
    expect(computeAge('26/10/2026', today)).toBeUndefined();
    expect(computeAge('2026-02-30', today)).toBeUndefined();
    expect(computeAge('', today)).toBeUndefined();
  });
});

describe('parseIsoDate and formatAge', () => {
  it('parses only real YYYY-MM-DD dates', () => {
    expect(parseIsoDate('2024-02-29')).toBeDefined();
    expect(parseIsoDate('2023-02-29')).toBeUndefined();
  });

  it('formats weeks and days, or Unknown', () => {
    expect(formatAge('2026-10-03', new Date(2026, 9, 26))).toBe('3 wk 2 d');
    expect(formatAge('nope', new Date(2026, 9, 26))).toBe('Unknown');
  });
});
