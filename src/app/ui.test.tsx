import { describe, expect, it } from 'vitest';
import { ringOffset } from './ui';

describe('ringOffset', () => {
  const r = 10;
  const circumference = 2 * Math.PI * r;

  it('is the full circumference at 0 percent and zero at 100 percent', () => {
    expect(ringOffset(0, r)).toBeCloseTo(circumference);
    expect(ringOffset(100, r)).toBeCloseTo(0);
  });

  it('is half the circumference at 50 percent', () => {
    expect(ringOffset(50, r)).toBeCloseTo(circumference / 2);
  });

  it('clamps out-of-range and non-numeric values', () => {
    expect(ringOffset(150, r)).toBeCloseTo(0);
    expect(ringOffset(-20, r)).toBeCloseTo(circumference);
    expect(ringOffset(Number.NaN, r)).toBeCloseTo(circumference);
  });
});
