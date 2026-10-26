import { describe, expect, it } from 'vitest';
import type { Reagent, Step } from '../../types';
import { detectCalcs, type DetectedCalc } from './detectCalcs';

function step(title: string, instructions: string, reagents: Reagent[] = []): Step {
  return { id: 's1', title, instructions, timers: [], reagents, dataFields: [], cautions: [] };
}

function kinds(calcs: DetectedCalc[]): string[] {
  return calcs.map((c) => c.kind);
}

function only<K extends DetectedCalc['kind']>(calcs: DetectedCalc[], kind: K): Extract<DetectedCalc, { kind: K }> {
  const matches = calcs.filter((c): c is Extract<DetectedCalc, { kind: K }> => c.kind === kind);
  expect(matches).toHaveLength(1);
  return matches[0];
}

describe('detectCalcs: Western blot steps', () => {
  it('primary antibody 1:1000 in 10 mL of milk becomes an antibody calculator', () => {
    const calcs = detectCalcs(
      step(
        'Primary antibody incubation',
        'Dilute primary antibody (anti-GAPDH) 1:1000 in 10 mL of 5% milk in TBST. Incubate membrane overnight at 4 °C with rocking.',
      ),
    );
    expect(kinds(calcs)).toEqual(['antibody']);
    const ab = only(calcs, 'antibody');
    expect(ab.prefill).toEqual({ label: 'Primary antibody volume', ratio: 1000, finalVolume: 10, volumeUnit: 'mL' });
  });

  it('secondary antibody with no volume uses the 10 mL default and says so', () => {
    const calcs = detectCalcs(
      step('Secondary antibody', 'Dilute HRP-conjugated secondary antibody 1:5000 in 5% milk/TBST. Incubate 1 h at room temperature.'),
    );
    const ab = only(calcs, 'antibody');
    expect(ab.prefill.label).toBe('Secondary antibody volume');
    expect(ab.prefill.ratio).toBe(5000);
    expect(ab.prefill.finalVolume).toBe(10);
    expect(ab.reason).toMatch(/default/);
  });

  it('1X TBST from 10X stock becomes a C1V1 dilution in X units', () => {
    const calcs = detectCalcs(step('Wash', 'Prepare 1 L of 1X TBST from 10X stock. Add 1 mL Tween-20 and mix.'));
    expect(kinds(calcs)).toEqual(['dilution']);
    expect(only(calcs, 'dilution').prefill).toEqual({ c1: 10, c1Unit: 'X', c2: 1, c2Unit: 'X', v2: 1, v2Unit: 'L' });
  });

  it('500 mL 1X TBST from 10X also reads the final volume', () => {
    const calcs = detectCalcs(step('Buffer', 'Prepare 500 mL 1X TBST from 10X. Keep at room temperature.'));
    expect(only(calcs, 'dilution').prefill).toMatchObject({ c1: 10, c2: 1, v2: 500, v2Unit: 'mL' });
  });

  it('10% APS is a w/v percent solution of 10 mL', () => {
    const calcs = detectCalcs(step('Gel prep', 'Make 10% APS: dissolve 0.1 g ammonium persulfate in 1 mL water.'));
    expect(kinds(calcs)).toEqual(['percent']);
    expect(only(calcs, 'percent').prefill).toEqual({ percent: 10, basis: 'w/v', finalVolume: 1, volumeUnit: 'mL' });
  });

  it('a 10% APS step without a volume defaults to 10 mL', () => {
    const calcs = detectCalcs(step('Gel prep', 'Make 10% APS fresh for each gel.'));
    expect(only(calcs, 'percent').prefill).toMatchObject({ percent: 10, finalVolume: 10, volumeUnit: 'mL' });
  });

  it('load 20 µg protein with BCA concentration becomes protein loading', () => {
    const calcs = detectCalcs(
      step(
        'Sample loading',
        'Load 20 µg protein per lane. Protein concentration measured by BCA was 2.5 µg/µL.',
      ),
    );
    expect(kinds(calcs)).toEqual(['protein']);
    expect(only(calcs, 'protein').prefill).toEqual({
      concentration: 2.5,
      concentrationUnit: 'µg/µL',
      targetUg: 20,
      finalVolume: 20,
    });
  });

  it('a Laemmli sample buffer step is not read as a fold dilution', () => {
    const calcs = detectCalcs(
      step('Sample prep', 'Add 5 µL of 4X Laemmli sample buffer to 15 µL lysate. Boil at 95 °C for 5 min.'),
    );
    expect(calcs.filter((c) => c.kind === 'dilution')).toHaveLength(0);
  });

  it('blocking and washing steps need no calculator', () => {
    expect(
      detectCalcs(step('Blocking', 'Block membrane in 5% non-fat milk in TBST for 1 h at room temperature.')),
    ).toEqual([]);
    expect(detectCalcs(step('Wash', 'Wash 3 x 5 min in 1X TBST on a rocker.'))).toEqual([]);
    expect(detectCalcs(step('Transfer', 'Transfer proteins to PVDF membrane at 100 V for 1 h on ice.'))).toEqual([]);
  });

  it('a Tween additive is not read as a percent solution', () => {
    const calcs = detectCalcs(step('Wash', 'Prepare 1 L TBST with 0.1% Tween-20.'));
    expect(calcs.filter((c) => c.kind === 'percent')).toHaveLength(0);
  });
});

describe('detectCalcs: PCR steps', () => {
  it('master mix for 24 reactions picks up the reagent volumes', () => {
    const calcs = detectCalcs(
      step(
        'qPCR setup',
        'Prepare master mix for 24 reactions on ice: 10 µL 2X SYBR Green, 0.5 µL 10 µM forward primer, 0.5 µL 10 µM reverse primer. Add 2 µL cDNA to each well.',
        [
          { name: 'SYBR Green 2X', amount: '10', unit: 'µL' },
          { name: 'Nuclease-free water', amount: '7', unit: 'µL' },
        ],
      ),
    );
    expect(kinds(calcs)).toEqual(['masterMix']);
    const mix = only(calcs, 'masterMix');
    expect(mix.prefill.reactions).toBe(24);
    expect(mix.prefill.components).toEqual([
      { name: 'SYBR Green 2X', perReaction: 10, unit: 'µL' },
      { name: 'Nuclease-free water', perReaction: 7, unit: 'µL' },
    ]);
  });

  it('master mix without a count defaults to 10 reactions', () => {
    const calcs = detectCalcs(step('Setup', 'Prepare a master mix on ice and keep it cold.'));
    expect(only(calcs, 'masterMix').prefill.reactions).toBe(10);
  });

  it('a PCR step with only concentrations and volumes needs no calculator', () => {
    const calcs = detectCalcs(
      step('Cycling', 'Denature at 95 °C for 15 s, anneal at 60 °C for 30 s, extend at 72 °C for 30 s. Repeat 40 cycles.'),
    );
    expect(calcs).toEqual([]);
  });
});

describe('detectCalcs: other calculators', () => {
  it('a molar stock dilution reads both concentrations and the volume', () => {
    const calcs = detectCalcs(step('Standard', 'Dilute 10 mM stock to 100 µM in 5 mL with water.'));
    expect(only(calcs, 'dilution').prefill).toEqual({ c1: 10, c1Unit: 'mM', c2: 100, c2Unit: 'µM', v2: 5, v2Unit: 'mL' });
  });

  it('dissolving a molar amount becomes a molarity calculator with the MW when given', () => {
    const calcs = detectCalcs(
      step('Buffer', 'Dissolve 100 mM Tris-HCl (pH 7.5) in 500 mL water. MW 121.14 g/mol.'),
    );
    expect(kinds(calcs)).toEqual(['molarity']);
    expect(only(calcs, 'molarity').prefill).toMatchObject({
      molarity: 100,
      molarityUnit: 'mM',
      volume: 500,
      volumeUnit: 'mL',
      mw: 121.14,
    });
  });

  it('molarity without a MW leaves mw empty for the user', () => {
    const calcs = detectCalcs(step('Buffer', 'Dissolve 1 M Tris base in 1 L water.'));
    expect(only(calcs, 'molarity').prefill.mw).toBeUndefined();
  });

  it('serial dilution reads the ratio, steps and transfer volume', () => {
    const calcs = detectCalcs(
      step('Standards', 'Make a 1:10 serial dilution of the standard for 5 steps, transferring 100 µL between tubes.'),
    );
    expect(kinds(calcs)).toEqual(['serial']);
    expect(only(calcs, 'serial').prefill).toMatchObject({ factor: 10, steps: 5, transferVolume: 100, volumeUnit: 'µL' });
  });

  it('returns several calculators in step order when a step has several needs', () => {
    const calcs = detectCalcs(
      step(
        'Primary and buffer',
        'Prepare 500 mL 1X TBST from 10X. Dilute primary antibody 1:1000 in 10 mL of 5% milk.',
      ),
    );
    expect(kinds(calcs)).toEqual(['dilution', 'antibody']);
  });

  it('returns an empty list for an empty step', () => {
    expect(detectCalcs(step('', ''))).toEqual([]);
  });
});

describe('detectCalcs dedupe', () => {
  it('returns one card when the title repeats the instruction', () => {
    const text = 'Dilute primary antibody 1:1000 in 5% milk and incubate overnight at 4 C.';
    const calcs = detectCalcs({ title: 'Dilute primary antibody 1:1000 in 5% milk and incubate…', instructions: text, reagents: [] } as never);
    expect(calcs.filter((c) => c.kind === 'antibody')).toHaveLength(1);
  });
});
