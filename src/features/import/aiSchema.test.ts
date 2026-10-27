import { describe, expect, it } from 'vitest';
import {
  durationToSeconds,
  extractJsonObject,
  findTokenInText,
  mapAiProtocol,
  mergeVariables,
  parseAiProtocol,
  parseWithRetry,
  validateAiProtocol,
} from './aiSchema';
import { detectHazards } from './hazards';

const SOURCE = `Dilute the primary antibody 1:1000 in 10 mL blocking buffer.
Incubate the membrane on a shaker at 4 °C for 1 h.`;

/** A valid protocol object. Tests change one field at a time. */
function protocol(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Antibody dilution',
    category: 'Western Blot',
    objective: 'To dilute the antibody.',
    expectedOutput: '',
    totalTime: { value: 60, unit: 'min', display: '1 h' },
    phases: [],
    materials: [{ name: 'Blocking buffer', kind: 'solution', quantity: '10 mL' }],
    hazards: [],
    steps: [
      {
        step_number: 1,
        phase: null,
        title: 'Dilute the antibody',
        instruction_text: 'Dilute the primary antibody 1:1000 in 10 mL blocking buffer.',
        duration: null,
        variables: [{ name: 'final volume', default_value: 10, unit: 'mL' }],
      },
      {
        step_number: 2,
        phase: null,
        title: 'Incubate on shaker',
        instruction_text: 'Incubate the membrane on a shaker at 4 °C for 1 h.',
        duration: { value: 1, unit: 'hours' },
        variables: [],
      },
    ],
    ...overrides,
  };
}

describe('extractJsonObject', () => {
  it('accepts a bare object, a fenced object and prose around it', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('Here you go: {"a":1} Thanks')).toEqual({ a: 1 });
  });

  it('rejects text with no object', () => {
    expect(() => extractJsonObject('no json here')).toThrow();
  });
});

describe('validateAiProtocol: shape', () => {
  it('accepts a complete valid protocol', () => {
    const r = validateAiProtocol(protocol(), SOURCE);
    expect(r.ok).toBe(true);
  });

  it('rejects a bare array, the old steps-only shape', () => {
    expect(validateAiProtocol(protocol().steps).ok).toBe(false);
  });

  it('rejects a category that is not one of the app categories', () => {
    const r = validateAiProtocol(protocol({ category: 'Chemistry' }), SOURCE);
    expect(r).toMatchObject({ ok: false });
  });

  it('rejects an unknown material kind', () => {
    const r = validateAiProtocol(protocol({ materials: [{ name: 'PBS', kind: 'liquid', quantity: null }] }));
    expect(r.ok).toBe(false);
  });

  it('rejects a phase index that points past the phases list', () => {
    const base = protocol({ phases: [{ name: 'Day 1' }] });
    const steps = [{ ...(base.steps as object[])[0], phase: 3 }];
    expect(validateAiProtocol({ ...base, steps }).ok).toBe(false);
  });

  it('accepts a phase index inside the phases list', () => {
    const base = protocol({ phases: [{ name: 'Day 1' }] });
    const steps = [{ ...(base.steps as object[])[0], phase: 0 }];
    expect(validateAiProtocol({ ...base, steps }).ok).toBe(true);
  });

  it('rejects a step with no title and a step_number that is not an integer', () => {
    const base = protocol();
    expect(validateAiProtocol({ ...base, steps: [{ ...(base.steps as object[])[0], title: '' }] }).ok).toBe(false);
    expect(validateAiProtocol({ ...base, steps: [{ ...(base.steps as object[])[0], step_number: 1.5 }] }).ok).toBe(false);
  });

  it('rejects an empty steps array and a duration with an unknown unit', () => {
    expect(validateAiProtocol(protocol({ steps: [] })).ok).toBe(false);
    const base = protocol();
    const steps = [{ ...(base.steps as object[])[1], duration: { value: 2, unit: 'days' } }];
    expect(validateAiProtocol({ ...base, steps }).ok).toBe(false);
  });
});

describe('validateAiProtocol: hazards and evidence', () => {
  const withHazard = (hazard: Record<string, unknown>, source = SOURCE) =>
    validateAiProtocol(protocol({ hazards: [{ ppe: [], ...hazard }] }), source);

  it('accepts a hazard whose evidence is quoted verbatim from the text', () => {
    const src = 'Add 1 mL of methanol to the gel. Incubate.';
    const r = withHazard({ agent: 'Methanol', type: 'chemical', evidence: 'Add 1 mL of methanol to the gel.' }, src);
    expect(r.ok).toBe(true);
  });

  it('rejects evidence that is not in the text', () => {
    const r = withHazard({ agent: 'Methanol', type: 'chemical', evidence: 'Add methanol to the gel' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not an exact quote/);
  });

  it('rejects an animal hazard when the text names no animals', () => {
    const r = withHazard({ agent: 'Live animals', type: 'animal', evidence: 'Incubate the membrane on a shaker' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no animals/);
  });

  it('accepts an animal hazard when the text names mice', () => {
    const src = 'Anesthetize the mouse with isoflurane.';
    const r = withHazard({ agent: 'Live mice', type: 'animal', evidence: 'Anesthetize the mouse with isoflurane.' }, src);
    expect(r.ok).toBe(true);
  });

  it('does not treat a mouse antibody host as an animal', () => {
    const src = 'Incubate with mouse anti-GFAP overnight.';
    const r = withHazard({ agent: 'Live mice', type: 'animal', evidence: 'Incubate with mouse anti-GFAP overnight.' }, src);
    expect(r.ok).toBe(false);
  });
});

describe('parseAiProtocol and parseWithRetry', () => {
  it('parses model text that wraps the object in a fence', () => {
    const text = '```json\n' + JSON.stringify(protocol()) + '\n```';
    expect(parseAiProtocol(text, SOURCE).ok).toBe(true);
  });

  it('returns a readable error for text that is not JSON', () => {
    const r = parseAiProtocol('Sorry, I cannot help.', SOURCE);
    expect(r).toMatchObject({ ok: false });
  });

  it('retries once with the validation error and returns the second answer', async () => {
    const bad = JSON.stringify(protocol({ category: 'Chemistry' }));
    const good = JSON.stringify(protocol());
    const calls: Array<Array<{ role: string; content: string }>> = [];
    const ask = async (turns: Array<{ role: 'user' | 'assistant'; content: string }>) => {
      calls.push(turns);
      return calls.length === 1 ? bad : good;
    };
    const r = await parseWithRetry(ask, SOURCE);
    expect(r.ok).toBe(true);
    expect(calls).toHaveLength(2);
    const repair = calls[1][calls[1].length - 1];
    expect(repair.role).toBe('user');
    expect(repair.content).toMatch(/category/);
  });

  it('gives up after the second failed answer', async () => {
    let n = 0;
    const ask = async () => {
      n++;
      return JSON.stringify(protocol({ category: 'Nope' }));
    };
    const r = await parseWithRetry(ask, SOURCE);
    expect(r.ok).toBe(false);
    expect(n).toBe(2);
  });

  it('stops without a retry when the model request fails', async () => {
    let n = 0;
    const r = await parseWithRetry(async () => {
      n++;
      return null;
    }, SOURCE);
    expect(r.ok).toBe(false);
    expect(n).toBe(1);
  });
});

describe('durationToSeconds and findTokenInText', () => {
  it('converts minutes, hours and seconds, and returns undefined for no duration', () => {
    expect(durationToSeconds({ value: 2, unit: 'minutes' })).toBe(120);
    expect(durationToSeconds({ value: 1, unit: 'hours' })).toBe(3600);
    expect(durationToSeconds({ value: 30, unit: 'seconds' })).toBe(30);
    expect(durationToSeconds(null)).toBeUndefined();
    expect(durationToSeconds({ value: null, unit: null })).toBeUndefined();
  });

  it('returns the value and unit as written, accepting a micro sign', () => {
    expect(findTokenInText('Add 10 mL buffer', 10, 'mL')).toBe('10 mL');
    expect(findTokenInText('Use 5 µM dye', 5, 'µM')).toBe('5 µM');
    expect(findTokenInText('Use 5 uM dye', 5, 'µM')).toBe('5 uM');
  });

  it('does not match a larger number that contains the value', () => {
    expect(findTokenInText('Add 110 mL buffer', 10, 'mL')).toBeUndefined();
  });
});

describe('mergeVariables', () => {
  it('adds an AI variable that detectVariables did not find, with its name as token when not in the text', () => {
    expect(mergeVariables([{ name: 'stock', default_value: 250, unit: 'mg' }], 'Weigh the powder')).toEqual([
      { id: 'ai1', token: 'stock', value: 250, unit: 'mg', role: 'input' },
    ]);
  });

  it('uses the token written in the text for an AI variable', () => {
    const merged = mergeVariables([{ name: 'buffer', default_value: 250, unit: 'mg' }], 'Weigh 250 mg powder');
    expect(merged[0]).toMatchObject({ token: '250 mg', role: 'input' });
  });
});

describe('mapAiProtocol', () => {
  const checked = (p: Record<string, unknown>, src = SOURCE) => {
    const r = validateAiProtocol(p, src);
    if (!r.ok) throw new Error(`setup: ${r.error}`);
    return mapAiProtocol(r.protocol, src);
  };

  it('maps the full protocol: title, category, overview, steps, durations and materials', () => {
    const draft = checked(protocol());
    expect(draft.title).toBe('Antibody dilution');
    expect(draft.category).toBe('Western Blot');
    expect(draft.parser).toBe('ai');
    expect(draft.overview.objective).toBe('To dilute the antibody.');
    expect(draft.steps).toHaveLength(2);
    expect(draft.steps[1].durationSec).toBe(3600);
    expect(draft.steps[1].timers[0]).toMatchObject({ stepId: draft.steps[1].id, durationSec: 3600, status: 'idle' });
    expect(draft.materials.map((m) => m.name)).toContain('Blocking buffer');
  });

  it('computes the total time from the step durations, with overnight steps as days', () => {
    const draft = checked(
      protocol({
        steps: [
          { step_number: 1, phase: null, title: 'Block', instruction_text: 'Block for 1 h.', duration: { value: 1, unit: 'hours' }, variables: [] },
          { step_number: 2, phase: null, title: 'Incubate overnight', instruction_text: 'Incubate overnight at 4 °C.', duration: { value: 16, unit: 'hours' }, variables: [] },
        ],
      }),
      'Block for 1 h. Incubate overnight at 4 °C.',
    );
    expect(draft.overview.totalTime).toBe('2 days (~1 h hands-on)');
  });

  it('orders steps by step_number and links them to phases', () => {
    const draft = checked(
      protocol({
        phases: [{ name: 'Day 1: Dilution' }, { name: 'Day 2: Incubation' }],
        steps: [
          { ...(protocol().steps as object[])[1], step_number: 2, phase: 1 },
          { ...(protocol().steps as object[])[0], step_number: 1, phase: 0 },
        ],
      }),
    );
    expect(draft.steps.map((s) => s.title)).toEqual(['Dilute the antibody', 'Incubate on shaker']);
    expect(draft.phases.map((p) => p.name)).toEqual(['Day 1: Dilution', 'Day 2: Incubation']);
    expect(draft.steps[0].phaseId).toBe(draft.phases[0].id);
    expect(draft.steps[1].phaseId).toBe(draft.phases[1].id);
  });

  it('keeps only verbatim hazards and gives known agents their rule name and PPE', () => {
    const src = 'Add 1 mL of methanol to the gel.';
    const draft = checked(
      protocol({
        steps: [
          { step_number: 1, phase: null, title: 'Add methanol', instruction_text: src, duration: null, variables: [] },
        ],
        hazards: [{ agent: 'methanol', type: 'chemical', evidence: 'Add 1 mL of methanol to the gel.', ppe: [] }],
      }),
      src,
    );
    expect(draft.hazards).toHaveLength(1);
    expect(draft.hazards[0].evidence).toBe('Add 1 mL of methanol to the gel.');
    expect(draft.hazards[0].ppe.length).toBeGreaterThan(0);
    expect(draft.hazards[0].stepIds).toEqual([draft.steps[0].id]);
    expect(detectHazards(draft.steps).map((h) => h.id)).toContain(draft.hazards[0].id);
  });

  it('uses the default overview objective when the model gave none', () => {
    const draft = checked(protocol({ objective: '', category: 'Other' }));
    expect(draft.overview.objective).toMatch(/^To perform/);
  });
});
