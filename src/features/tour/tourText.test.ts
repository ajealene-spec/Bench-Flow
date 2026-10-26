import { describe, expect, it } from 'vitest';
import { sampleMethodsParagraph } from './tourText';

describe('sampleMethodsParagraph', () => {
  const text = sampleMethodsParagraph();

  it('states the actual Fluo-4 AM loading concentration and the planned one', () => {
    expect(text).toContain('loaded at 4.17 µM');
    expect(text).toContain('planned loading concentration was 5 µM');
    expect(text).toContain('8.34 µL');
    expect(text).toContain('10 µL');
  });

  it('describes the imaging, analysis and statistics', () => {
    expect(text).toContain('30 fps');
    expect(text).toContain('Welch t-tests');
    expect(text).toContain('n = 30 cells per group');
  });

  it('is marked as sample data and draws no conclusion', () => {
    expect(text).toContain('Sample data for demonstration');
    expect(text).not.toMatch(/significan|higher|lower|increased|decreased|mouse|animal/i);
  });
});
