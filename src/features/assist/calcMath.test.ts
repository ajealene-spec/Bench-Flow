import { describe, expect, it } from 'vitest';
import {
  CalcError,
  antibodyDilution,
  convertUnit,
  formatValue,
  masterMix,
  massToMolarity,
  molarityToMass,
  parseAmount,
  percentSolute,
  proteinLoad,
  serialDilution,
  solveDilution,
  type DilutionInput,
} from './calcMath';

const base: DilutionInput = { c1: null, c1Unit: 'X', v1: null, v1Unit: 'mL', c2: 1, c2Unit: 'X', v2: 500, v2Unit: 'mL' };

describe('parseAmount', () => {
  it('reads plain, decimal-comma and unicode-minus numbers', () => {
    expect(parseAmount('12')).toBe(12);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('1,234.5')).toBe(1234.5);
    expect(parseAmount('−3')).toBe(-3);
    expect(parseAmount('  0.5 ')).toBe(0.5);
  });

  it('rejects empty and non-numeric text', () => {
    expect(parseAmount('')).toBeUndefined();
    expect(parseAmount('  ')).toBeUndefined();
    expect(parseAmount('10X')).toBeUndefined();
    expect(parseAmount(undefined)).toBeUndefined();
  });
});

describe('formatValue', () => {
  it('shows three significant figures without trailing zeros', () => {
    expect(formatValue(50)).toBe('50');
    expect(formatValue(0.292198)).toBe('0.292');
    expect(formatValue(9990)).toBe('9990');
    expect(formatValue(0)).toBe('0');
    expect(formatValue(Number.NaN)).toBe('—');
  });
});

describe('convertUnit', () => {
  it('converts within a family', () => {
    expect(convertUnit(10, 'mM', 'µM')).toBeCloseTo(10000);
    expect(convertUnit(1, 'µg/µL', 'mg/mL')).toBeCloseTo(1);
    expect(convertUnit(1, 'ng/µL', 'µg/mL')).toBeCloseTo(1);
    expect(convertUnit(250, 'µL', 'mL')).toBeCloseTo(0.25);
  });

  it('refuses to mix families', () => {
    expect(() => convertUnit(1, 'M', 'mL')).toThrow(CalcError);
  });
});

describe('solveDilution (C1V1 = C2V2)', () => {
  it('solves V1 for 1X from 10X in 500 mL', () => {
    const result = solveDilution({ ...base, c1: 10, c1Unit: 'X' });
    expect(result.field).toBe('v1');
    expect(result.value).toBeCloseTo(50);
    expect(result.unit).toBe('mL');
    expect(result.warning).toBeUndefined();
  });

  it('solves V1 in µL when that is the unit selected', () => {
    const result = solveDilution({ ...base, c1: 10, c1Unit: 'X', v1Unit: 'µL' });
    expect(result.value).toBeCloseTo(50000);
    expect(result.unit).toBe('µL');
  });

  it('solves C1 (stock strength) for a given V1 and V2', () => {
    const result = solveDilution({ c1: null, c1Unit: 'X', v1: 50, v1Unit: 'mL', c2: 1, c2Unit: 'X', v2: 500, v2Unit: 'mL' });
    expect(result.field).toBe('c1');
    expect(result.value).toBeCloseTo(10);
    expect(result.unit).toBe('X');
  });

  it('solves C2 (final concentration) and returns it in the requested unit', () => {
    const result = solveDilution({ c1: 10, c1Unit: 'mM', v1: 5, v1Unit: 'mL', c2: null, c2Unit: 'µM', v2: 500, v2Unit: 'mL' });
    expect(result.field).toBe('c2');
    expect(result.value).toBeCloseTo(100); // 10 mM × 5 mL / 500 mL = 0.1 mM = 100 µM
    expect(result.unit).toBe('µM');
  });

  it('solves V2 (final volume)', () => {
    const result = solveDilution({ c1: 10, c1Unit: 'X', v1: 50, v1Unit: 'mL', c2: 1, c2Unit: 'X', v2: null, v2Unit: 'L' });
    expect(result.field).toBe('v2');
    expect(result.value).toBeCloseTo(0.5);
    expect(result.unit).toBe('L');
  });

  it('mixes concentration units of the same family', () => {
    // 10 mM stock to 100 µM in 5 mL needs 0.05 mL = 50 µL of stock.
    const result = solveDilution({ c1: 10, c1Unit: 'mM', v1: null, v1Unit: 'µL', c2: 100, c2Unit: 'µM', v2: 5, v2Unit: 'mL' });
    expect(result.value).toBeCloseTo(50);
    expect(result.unit).toBe('µL');
  });

  it('mixes mass concentration units', () => {
    // 20 mg/mL stock, 1 mL, to 200 µg/mL (0.2 mg/mL): the final volume is 100 mL.
    const result = solveDilution({ c1: 20, c1Unit: 'mg/mL', v1: 1, v1Unit: 'mL', c2: 200, c2Unit: 'µg/mL', v2: null, v2Unit: 'mL' });
    expect(result.field).toBe('v2');
    expect(result.value).toBeCloseTo(100);
  });

  it('warns when the stock is too weak, which also makes V1 larger than V2', () => {
    const result = solveDilution({ c1: 1, c1Unit: 'X', v1: null, v1Unit: 'mL', c2: 10, c2Unit: 'X', v2: 500, v2Unit: 'mL' });
    expect(result.value).toBeCloseTo(5000);
    expect(result.warning).toMatch(/weaker/);
  });

  it('warns when the stock is weaker than the target', () => {
    const result = solveDilution({ c1: 1, c1Unit: 'X', v1: 50, v1Unit: 'mL', c2: null, c2Unit: 'X', v2: 500, v2Unit: 'mL' });
    expect(result.field).toBe('c2');
    expect(result.warning).toBeUndefined();
    const weaker = solveDilution({ c1: 1, c1Unit: 'X', v1: null, v1Unit: 'mL', c2: 2, c2Unit: 'X', v2: 500, v2Unit: 'mL' });
    expect(weaker.warning).toMatch(/weaker/);
  });

  it('needs exactly one empty field', () => {
    expect(() => solveDilution({ ...base, c1: 10, v1: null })).not.toThrow();
    expect(() => solveDilution({ ...base, c1: null, v1: null })).toThrow(CalcError);
    expect(() => solveDilution({ ...base, c1: null, c2: null, v1: 5 })).toThrow(/exactly three/);
    expect(() => solveDilution({ ...base, c1: 10, v1: 5, c2: 1, v2: 50 })).toThrow(/exactly three/);
  });

  it('rejects zero or negative values and mismatched concentration kinds', () => {
    expect(() => solveDilution({ ...base, c1: 0 })).toThrow(/greater than 0/);
    expect(() => solveDilution({ ...base, c1: 10, c1Unit: 'M', c2Unit: 'X' })).toThrow(/same kind/);
  });
});

describe('molarity and mass', () => {
  it('mass = M × V × MW, in grams', () => {
    // 1 M × 0.5 L × 100 g/mol = 50 g
    expect(molarityToMass({ molarity: 1, molarityUnit: 'M', volume: 0.5, volumeUnit: 'L', mw: 100, massUnit: 'g' })).toBeCloseTo(50);
  });

  it('weighs NaCl-style amounts in mg', () => {
    // 100 mM × 50 mL × 58.44 g/mol = 0.2922 g = 292.2 mg
    const mg = molarityToMass({ molarity: 100, molarityUnit: 'mM', volume: 50, volumeUnit: 'mL', mw: 58.44, massUnit: 'mg' });
    expect(mg).toBeCloseTo(292.2, 1);
  });

  it('converts µM to µg for a small peptide', () => {
    // 10 µM × 1 mL × 1000 g/mol = 10 µg
    expect(molarityToMass({ molarity: 10, molarityUnit: 'µM', volume: 1, volumeUnit: 'mL', mw: 1000, massUnit: 'µg' })).toBeCloseTo(10);
  });

  it('is the reverse of molarityToMass', () => {
    const mass = molarityToMass({ molarity: 0.25, molarityUnit: 'M', volume: 250, volumeUnit: 'mL', mw: 84, massUnit: 'g' });
    const back = massToMolarity({ mass, massUnit: 'g', volume: 250, volumeUnit: 'mL', mw: 84, molarityUnit: 'M' });
    expect(back).toBeCloseTo(0.25);
    expect(massToMolarity({ mass: 1, massUnit: 'g', volume: 1, volumeUnit: 'L', mw: 100, molarityUnit: 'mM' })).toBeCloseTo(10);
  });

  it('rejects a missing molecular weight', () => {
    expect(() => molarityToMass({ molarity: 1, molarityUnit: 'M', volume: 1, volumeUnit: 'L', mw: 0, massUnit: 'g' })).toThrow(CalcError);
  });
});

describe('percent solutions', () => {
  it('10% w/v APS in 10 mL needs 1 g', () => {
    expect(percentSolute({ percent: 10, basis: 'w/v', finalVolume: 10, volumeUnit: 'mL', outUnit: 'g' })).toBeCloseTo(1);
  });

  it('gives w/v in mg for small amounts', () => {
    // 0.1% w/v in 50 mL = 50 mg
    expect(percentSolute({ percent: 0.1, basis: 'w/v', finalVolume: 50, volumeUnit: 'mL', outUnit: 'mg' })).toBeCloseTo(50);
  });

  it('gives v/v as a volume of solute', () => {
    expect(percentSolute({ percent: 10, basis: 'v/v', finalVolume: 500, volumeUnit: 'mL', outUnit: 'mL' })).toBeCloseTo(50);
    expect(percentSolute({ percent: 10, basis: 'v/v', finalVolume: 1, volumeUnit: 'L', outUnit: 'µL' })).toBeCloseTo(100000);
  });

  it('refuses units that do not match the basis', () => {
    expect(() => percentSolute({ percent: 10, basis: 'w/v', finalVolume: 10, volumeUnit: 'mL', outUnit: 'mL' })).toThrow(/mass unit/);
    expect(() => percentSolute({ percent: 10, basis: 'v/v', finalVolume: 10, volumeUnit: 'mL', outUnit: 'g' })).toThrow(/volume unit/);
  });
});

describe('antibody dilution', () => {
  it('1:1000 in 10 mL needs 10 µL antibody', () => {
    const result = antibodyDilution({ ratio: 1000, finalVolume: 10, volumeUnit: 'mL', outUnit: 'µL' });
    expect(result.antibodyVolume).toBeCloseTo(10);
    expect(result.diluentVolume).toBeCloseTo(9990);
  });

  it('1:5000 in 15 mL, reported in µL', () => {
    const result = antibodyDilution({ ratio: 5000, finalVolume: 15, volumeUnit: 'mL', outUnit: 'µL' });
    expect(result.antibodyVolume).toBeCloseTo(3);
  });

  it('rejects ratios below 1', () => {
    expect(() => antibodyDilution({ ratio: 0.5, finalVolume: 1, volumeUnit: 'mL', outUnit: 'µL' })).toThrow(/1 or more/);
  });
});

describe('serial dilution', () => {
  it('1:10 steps, 3 steps from 1 M', () => {
    const result = serialDilution({ startConcentration: 1, unit: 'M', factor: 10, steps: 3, transferVolume: 100, volumeUnit: 'µL' });
    expect(result.tubes.map((t) => t.index)).toEqual([0, 1, 2, 3]);
    [1, 0.1, 0.01, 0.001].forEach((expected, i) => expect(result.tubes[i].concentration).toBeCloseTo(expected, 10));
    expect(result.tubes[3].totalFactor).toBeCloseTo(1000);
  });

  it('diluent per tube is transfer × (factor − 1), so tubes end at equal volume', () => {
    const result = serialDilution({ startConcentration: 50, unit: 'µg/µL', factor: 2, steps: 4, transferVolume: 100, volumeUnit: 'µL' });
    expect(result.diluentVolume).toBeCloseTo(100);
    expect(result.tubes[4].concentration).toBeCloseTo(3.125);
  });

  it('rejects factors of 1 or less and non-integer steps', () => {
    expect(() => serialDilution({ startConcentration: 1, unit: 'M', factor: 1, steps: 3, transferVolume: 1, volumeUnit: 'mL' })).toThrow(/greater than 1/);
    expect(() => serialDilution({ startConcentration: 1, unit: 'M', factor: 2, steps: 2.5, transferVolume: 1, volumeUnit: 'mL' })).toThrow(/whole number/);
  });
});

describe('master mix', () => {
  const components = [
    { name: 'SYBR 2X', perReaction: 10, unit: 'µL' as const },
    { name: 'Primer F (10 µM)', perReaction: 0.5, unit: 'µL' as const },
    { name: 'Water', perReaction: 7.5, unit: 'µL' as const },
  ];

  it('scales each component by reactions plus 10% overage by default', () => {
    const result = masterMix({ reactions: 10, components });
    expect(result.reactionsWithOverage).toBeCloseTo(11);
    expect(result.rows[0].total).toBeCloseTo(110);
    expect(result.rows[1].total).toBeCloseTo(5.5);
    expect(result.totalMicroliters).toBeCloseTo(110 + 5.5 + 82.5);
  });

  it('uses the overage given and 0% when asked', () => {
    expect(masterMix({ reactions: 10, overagePct: 0, components }).rows[0].total).toBeCloseTo(100);
    expect(masterMix({ reactions: 20, overagePct: 25, components }).reactionsWithOverage).toBeCloseTo(25);
  });

  it('converts mixed units into the µL total', () => {
    const result = masterMix({
      reactions: 1,
      overagePct: 0,
      components: [
        { name: 'Enzyme', perReaction: 0.002, unit: 'mL' },
        { name: 'Buffer', perReaction: 5, unit: 'µL' },
      ],
    });
    expect(result.totalMicroliters).toBeCloseTo(7);
  });

  it('rejects a non-integer or zero reaction count and empty component volumes', () => {
    expect(() => masterMix({ reactions: 0, components })).toThrow(CalcError);
    expect(() => masterMix({ reactions: 2.5, components })).toThrow(/whole number/);
    expect(() => masterMix({ reactions: 2, components: [{ name: 'X', perReaction: 0, unit: 'µL' }] })).toThrow(/greater than 0/);
  });
});

describe('protein loading', () => {
  it('2.5 µg/µL lysate, 20 µg, 20 µL final with 4X Laemmli', () => {
    const result = proteinLoad({ concentration: 2.5, concentrationUnit: 'µg/µL', targetUg: 20, finalVolume: 20 });
    expect(result.sampleVolume).toBeCloseTo(8);
    expect(result.laemmliVolume).toBeCloseTo(5);
    expect(result.bufferVolume).toBeCloseTo(7);
    expect(result.sampleVolume + result.laemmliVolume + result.bufferVolume).toBeCloseTo(20);
  });

  it('converts mg/mL concentrations', () => {
    // 2 mg/mL = 2 µg/µL, so 20 µg needs 10 µL
    const result = proteinLoad({ concentration: 2, concentrationUnit: 'mg/mL', targetUg: 20, finalVolume: 30 });
    expect(result.sampleVolume).toBeCloseTo(10);
    expect(result.bufferVolume).toBeCloseTo(30 - 10 - 7.5);
  });

  it('uses a custom Laemmli strength', () => {
    const result = proteinLoad({ concentration: 1, concentrationUnit: 'µg/µL', targetUg: 10, finalVolume: 20, laemmliFold: 2 });
    expect(result.laemmliVolume).toBeCloseTo(10);
    expect(result.bufferVolume).toBeCloseTo(0);
  });

  it('explains when the sample does not fit the final volume', () => {
    expect(() => proteinLoad({ concentration: 0.5, concentrationUnit: 'µg/µL', targetUg: 30, finalVolume: 20 })).toThrow(
      /does not fit/,
    );
  });
});
