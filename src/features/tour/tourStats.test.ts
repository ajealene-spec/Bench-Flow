import { describe, expect, it } from 'vitest';
import { formatMeanSd, formatMinSec, mean, sampleSd, summarize } from './tourStats';
import { sampleMethodsParagraph } from './tourText';
import { SAMPLE_COUNTS, SAMPLE_REGIONS } from './sampleData';

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
  it('reports n, mean and SD for the sample counts', () => {
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

describe('sample data', () => {
  it('has three animals for every region', () => {
    for (const region of SAMPLE_REGIONS) expect(SAMPLE_COUNTS[region]).toHaveLength(3);
  });
  it('keeps CA1 above CA3 in the sample numbers', () => {
    expect(mean(SAMPLE_COUNTS.CA1)).toBeGreaterThan(mean(SAMPLE_COUNTS.CA3));
  });
});

describe('sampleMethodsParagraph', () => {
  it('states the sample facts and marks the counts as mean ± SD', () => {
    const text = sampleMethodsParagraph();
    expect(text).toContain('1:1000');
    expect(text).toContain('7 minutes over');
    expect(text).toContain('CA1 184 ± 13');
    expect(text).toContain('n = 3 animals');
  });
});
