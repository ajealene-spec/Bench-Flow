import { describe, expect, it } from 'vitest';
import { timerDeviation, TIMER_TOLERANCE } from './deviation';

describe('timerDeviation', () => {
  it('uses a 10% tolerance by default', () => {
    expect(TIMER_TOLERANCE).toBe(0.1);
  });

  it('returns nothing when the actual time is within 10% of plan', () => {
    expect(timerDeviation(600, 600)).toBeUndefined();
    expect(timerDeviation(600, 630)).toBeUndefined(); // exactly 5% over
    expect(timerDeviation(600, 540)).toBeUndefined(); // exactly 10% under
  });

  it('flags a timer more than 10% off, with the signed difference', () => {
    expect(timerDeviation(600, 400)).toEqual({ kind: 'timer', delta: -200, tolerance: 0.1 });
    expect(timerDeviation(600, 700)).toEqual({ kind: 'timer', delta: 100, tolerance: 0.1 });
  });

  it('respects a custom tolerance', () => {
    expect(timerDeviation(100, 120, 0.25)).toBeUndefined();
    expect(timerDeviation(100, 130, 0.25)).toEqual({ kind: 'timer', delta: 30, tolerance: 0.25 });
  });

  it('has nothing to compare against when the plan is zero or missing', () => {
    expect(timerDeviation(0, 30)).toBeUndefined();
  });
});
