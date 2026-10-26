import { describe, expect, it } from 'vitest';
import {
  durationToSeconds,
  extractJsonArray,
  findTokenInText,
  mapAiSteps,
  mergeVariables,
  parseAiSteps,
  validateAiSteps,
} from './aiSchema';
import { detectHazards } from './hazards';

const good = [
  {
    step_number: 1,
    title: 'Dilute the antibody',
    instruction_text: 'Dilute the primary antibody 1:1000 in 10 mL blocking buffer',
    variables: [{ name: 'final volume', default_value: 10, unit: 'mL' }],
    duration: { value: null, unit: null },
  },
  {
    step_number: 2,
    title: 'Incubate on shaker',
    instruction_text: 'Incubate the membrane on a shaker at 4 °C',
    variables: [],
    duration: { value: 1, unit: 'hours' },
  },
];
const json = JSON.stringify(good);

describe('parseAiSteps: fences and leading text', () => {
  it('accepts a bare JSON array', () => {
    const r = parseAiSteps(json);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.steps).toHaveLength(2);
  });

  it('accepts a ```json fence', () => {
    expect(parseAiSteps('```json\n' + json + '\n```').ok).toBe(true);
  });

  it('accepts a bare fence with no language tag', () => {
    expect(parseAiSteps('```\n' + json + '\n```').ok).toBe(true);
  });

  it('accepts leading and trailing prose around the array', () => {
    expect(parseAiSteps('Here are the steps:\n' + json + '\nHope this helps.').ok).toBe(true);
  });

  it('rejects text with no array', () => {
    expect(parseAiSteps('Sorry, I cannot help.')).toEqual({ ok: false, error: 'Model output is not a JSON array' });
  });

  it('rejects an object instead of an array', () => {
    expect(parseAiSteps('{"steps": []}')).toEqual({ ok: false, error: 'Model output is not a JSON array' });
  });

  it('extractJsonArray returns the parsed array', () => {
    expect(extractJsonArray('x ```json [1,2] ``` y')).toEqual([1, 2]);
  });
});

describe('validateAiSteps: bad shapes', () => {
  it('rejects an empty array', () => {
    expect(validateAiSteps([])).toEqual({ ok: false, error: 'No steps found' });
  });

  it('rejects a non-integer step_number with the step index', () => {
    const r = validateAiSteps([{ ...good[0], step_number: 1.5 }]);
    expect(r).toEqual({ ok: false, error: 'Step 1 "step_number" must be a positive integer' });
  });

  it('rejects an empty title', () => {
    const r = validateAiSteps([{ ...good[0], title: '   ' }]);
    expect(r).toEqual({ ok: false, error: 'Step 1 needs a non-empty "title"' });
  });

  it('rejects a missing instruction_text', () => {
    const { instruction_text: _omit, ...rest } = good[1];
    const r = validateAiSteps([good[0], rest]);
    expect(r).toEqual({ ok: false, error: 'Step 2 needs a non-empty "instruction_text"' });
  });

  it('rejects a variable with a string default_value', () => {
    const r = validateAiSteps([{ ...good[0], variables: [{ name: 'x', default_value: '10', unit: 'mL' }] }]);
    expect(r).toEqual({ ok: false, error: 'Step 1 variable 1 "default_value" must be a number' });
  });

  it('rejects a variables field that is not an array', () => {
    const r = validateAiSteps([{ ...good[0], variables: 'none' }]);
    expect(r).toEqual({ ok: false, error: 'Step 1 "variables" must be an array' });
  });

  it('rejects an unknown duration unit', () => {
    const r = validateAiSteps([{ ...good[0], duration: { value: 5, unit: 'days' } }]);
    expect(r).toEqual({ ok: false, error: 'Step 1 "duration.unit" must be "seconds", "minutes" or "hours"' });
  });

  it('rejects a value without a unit', () => {
    const r = validateAiSteps([{ ...good[0], duration: { value: 5, unit: null } }]);
    expect(r.ok).toBe(false);
  });

  it('rejects a non-object step', () => {
    expect(validateAiSteps(['step'])).toEqual({ ok: false, error: 'Step 1 is not an object' });
  });
});

describe('null duration', () => {
  it('accepts {value: null, unit: null} as no duration', () => {
    const r = validateAiSteps([good[0]]);
    expect(r.ok && r.steps[0].duration).toEqual({ value: null, unit: null });
  });

  it('accepts a missing duration as no duration', () => {
    const { duration: _omit, ...rest } = good[0];
    const r = validateAiSteps([rest]);
    expect(r.ok && r.steps[0].duration).toEqual({ value: null, unit: null });
  });

  it('accepts duration: null as no duration', () => {
    const r = validateAiSteps([{ ...good[0], duration: null }]);
    expect(r.ok).toBe(true);
  });

  it('durationToSeconds returns undefined for null', () => {
    expect(durationToSeconds({ value: null, unit: null })).toBeUndefined();
  });
});

describe('durationToSeconds', () => {
  it('converts minutes, hours and seconds', () => {
    expect(durationToSeconds({ value: 10, unit: 'minutes' })).toBe(600);
    expect(durationToSeconds({ value: 1, unit: 'hours' })).toBe(3600);
    expect(durationToSeconds({ value: 45, unit: 'seconds' })).toBe(45);
    expect(durationToSeconds({ value: 1.5, unit: 'minutes' })).toBe(90);
  });
});

describe('findTokenInText', () => {
  it('returns the value and unit as written', () => {
    expect(findTokenInText('Add 10 mL of buffer', 10, 'mL')).toBe('10 mL');
  });

  it('accepts a micro sign or plain u for micro units', () => {
    expect(findTokenInText('Load 5 uL sample', 5, 'µL')).toBe('5 uL');
    expect(findTokenInText('Load 5 µL sample', 5, 'µL')).toBe('5 µL');
  });

  it('does not match a larger number that contains the value', () => {
    expect(findTokenInText('Use 100 mL', 10, 'mL')).toBeUndefined();
  });

  it('returns undefined when the text does not state it', () => {
    expect(findTokenInText('Add buffer', 10, 'mL')).toBeUndefined();
  });
});

describe('mapAiSteps', () => {
  const text = 'Dilute the primary antibody 1:1000 in 10 mL blocking buffer';

  it('maps title, instruction text and duration in seconds', () => {
    const r = validateAiSteps(good);
    if (!r.ok) throw new Error('setup');
    const steps = mapAiSteps(r.steps);
    expect(steps).toHaveLength(2);
    expect(steps[0].title).toBe('Dilute the antibody');
    expect(steps[0].instructions).toBe(good[0].instruction_text);
    expect(steps[0].durationSec).toBeUndefined();
    expect(steps[0].timers).toEqual([]);
    expect(steps[1].durationSec).toBe(3600);
    expect(steps[1].timers).toHaveLength(1);
    expect(steps[1].timers[0]).toMatchObject({ stepId: steps[1].id, durationSec: 3600, status: 'idle' });
  });

  it('orders steps by step_number', () => {
    const r = validateAiSteps([good[1], good[0]]);
    if (!r.ok) throw new Error('setup');
    const steps = mapAiSteps(r.steps);
    expect(steps.map((s) => s.title)).toEqual(['Dilute the antibody', 'Incubate on shaker']);
  });

  it('turns variables into input StepVariables with the text token and detectVariables formulas kept', () => {
    const r = validateAiSteps([
      {
        ...good[0],
        instruction_text: text,
        variables: [{ name: 'final volume', default_value: 10, unit: 'mL' }],
      },
    ]);
    if (!r.ok) throw new Error('setup');
    const [step] = mapAiSteps(r.steps);
    const vars = step.variables ?? [];
    // detectVariables finds 1:1000 and 10 mL and derives the antibody volume from them.
    const derived = vars.filter((v) => v.role === 'derived');
    expect(derived.length).toBeGreaterThan(0);
    for (const d of derived) {
      const refs = (d.formula ?? '').match(/\b[qdna]\d+\b/g) ?? [];
      for (const ref of refs) expect(vars.some((v) => v.id === ref)).toBe(true);
    }
    // The 10 mL the model listed is the same as the one detectVariables found, so it is not duplicated.
    expect(vars.filter((v) => v.role === 'input' && v.value === 10 && v.unit === 'mL')).toHaveLength(1);
  });

  it('adds an AI variable that detectVariables did not find, with its name as token when not in the text', () => {
    const merged = mergeVariables([{ name: 'stock', default_value: 250, unit: 'mg' }], 'Weigh the powder');
    expect(merged).toEqual([
      { id: 'ai1', token: 'stock', value: 250, unit: 'mg', role: 'input' },
    ]);
  });

  it('uses the token written in the text for an AI variable', () => {
    const merged = mergeVariables([{ name: 'buffer', default_value: 250, unit: 'mg' }], 'Weigh 250 mg powder');
    expect(merged[0]).toMatchObject({ token: '250 mg', role: 'input' });
  });

  it('a step with no variables has no variables field', () => {
    const r = validateAiSteps([good[1]]);
    if (!r.ok) throw new Error('setup');
    expect(mapAiSteps(r.steps)[0].variables).toBeUndefined();
  });

  it('hazard rules still run on mapped step text', () => {
    const r = validateAiSteps([
      { ...good[0], instruction_text: 'Add 1 mL of methanol to the gel' },
    ]);
    if (!r.ok) throw new Error('setup');
    const steps = mapAiSteps(r.steps);
    expect(detectHazards(steps).length).toBeGreaterThan(0);
  });
});
