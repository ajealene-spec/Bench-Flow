import { describe, expect, it } from 'vitest';
import { formatTick, linearScale, niceTicks } from './scale';

describe('linearScale', () => {
  it('maps the domain ends onto the range ends, including inverted ranges', () => {
    const y = linearScale([0, 10], [200, 20]);
    expect(y(0)).toBe(200);
    expect(y(10)).toBe(20);
    expect(y(5)).toBe(110);
  });

  it('puts a zero-width domain in the middle', () => {
    expect(linearScale([3, 3], [0, 100])(3)).toBe(50);
  });
});

describe('niceTicks', () => {
  it('rounds the domain outward to a readable step', () => {
    const { domain, ticks } = niceTicks(3.2, 17.8, 5);
    expect(domain[0]).toBeLessThanOrEqual(3.2);
    expect(domain[1]).toBeGreaterThanOrEqual(17.8);
    expect(ticks[0]).toBe(domain[0]);
    expect(ticks[ticks.length - 1]).toBe(domain[1]);
    const step = ticks[1] - ticks[0];
    expect([1, 2, 5, 10, 20, 50]).toContain(Number(step.toFixed(6)));
  });

  it('widens a flat series so the scale is not degenerate', () => {
    const { domain } = niceTicks(5, 5);
    expect(domain[0]).toBeLessThan(5);
    expect(domain[1]).toBeGreaterThan(5);
  });

  it('falls back for non-finite input', () => {
    expect(niceTicks(Number.NaN, 1)).toEqual({ domain: [0, 1], ticks: [0, 1] });
  });
});

describe('formatTick', () => {
  it('keeps integers and trims long decimals', () => {
    expect(formatTick(10)).toBe('10');
    expect(formatTick(0.123456)).toBe('0.123');
  });
});
