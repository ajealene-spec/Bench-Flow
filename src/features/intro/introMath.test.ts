import { describe, expect, it } from 'vitest';
import { clamp01, easeOutCubic, parseStat, segmentFill, trackProgress } from './introMath';

describe('introMath', () => {
  it('clamps to the 0 to 1 range', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(3)).toBe(1);
  });

  it('fills the track one segment at a time', () => {
    // Three segments. At half progress the first segment is full and the second is half done.
    expect(segmentFill(0.5, 0, 3)).toBeCloseTo(1);
    expect(segmentFill(0.5, 1, 3)).toBeCloseTo(0.5);
    expect(segmentFill(0.5, 2, 3)).toBe(0);
    expect(segmentFill(1, 2, 3)).toBe(1);
    expect(segmentFill(0, 0, 3)).toBe(0);
  });

  it('measures progress from the 80% line of the viewport down to the element height', () => {
    // Top at 80% of a 1000px viewport: nothing has passed yet.
    expect(trackProgress(800, 400, 1000)).toBe(0);
    // Top has moved 200px past that line: half of a 400px track.
    expect(trackProgress(600, 400, 1000)).toBeCloseTo(0.5);
    // Track has fully passed the line.
    expect(trackProgress(400, 400, 1000)).toBe(1);
    expect(trackProgress(100, 0, 1000)).toBe(0);
  });

  it('parses stat values into prefix, number and suffix', () => {
    expect(parseStat('16')).toEqual({ prefix: '', target: 16, suffix: '' });
    expect(parseStat('100%')).toEqual({ prefix: '', target: 100, suffix: '%' });
    expect(parseStat('$0')).toEqual({ prefix: '$', target: 0, suffix: '' });
    expect(parseStat('none')).toBeNull();
  });

  it('eases out from 0 to 1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});
