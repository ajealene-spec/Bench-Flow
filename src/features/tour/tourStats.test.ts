import { describe, expect, it } from 'vitest';
import { formatMeanSd, formatMinSec, formatP, mean, sampleSd, summarize, twoSidedP, welchTTest } from './tourStats';
import { SAMPLE_CELLS, SAMPLE_CONDITIONS, CELLS_PER_GROUP } from './sampleData';

describe('mean', () => {
  it('averages values', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });
  it('is NaN for no values', () => {
    expect(mean([])).toBeNaN();
  });
});

describe('sampleSd', () => {
  it('uses n - 1 (Bessel correction)', () => {
    // Values 2, 4, 4, 4, 5, 5, 7, 9: population SD is 2, sample SD is sqrt(32 / 7).
    expect(sampleSd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(32 / 7), 10);
  });
  it('is zero for a single value or none', () => {
    expect(sampleSd([5])).toBe(0);
    expect(sampleSd([])).toBe(0);
  });
  it('is unchanged by shifting every value', () => {
    expect(sampleSd([10, 12, 14])).toBeCloseTo(sampleSd([110, 112, 114]), 10);
  });
});

describe('summarize and formatMeanSd', () => {
  it('reports n, mean and SD', () => {
    const s = summarize([184, 196, 171]);
    expect(s.n).toBe(3);
    expect(s.mean).toBeCloseTo(183.667, 2);
    expect(s.sd).toBeCloseTo(12.5, 1);
    expect(formatMeanSd(s)).toBe('184 ± 13');
  });
  it('shows a dash when there is no data', () => {
    expect(formatMeanSd(summarize([]))).toBe('—');
  });
});

describe('formatMinSec', () => {
  it('formats seconds as minutes and seconds', () => {
    expect(formatMinSec(4020)).toBe('67:00');
    expect(formatMinSec(3605)).toBe('60:05');
    expect(formatMinSec(-90)).toBe('-1:30');
  });
});

describe('twoSidedP', () => {
  it('is 1 at t = 0', () => {
    expect(twoSidedP(0, 10)).toBeCloseTo(1, 10);
  });
  it('matches t-table values', () => {
    // Two-sided 0.05 critical values: t = 2.228 at df 10, t = 2.042 at df 30.
    expect(twoSidedP(2.228, 10)).toBeCloseTo(0.05, 3);
    expect(twoSidedP(2.042, 30)).toBeCloseTo(0.05, 3);
    // With df 10, t = 2.0 is about p = 0.0734.
    expect(twoSidedP(2, 10)).toBeCloseTo(0.0734, 3);
  });
  it('approaches the normal distribution for large df', () => {
    expect(twoSidedP(1.96, 1e6)).toBeCloseTo(0.05, 3);
  });
});

describe('welchTTest', () => {
  it('gives a zero difference and p = 1 for identical groups', () => {
    const r = welchTTest([1, 2, 3, 4], [1, 2, 3, 4]);
    expect(r?.t).toBeCloseTo(0, 10);
    expect(r?.p).toBeCloseTo(1, 10);
  });
  it('matches a hand-computed example', () => {
    // a: mean 5, sample var 2.5; b: mean 7, sample var 2.5, n = 5 each.
    const a = [3, 4, 5, 6, 7];
    const b = [5, 6, 7, 8, 9];
    const r = welchTTest(a, b)!;
    expect(r.meanDiff).toBeCloseTo(-2, 10);
    expect(r.t).toBeCloseTo(-2 / Math.sqrt(0.5 + 0.5), 10);
    expect(r.df).toBeCloseTo(8, 6);
    expect(r.p).toBeCloseTo(twoSidedP(r.t, 8), 10);
    expect(r.p).toBeGreaterThan(0.05);
    expect(r.p).toBeLessThan(0.1);
  });
  it('returns null when a group has fewer than two values', () => {
    expect(welchTTest([1], [1, 2, 3])).toBeNull();
  });
  it('formats p-values for display', () => {
    expect(formatP(0.0004)).toBe('< 0.001');
    expect(formatP(0.04567)).toBe('0.046');
  });
});

describe('sample cells', () => {
  it('has 30 cells for every genotype and condition', () => {
    for (const g of ['APOE3', 'APOE4'] as const) {
      for (const c of SAMPLE_CONDITIONS) {
        expect(SAMPLE_CELLS[g][c.id].peak).toHaveLength(CELLS_PER_GROUP);
        expect(SAMPLE_CELLS[g][c.id].auc).toHaveLength(CELLS_PER_GROUP);
      }
    }
  });
  it('keeps every peak positive', () => {
    for (const g of ['APOE3', 'APOE4'] as const) {
      for (const c of SAMPLE_CONDITIONS) expect(SAMPLE_CELLS[g][c.id].peak.every((v) => v > 0)).toBe(true);
    }
  });
});
