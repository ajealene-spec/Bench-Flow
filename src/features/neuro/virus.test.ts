import { describe, expect, it } from 'vitest';
import { dilutionPlan, injectionVolumeUl, titerAfterDilution, VirusError } from './virus';

describe('injectionVolumeUl', () => {
  it('divides the dose by the titer', () => {
    // 1e13 vg/mL is 1e10 vg/µL, so 1e9 vg needs 0.1 µL.
    expect(injectionVolumeUl(1e13, 1e9)).toBeCloseTo(0.1, 6);
  });
});

describe('dilutionPlan', () => {
  it('dilutes a strong stock into the injection volume', () => {
    // Need 1e12 vg/mL for 1e9 vg in 1 µL. Stock is 1e13, so 10-fold.
    const plan = dilutionPlan({ stockTiterVgPerMl: 1e13, doseVg: 1e9, injectionVolumeUl: 1 });
    expect(plan.neededVgPerMl).toBe(1e12);
    expect(plan.foldDilution).toBe(10);
    expect(plan.stockUl).toBeCloseTo(0.1, 6);
    expect(plan.diluentUl).toBeCloseTo(0.9, 6);
    expect(plan.warning).toBeUndefined();
  });

  it('warns when the stock is weaker than the dose needs', () => {
    const plan = dilutionPlan({ stockTiterVgPerMl: 1e11, doseVg: 1e9, injectionVolumeUl: 1 });
    expect(plan.foldDilution).toBeCloseTo(0.1, 6);
    expect(plan.warning).toMatch(/weaker/);
  });

  it('rejects zero values', () => {
    expect(() => dilutionPlan({ stockTiterVgPerMl: 0, doseVg: 1, injectionVolumeUl: 1 })).toThrow(VirusError);
  });
});

describe('titerAfterDilution', () => {
  it('divides the titer by the fold', () => {
    expect(titerAfterDilution(1e13, 100)).toBe(1e11);
  });
});
