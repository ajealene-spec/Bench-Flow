import { describe, expect, it } from 'vitest';
import {
  atlasWarnings,
  CORONAL_FRAME,
  coronalPoint,
  coronalTrack,
  lambdaPoint,
  outlinePath,
  SAGITTAL_FRAME,
  SAGITTAL_OUTLINE,
  sagittalPoint,
  SCHEMATIC_MAX_DV,
} from './brainAtlas';

describe('sagittalPoint', () => {
  it('puts bregma at the frame origin', () => {
    expect(sagittalPoint(0, 0)).toEqual({ x: SAGITTAL_FRAME.originX, y: SAGITTAL_FRAME.originY });
  });

  it('draws anterior to the left and deeper structures further down', () => {
    const anterior = sagittalPoint(2, 0);
    const posterior = sagittalPoint(-2, 0);
    expect(anterior.x).toBeLessThan(posterior.x);
    const deep = sagittalPoint(0, 3);
    expect(deep.y).toBeGreaterThan(SAGITTAL_FRAME.originY);
    expect(deep.y - SAGITTAL_FRAME.originY).toBeCloseTo(3 * SAGITTAL_FRAME.pxPerMm, 0);
  });

  it('scales by pixels per mm on both axes', () => {
    const a = sagittalPoint(1, 1);
    const b = sagittalPoint(0, 0);
    expect(Math.abs(b.x - a.x)).toBeCloseTo(SAGITTAL_FRAME.pxPerMm, 0);
    expect(Math.abs(a.y - b.y)).toBeCloseTo(SAGITTAL_FRAME.pxPerMm, 0);
  });
});

describe('coronalPoint', () => {
  it('centres the midline and draws positive ML to the right', () => {
    expect(coronalPoint(0, 0).x).toBe(CORONAL_FRAME.originX);
    expect(coronalPoint(1, 0).x).toBeGreaterThan(CORONAL_FRAME.originX);
    expect(coronalPoint(-1, 0).x).toBeLessThan(CORONAL_FRAME.originX);
  });
});

describe('coronalTrack', () => {
  it('is vertical at zero angle, with the entry directly above the tip', () => {
    const t = coronalTrack(1.5, 3, 0)!;
    expect(t.entry.x).toBe(t.tip.x);
    expect(t.entry.y).toBe(CORONAL_FRAME.originY);
    expect(t.tip.y).toBeGreaterThan(t.entry.y);
  });

  it('enters further lateral (smaller ML) than the tip for a positive target and angle', () => {
    const t = coronalTrack(2, 4, 15)!;
    expect(t.entryMl).toBeLessThan(2);
    expect(t.entry.x).toBeLessThan(t.tip.x);
    expect(t.insertionDepth).toBeGreaterThan(4);
  });

  it('returns undefined for an invalid approach', () => {
    expect(coronalTrack(1, 2, 60)).toBeUndefined();
    expect(coronalTrack(1, -1, 0)).toBeUndefined();
  });
});

describe('lambdaPoint', () => {
  it('sits behind bregma by the bregma–lambda distance', () => {
    const l = lambdaPoint(4.2);
    expect(l.x).toBeGreaterThan(SAGITTAL_FRAME.originX);
    expect((l.x - SAGITTAL_FRAME.originX) / SAGITTAL_FRAME.pxPerMm).toBeCloseTo(4.2, 0);
  });

  it('moves with a measured distance', () => {
    expect(lambdaPoint(4.62).x).toBeGreaterThan(lambdaPoint(4.2).x);
  });
});

describe('outlinePath', () => {
  it('builds a closed SVG path through every point', () => {
    const d = outlinePath([[0, 0], [1, 0], [1, 1]], (a, b) => ({ x: a, y: b }));
    expect(d).toBe('M0,0 L1,0 L1,1 Z');
  });

  it('closes the sagittal outline and keeps it inside the frame', () => {
    const d = outlinePath(SAGITTAL_OUTLINE, (a, b) => sagittalPoint(a, b));
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    for (const [ap, dv] of SAGITTAL_OUTLINE) {
      const p = sagittalPoint(ap, dv);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(SAGITTAL_FRAME.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(SAGITTAL_FRAME.height);
    }
  });
});

describe('atlasWarnings', () => {
  it('is empty for a target inside the schematic', () => {
    expect(atlasWarnings({ ap: -2, ml: 1.5, dv: 2.5 })).toEqual([]);
    expect(atlasWarnings({})).toEqual([]);
  });

  it('flags AP, ML and DV values outside the schematic', () => {
    expect(atlasWarnings({ ap: 6 })).toHaveLength(1);
    expect(atlasWarnings({ ml: -5 })).toHaveLength(1);
    expect(atlasWarnings({ dv: SCHEMATIC_MAX_DV + 0.5 })).toHaveLength(1);
  });
});
