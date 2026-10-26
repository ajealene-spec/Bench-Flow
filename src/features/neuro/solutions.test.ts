import { describe, expect, it } from 'vitest';
import { ACSF_RECIPE, checkOsmolarity, estimateOsmolarity, scaleRecipe, SolutionError } from './solutions';

describe('scaleRecipe', () => {
  it('converts mM to grams for the volume', () => {
    const [nacl] = scaleRecipe([{ id: 'x', name: 'NaCl', mw: 58.44, mM: 125, particles: 2 }], 1);
    expect(nacl.grams).toBeCloseTo(7.305, 3);
  });

  it('halves every amount for half the volume', () => {
    const full = scaleRecipe(ACSF_RECIPE, 1);
    const half = scaleRecipe(ACSF_RECIPE, 0.5);
    full.forEach((c, i) => expect(half[i].grams).toBeCloseTo(c.grams / 2, 3));
  });

  it('applies a concentration scale on top of the volume', () => {
    const [c] = scaleRecipe([{ id: 'x', name: 'Glucose', mw: 180.16, mM: 10, particles: 1 }], 0.1, 2);
    expect(c.mM).toBe(20);
    expect(c.grams).toBeCloseTo(0.3603, 4);
  });

  it('rejects bad volume and scale', () => {
    expect(() => scaleRecipe(ACSF_RECIPE, 0)).toThrow(SolutionError);
    expect(() => scaleRecipe(ACSF_RECIPE, 1, -1)).toThrow(SolutionError);
  });
});

describe('estimateOsmolarity', () => {
  it('sums mM times particles', () => {
    expect(estimateOsmolarity([{ id: 'a', name: 'A', mw: 1, mM: 100, particles: 2 }, { id: 'b', name: 'B', mw: 1, mM: 50, particles: 1 }])).toBe(250);
  });

  it('gives an ideal estimate in the usual ACSF range', () => {
    const ideal = estimateOsmolarity(ACSF_RECIPE);
    // 343.5 ideal; a 0.9 osmotic coefficient brings it near the 300-310 mOsm target.
    expect(ideal).toBeCloseTo(343.5, 1);
    expect(estimateOsmolarity(ACSF_RECIPE, 0.9)).toBeCloseTo(309, 0);
  });
});

describe('checkOsmolarity', () => {
  it('flags values outside the tolerance', () => {
    expect(checkOsmolarity(305, 300, 10).inRange).toBe(true);
    const off = checkOsmolarity(325, 300, 10);
    expect(off.inRange).toBe(false);
    expect(off.difference).toBe(25);
  });
});
