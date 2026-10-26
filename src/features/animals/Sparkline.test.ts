import { describe, expect, it } from 'vitest';
import { sparklinePoints } from './Sparkline';

describe('sparklinePoints', () => {
  it('spreads time across the width and puts the highest value at the top', () => {
    const points = sparklinePoints(
      [
        { at: 0, value: 20 },
        { at: 10, value: 22 },
      ],
      100,
      40,
      0,
    );
    expect(points).toEqual([
      { x: 0, y: 40 },
      { x: 100, y: 0 },
    ]);
  });

  it('centres a flat or single-point series', () => {
    expect(sparklinePoints([{ at: 5, value: 20 }], 100, 40, 0)).toEqual([{ x: 50, y: 20 }]);
    expect(sparklinePoints([{ at: 0, value: 20 }, { at: 1, value: 20 }], 100, 40, 0).map((p) => p.y)).toEqual([20, 20]);
  });

  it('returns nothing for an empty series', () => {
    expect(sparklinePoints([])).toEqual([]);
  });
});
