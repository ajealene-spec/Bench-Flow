import { describe, expect, it } from 'vitest';
import { angledApproach, formatCoordinate, scaleAp, skullScale, StereotaxError } from './stereotax';

describe('skullScale', () => {
  it('compares the measured bregma–lambda distance with the 4.2 mm atlas value', () => {
    expect(skullScale(4.2)).toBeCloseTo(1, 10);
    expect(skullScale(4.62)).toBeCloseTo(1.1, 10);
  });

  it('rejects zero or negative measurements', () => {
    expect(() => skullScale(0)).toThrow(StereotaxError);
    expect(() => skullScale(-1)).toThrow(StereotaxError);
  });
});

describe('scaleAp', () => {
  it('scales AP by the measured skull size', () => {
    const r = scaleAp(-2, 4.62);
    expect(r.scale).toBeCloseTo(1.1, 10);
    expect(r.ap).toBe(-2.2);
  });

  it('keeps the atlas value when the skull matches the atlas', () => {
    expect(scaleAp(1.5, 4.2).ap).toBe(1.5);
  });
});

describe('angledApproach', () => {
  it('leaves a vertical approach unchanged', () => {
    const r = angledApproach(1.2, 3, 0);
    expect(r).toMatchObject({ entryMl: 1.2, mlShift: 0, insertionDepth: 3 });
  });

  it('shifts the entry point and lengthens the insertion for a tilted approach', () => {
    const r = angledApproach(1, 3, 30);
    // tan(30°) ≈ 0.5774, so 3 mm deep shifts 1.73 mm laterally.
    expect(r.mlShift).toBeCloseTo(1.73, 2);
    expect(r.entryMl).toBeCloseTo(1 - 1.73, 2);
    // cos(30°) ≈ 0.866, so the pipette travels 3 / 0.866 ≈ 3.46 mm.
    expect(r.insertionDepth).toBeCloseTo(3.46, 2);
  });

  it('rejects out-of-range angles and negative depth', () => {
    expect(() => angledApproach(1, 3, 60)).toThrow(StereotaxError);
    expect(() => angledApproach(1, 3, -5)).toThrow(StereotaxError);
    expect(() => angledApproach(1, -3, 10)).toThrow(StereotaxError);
  });
});

describe('formatCoordinate', () => {
  it('prints signed values with two decimals', () => {
    expect(formatCoordinate('AP', -2.2)).toBe('AP −2.20 mm');
    expect(formatCoordinate('ML', 1.5)).toBe('ML +1.50 mm');
    expect(formatCoordinate('DV', 0)).toBe('DV 0.00 mm');
  });
});
