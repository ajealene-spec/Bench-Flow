import { describe, expect, it } from 'vitest';
import type { Reagent, Step } from '../../types';
import { extractReagents, normalizeConjugate, toInventoryInput } from './extractReagents';

const step = (id: string, instructions: string, reagents: Reagent[] = []): Pick<Step, 'id' | 'instructions' | 'reagents'> => ({
  id,
  instructions,
  reagents,
});

describe('extractReagents antibodies', () => {
  it('reads a primary with host, target and dilution', () => {
    const [item] = extractReagents([step('s1', 'Incubate overnight with rabbit anti-GFAP (1:1000) at 4 °C.')]);
    expect(item).toEqual({
      name: 'Rabbit anti-GFAP',
      kind: 'antibody',
      hostSpecies: 'rabbit',
      target: 'GFAP',
      stockDilution: '1:1000',
      stepIds: ['s1'],
    });
  });

  it('reads a secondary whose target is a species, with isotype and HRP conjugate', () => {
    const [item] = extractReagents([step('s2', 'Add goat anti-rabbit IgG-HRP, 1:2000, for 1 h.')]);
    expect(item).toMatchObject({
      name: 'Goat anti-rabbit IgG (HRP)',
      kind: 'antibody',
      hostSpecies: 'goat',
      target: 'rabbit',
      isotype: 'IgG',
      conjugate: 'HRP',
      stockDilution: '1:2000',
    });
  });

  it('reads a mouse monoclonal with no named target', () => {
    const [item] = extractReagents([step('s1', 'Use a mouse monoclonal antibody overnight.')]);
    expect(item).toMatchObject({ name: 'Mouse monoclonal antibody', kind: 'antibody', hostSpecies: 'mouse' });
    expect(item.target).toBeUndefined();
  });

  it('reads a fluorescent secondary conjugate', () => {
    const [item] = extractReagents([step('s1', 'Add donkey anti-mouse Alexa Fluor 488 for 1 h.')]);
    expect(item).toMatchObject({ name: 'Donkey anti-mouse (Alexa Fluor 488)', hostSpecies: 'donkey', target: 'mouse', conjugate: 'Alexa Fluor 488' });
  });

  it('does not read "anti-fade" or "antibiotic" as antibodies', () => {
    expect(extractReagents([step('s1', 'Mount with anti-fade medium. Add antibiotic.')])).toEqual([]);
  });

  it('merges the same antibody across steps and lists both step ids', () => {
    const items = extractReagents([
      step('s1', 'Incubate with rabbit anti-GFAP (1:1000).'),
      step('s2', 'Wash, then rabbit anti-GFAP for 2 h.'),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].stepIds).toEqual(['s1', 's2']);
  });

  it('keeps lot and catalog numbers from the same sentence', () => {
    const [item] = extractReagents([
      step('s1', 'Add rabbit anti-GFAP (1:500), lot #12345, cat. no. AB-9981, reactive with human, mouse.'),
    ]);
    expect(item).toMatchObject({
      lotNumber: '12345',
      catalogNumber: 'AB-9981',
      reactivity: ['human', 'mouse'],
    });
  });

  it('reads "Lot: AB123" with a colon', () => {
    const [item] = extractReagents([step('s1', 'Use rabbit anti-Iba1 (Lot: AB123).')]);
    expect(item.lotNumber).toBe('AB123');
  });

  it('does not take a lot from a sentence with two antibodies', () => {
    const items = extractReagents([step('s1', 'Rabbit anti-GFAP (lot 111) and goat anti-rabbit IgG-HRP (lot 222).')]);
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.lotNumber === undefined)).toBe(true);
  });

  it('reads a vendor given with a colon', () => {
    const [item] = extractReagents([step('s1', 'Add rabbit anti-GFAP (vendor: Abcam).')]);
    expect(item.vendor).toBe('Abcam');
  });
});

describe('extractReagents reagents, buffers and kits', () => {
  it('reads a structured reagent with a concentration unit', () => {
    const [item] = extractReagents([
      step('s1', 'Prepare the solution.', [{ name: 'Sodium chloride', amount: '150', unit: 'mM' }]),
    ]);
    expect(item).toEqual({ name: 'Sodium chloride', kind: 'reagent', concentration: '150 mM', stepIds: ['s1'] });
  });

  it('keeps a mass amount out of the concentration field', () => {
    const [item] = extractReagents([step('s1', '', [{ name: 'Agarose', amount: '2', unit: 'g' }])]);
    expect(item.concentration).toBeUndefined();
  });

  it('classifies buffers and kits', () => {
    const items = extractReagents([
      step('s1', '', [
        { name: 'PBS', amount: '', unit: '' },
        { name: 'ECL detection kit', amount: '', unit: '' },
      ]),
    ]);
    expect(items.map((i) => [i.name, i.kind])).toEqual([
      ['PBS', 'buffer'],
      ['ECL detection kit', 'kit'],
    ]);
  });

  it('pulls a lot out of a structured reagent name', () => {
    const [item] = extractReagents([step('s1', '', [{ name: 'Triton X-100, lot #55501', amount: '', unit: '' }])]);
    expect(item).toMatchObject({ name: 'Triton X-100', lotNumber: '55501' });
  });

  it('returns nothing for an empty protocol', () => {
    expect(extractReagents([])).toEqual([]);
  });
});

describe('normalizeConjugate and toInventoryInput', () => {
  it('normalizes common conjugate spellings', () => {
    expect(normalizeConjugate('horseradish peroxidase')).toBe('HRP');
    expect(normalizeConjugate('alexa fluor 594')).toBe('Alexa Fluor 594');
    expect(normalizeConjugate('Cy5')).toBe('Cy5');
    expect(normalizeConjugate('alkaline phosphatase')).toBe('AP');
  });

  it('drops step ids when converting to inventory input', () => {
    const [item] = extractReagents([step('s1', 'Rabbit anti-GFAP (1:1000).')]);
    const input = toInventoryInput(item);
    expect(input).not.toHaveProperty('stepIds');
    expect(input.name).toBe('Rabbit anti-GFAP');
  });
});
