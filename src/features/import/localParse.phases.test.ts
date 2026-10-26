import { describe, expect, it } from 'vitest';
import { detectMaterials, parseLocal } from './localParse';

const TEXT = `Western blot protocol

Procedure
Day 1: Cell lysis
1. Lyse cells in RIPA buffer on ice for 30 min.
2. Clear the lysate by centrifuge at 14000 g for 10 min.
Day 2: Transfer and detection
1. Transfer proteins to a PVDF membrane using the transfer apparatus for 1 h.
2. Block the membrane in 5% milk for 1 h.
`;

describe('phase detection', () => {
  it('turns Day N headings into phases and assigns the steps under each one', () => {
    const result = parseLocal(TEXT);
    expect(result.phases?.map((p) => p.name)).toEqual(['Day 1: Cell lysis', 'Day 2: Transfer and detection']);

    const [day1, day2] = result.phases ?? [];
    expect(result.steps).toHaveLength(4);
    expect(result.steps.map((s) => s.phaseId)).toEqual([day1.id, day1.id, day2.id, day2.id]);
  });

  it('does not turn a sentence that starts with Day or Phase into a heading', () => {
    const result = parseLocal('Procedure\n1. Phase the samples gently.\nDay 1 of the study ends here.\n2. Wash twice.');
    expect(result.phases).toBeUndefined();
    expect(result.steps.map((s) => s.title)).not.toContainEqual(expect.stringMatching(/^Day 1/));
  });

  it('leaves steps before the first phase heading without a phaseId', () => {
    const result = parseLocal('Procedure\n1. Prepare buffers.\nPhase 1\n2. Mix the sample.');
    expect(result.steps[0].phaseId).toBeUndefined();
    expect(result.steps[1].phaseId).toBe(result.phases?.[0].id);
  });

  it('returns no phases for plain text', () => {
    const result = parseLocal('Procedure\n1. Mix the sample.\n2. Spin it down.');
    expect(result.phases).toBeUndefined();
  });
});

describe('material detection', () => {
  it('collects equipment, consumables and buffers, merged case-insensitively', () => {
    const materials = detectMaterials(TEXT);
    const names = materials.map((m) => m.name);
    expect(names).toEqual(expect.arrayContaining(['Transfer apparatus', 'Membrane', 'Centrifuge', 'RIPA buffer']));
    expect(materials.find((m) => m.name === 'Membrane')?.kind).toBe('consumable');
    expect(materials.find((m) => m.name === 'Transfer apparatus')?.kind).toBe('equipment');
    expect(materials.find((m) => m.name === 'RIPA buffer')?.kind).toBe('solution');
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
  });

  it('is exposed on the parse result when found', () => {
    expect(parseLocal(TEXT).materials?.length).toBeGreaterThan(0);
    expect(parseLocal('Procedure\n1. Mix.').materials).toBeUndefined();
  });
});
