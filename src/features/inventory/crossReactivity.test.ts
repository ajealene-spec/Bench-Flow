import { describe, expect, it } from 'vitest';
import { checkCrossReactivity, isSecondary, speciesOf, type CrossReactivityItem } from './crossReactivity';

const primary = (name: string, hostSpecies: string, target = 'GFAP'): CrossReactivityItem => ({
  name,
  kind: 'antibody',
  hostSpecies,
  target,
});
const secondary = (name: string, hostSpecies: string, target: string): CrossReactivityItem => ({
  name,
  kind: 'antibody',
  hostSpecies,
  target,
  isotype: 'IgG',
  conjugate: 'HRP',
});

describe('speciesOf and isSecondary', () => {
  it('reads a species from a target string', () => {
    expect(speciesOf('Rabbit IgG')).toBe('rabbit');
    expect(speciesOf('guinea-pig')).toBe('guinea pig');
    expect(speciesOf('GFAP')).toBeUndefined();
  });

  it('treats an antibody with a species target as a secondary', () => {
    expect(isSecondary(secondary('s', 'goat', 'rabbit'))).toBe(true);
    expect(isSecondary(primary('p', 'rabbit'))).toBe(false);
    expect(isSecondary({ name: 'buffer', kind: 'buffer', target: 'rabbit' })).toBe(false);
  });
});

describe('checkCrossReactivity', () => {
  it('warns when a goat anti-rabbit is used with a mouse primary', () => {
    const warnings = checkCrossReactivity([primary('Mouse anti-GFAP', 'mouse'), secondary('Goat anti-rabbit IgG', 'goat', 'rabbit')]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: 'secondary-host-mismatch', severity: 'warning' });
    expect(warnings[0].itemNames).toEqual(['Goat anti-rabbit IgG', 'Mouse anti-GFAP']);
  });

  it('does not warn when the secondary matches the primary host', () => {
    const warnings = checkCrossReactivity([primary('Rabbit anti-GFAP', 'rabbit'), secondary('Goat anti-rabbit IgG', 'goat', 'rabbit')]);
    expect(warnings).toEqual([]);
  });

  it('warns when two primaries from one host are multiplexed with species-specific secondaries', () => {
    const warnings = checkCrossReactivity(
      [primary('Rabbit anti-GFAP', 'rabbit'), primary('Rabbit anti-Iba1', 'rabbit', 'Iba1'), secondary('Goat anti-rabbit IgG', 'goat', 'rabbit')],
      { multiplex: true },
    );
    const multi = warnings.filter((w) => w.code === 'multiplex-same-host');
    expect(multi).toHaveLength(1);
    expect(multi[0].itemNames).toEqual(['Rabbit anti-GFAP', 'Rabbit anti-Iba1']);
  });

  it('does not warn about same-host primaries when not multiplexed', () => {
    const warnings = checkCrossReactivity(
      [primary('Rabbit anti-GFAP', 'rabbit'), primary('Rabbit anti-Iba1', 'rabbit', 'Iba1'), secondary('Goat anti-rabbit IgG', 'goat', 'rabbit')],
    );
    expect(warnings.some((w) => w.code === 'multiplex-same-host')).toBe(false);
  });

  it('suggests Mouse-on-Mouse for a mouse primary on mouse tissue', () => {
    const warnings = checkCrossReactivity([primary('Mouse monoclonal anti-NeuN', 'mouse', 'NeuN')], { tissueSpecies: 'Mouse' });
    expect(warnings).toEqual([
      expect.objectContaining({ code: 'mouse-on-mouse', severity: 'suggestion', itemNames: ['Mouse monoclonal anti-NeuN'] }),
    ]);
  });

  it('does not suggest Mouse-on-Mouse without mouse tissue', () => {
    expect(checkCrossReactivity([primary('Mouse anti-NeuN', 'mouse', 'NeuN')], { tissueSpecies: 'rat' })).toEqual([]);
    expect(checkCrossReactivity([primary('Mouse anti-NeuN', 'mouse', 'NeuN')])).toEqual([]);
  });

  it('warns when an anti-goat secondary is used with a goat serum block', () => {
    const warnings = checkCrossReactivity(
      [primary('Rabbit anti-GFAP', 'rabbit'), secondary('Donkey anti-goat IgG', 'donkey', 'goat')],
      { blockingSerum: 'goat' },
    );
    expect(warnings.filter((w) => w.code === 'serum-block-conflict')).toEqual([
      expect.objectContaining({ severity: 'warning', itemNames: ['Donkey anti-goat IgG'] }),
    ]);
  });

  it('ignores non-antibody items', () => {
    expect(
      checkCrossReactivity([
        { name: 'PBS', kind: 'buffer', hostSpecies: 'mouse' },
        { name: 'Goat serum', kind: 'reagent', target: 'goat' },
      ], { multiplex: true, blockingSerum: 'goat' }),
    ).toEqual([]);
  });
});
