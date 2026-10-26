import { describe, expect, it } from 'vitest';
import type { StepVariable } from '../../types';
import { detectVariables } from './detectVariables';
import { evaluateFormula } from './formulaEval';

/** Evaluates every derived variable from the input values as written. */
function solve(vars: StepVariable[]): Record<string, number> {
  const scope: Record<string, number> = {};
  for (const v of vars.filter((x) => x.role === 'input')) scope[v.id] = v.value;
  for (const v of vars.filter((x) => x.role === 'derived')) scope[v.id] = evaluateFormula(v.formula ?? '', scope);
  return scope;
}

function derivedNamed(vars: StepVariable[], token: string): StepVariable {
  const found = vars.find((v) => v.role === 'derived' && v.token === token);
  if (!found) throw new Error(`no derived variable "${token}" in ${JSON.stringify(vars.map((v) => v.token))}`);
  return found;
}

describe('detectVariables: dilutions', () => {
  it('makes the antibody volume a derived value of final volume over the dilution', () => {
    const vars = detectVariables('Dilute primary antibody 1:1000 in 10 mL of 5% milk in TBST. Incubate overnight at 4 °C.');
    const dil = vars.find((v) => v.token === '1:1000');
    expect(dil).toMatchObject({ role: 'input', value: 1000, unit: '1:N' });
    const final = vars.find((v) => v.token === '10 mL');
    expect(final).toMatchObject({ role: 'input', value: 10, unit: 'mL' });

    const ab = derivedNamed(vars, 'primary antibody volume');
    expect(ab.unit).toBe('µL');
    expect(solve(vars)[ab.id]).toBeCloseTo(10, 10);
  });

  it('reads the reagent name that sits between the dilution and "in"', () => {
    const vars = detectVariables('Add 1:1000 antibody in 10 mL buffer.');
    const ab = derivedNamed(vars, 'antibody volume');
    expect(solve(vars)[ab.id]).toBeCloseTo(10, 10);
  });

  it('does not derive a volume when the dilution has no final volume', () => {
    const vars = detectVariables('Use a 1:500 dilution of the sample.');
    expect(vars.filter((v) => v.role === 'derived')).toHaveLength(0);
    expect(vars).toEqual([expect.objectContaining({ token: '1:500', role: 'input' })]);
  });
});

describe('detectVariables: C1V1', () => {
  it('derives V1 from C1, C2 and the final volume', () => {
    const vars = detectVariables('Dilute 10 mM stock to 1 mM in 50 mL water.');
    const v1 = derivedNamed(vars, 'V1');
    expect(v1.unit).toBe('µL');
    expect(solve(vars)[v1.id]).toBeCloseTo(5000, 6);
  });

  it('picks the more concentrated value as the stock, whatever the order in the text', () => {
    const vars = detectVariables('Make 1x TBST from 10x stock to 500 mL.');
    const v1 = derivedNamed(vars, 'V1');
    expect(solve(vars)[v1.id]).toBeCloseTo(50000, 6);
  });

  it('converts between molar units', () => {
    const vars = detectVariables('Dilute 10 mM stock to 100 µM in 1 L.');
    const v1 = derivedNamed(vars, 'V1');
    expect(v1.unit).toBe('mL');
    expect(solve(vars)[v1.id]).toBeCloseTo(10, 6);
  });

  it('needs a final volume to derive anything', () => {
    const vars = detectVariables('Dilute 10 mM stock to 1 mM.');
    expect(vars.filter((v) => v.role === 'derived')).toHaveLength(0);
  });
});

describe('detectVariables: per-sample scaling', () => {
  it('multiplies a per-sample amount by the sample count written in the step', () => {
    const vars = detectVariables('Add 1.5 mL master mix per sample for 12 samples.');
    const total = derivedNamed(vars, 'total for N');
    expect(total.unit).toBe('mL');
    expect(solve(vars)[total.id]).toBeCloseTo(18, 10);
  });

  it('adds an N input defaulting to one sample when the count is not in the text', () => {
    const vars = detectVariables('Add 10 µL of enzyme to each well.');
    const n = vars.find((v) => v.token === 'N');
    expect(n).toMatchObject({ role: 'input', value: 1, unit: 'samples' });
    const total = derivedNamed(vars, 'total for N');
    expect(total.formula).toBe(`${vars.find((v) => v.unit === 'µL')?.id} * ${n?.id}`);
    expect(solve(vars)[total.id]).toBeCloseTo(10, 10);
  });
});

describe('detectVariables: no false positives', () => {
  it.each([
    'Incubate at 37 °C for 30 min.',
    'Spin at 300 rpm for 5 min, then cool to 4 °C.',
    'Centrifuge at 1000 × g for 5 min.',
    'Centrifuge at 1000 g for 5 min.',
    'Wait 2 h at room temperature, then read on a 1 h timer.',
    'Plate 4 x 10 cells per well and read at 450 nm.',
    'Heat the lysate to 95 °C for 5 min.',
    'Shake gently and mix well.',
  ])('finds nothing in "%s"', (text) => {
    expect(detectVariables(text)).toEqual([]);
  });

  it('returns nothing for empty text', () => {
    expect(detectVariables('')).toEqual([]);
    expect(detectVariables('   ')).toEqual([]);
  });

  it('keeps a plain volume as a single tappable input without a derived value', () => {
    const vars = detectVariables('Add 5 mL water.');
    expect(vars).toEqual([{ id: 'q1', token: '5 mL', value: 5, unit: 'mL', role: 'input' }]);
  });

  it('gives every variable a unique id', () => {
    const vars = detectVariables('Dilute 10 mM stock to 1 mM in 50 mL. Add 1.5 mL per sample for 12 samples.');
    const ids = vars.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
