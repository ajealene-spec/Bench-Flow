import { describe, expect, it } from 'vitest';
import type { Hazard } from '../../types';
import { allChecked, buildSafetyChecklist, hazardsForStep, setItemChecked } from './safety';

const acrylamide: Hazard = {
  id: 'h1',
  name: 'Acrylamide',
  kind: 'chemical',
  reason: 'Neurotoxin',
  ppe: ['wear nitrile gloves', 'handle powder in fume hood'],
  stepIds: ['s1'],
};

const uv: Hazard = {
  id: 'h2',
  name: 'UV transilluminator',
  kind: 'radiological',
  reason: 'UV burns eyes and skin',
  ppe: ['Face shield', 'Eye protection', 'Lab coat'],
  stepIds: ['s2'],
};

describe('buildSafetyChecklist', () => {
  it('returns only the baseline PPE when there are no hazards', () => {
    const items = buildSafetyChecklist([]);
    expect(items.map((i) => i.label)).toEqual(['Lab coat', 'Gloves', 'Eye protection']);
    expect(items.every((i) => i.checked === false)).toBe(true);
  });

  it('builds one hazard item with its PPE joined, then deduped PPE items', () => {
    const items = buildSafetyChecklist([acrylamide]);
    expect(items.map((i) => i.label)).toEqual([
      'Lab coat',
      'Gloves',
      'Eye protection',
      'Acrylamide — wear nitrile gloves; handle powder in fume hood',
      'Fume hood available',
    ]);
    expect(items.find((i) => i.itemId === 'hazard:h1')).toBeDefined();
  });

  it('dedupes PPE across hazards and adds extras like face shield', () => {
    const items = buildSafetyChecklist([acrylamide, uv]);
    const labels = items.map((i) => i.label);
    expect(labels.filter((l) => l === 'Eye protection')).toHaveLength(1);
    expect(labels.filter((l) => l === 'Lab coat')).toHaveLength(1);
    expect(labels).toContain('Face shield');
    expect(labels).toContain('UV transilluminator — Face shield; Eye protection; Lab coat');
  });

  it('uses the reason when a hazard has no PPE, and gives item ids unique per item', () => {
    const noPpe: Hazard = { ...uv, id: 'h3', name: 'Ethanol', ppe: [], reason: 'Flammable' };
    const items = buildSafetyChecklist([noPpe]);
    expect(items.find((i) => i.itemId === 'hazard:h3')?.label).toBe('Ethanol — Flammable');
    const ids = items.map((i) => i.itemId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('gate helpers', () => {
  it('cannot begin with no items, and can begin once every item is checked', () => {
    expect(allChecked([])).toBe(false);
    let items = buildSafetyChecklist([acrylamide]);
    expect(allChecked(items)).toBe(false);
    for (const item of items) items = setItemChecked(items, item.itemId, true);
    expect(allChecked(items)).toBe(true);
  });

  it('unchecking one item blocks the gate again', () => {
    let items = buildSafetyChecklist([]).map((i) => ({ ...i, checked: true }));
    items = setItemChecked(items, 'ppe:gloves', false);
    expect(allChecked(items)).toBe(false);
    expect(items.find((i) => i.itemId === 'ppe:gloves')?.checked).toBe(false);
  });

  it('finds hazards for a template step id', () => {
    expect(hazardsForStep([acrylamide, uv], 's1')).toEqual([acrylamide]);
    expect(hazardsForStep([acrylamide, uv], 'nope')).toEqual([]);
    expect(hazardsForStep([acrylamide], undefined)).toEqual([]);
  });
});
