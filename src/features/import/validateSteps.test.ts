import { describe, expect, it } from 'vitest';
import { extractJson, validateParsedProcedure } from './validateSteps';

describe('extractJson', () => {
  it('reads a bare JSON object', () => {
    expect(extractJson('{"steps":[]}')).toEqual({ steps: [] });
  });

  it('reads JSON wrapped in a code fence with prose around it', () => {
    const text = 'Here you go:\n```json\n{"title":"PCR","steps":[{"title":"Thaw"}]}\n```\nDone.';
    expect(extractJson(text)).toMatchObject({ title: 'PCR' });
  });

  it('throws when there is no object', () => {
    expect(() => extractJson('I cannot help with that.')).toThrow();
  });
});

describe('validateParsedProcedure', () => {
  it('turns a model response into Step objects with ids and idle timers', () => {
    const result = validateParsedProcedure({
      title: 'Western blot',
      steps: [
        {
          title: 'Block membrane',
          instructions: 'Block in 5% milk for 1 h at RT.',
          durationSec: 3600,
          timers: [{ label: 'Block', durationSec: 3600 }],
          reagents: [{ name: 'Skim milk', amount: '5', unit: '%' }],
          dataFields: [{ label: 'Band intensity', unit: 'AU', type: 'number' }],
          cautions: ['Wear gloves'],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.title).toBe('Western blot');
    const [step] = result.steps;
    expect(step.id).toBeTruthy();
    expect(step.durationSec).toBe(3600);
    expect(step.timers[0]).toMatchObject({ stepId: step.id, label: 'Block', durationSec: 3600, status: 'idle' });
    expect(step.reagents).toEqual([{ name: 'Skim milk', amount: '5', unit: '%' }]);
    expect(step.dataFields[0]).toMatchObject({ label: 'Band intensity', unit: 'AU', type: 'number' });
    expect(step.cautions).toEqual(['Wear gloves']);
  });

  it('fills defaults and drops malformed optional items', () => {
    const result = validateParsedProcedure({
      steps: [
        {
          title: 'Spin',
          durationSec: -5,
          timers: [{ durationSec: 'ten' }, { durationSec: 60 }, 'bad'],
          reagents: [{ amount: 2 }, { name: 'Ethanol' }],
          dataFields: [{ label: 'Weight', type: 'weird' }],
          cautions: ['', 42, 'Use a centrifuge balance'],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [step] = result.steps;
    expect(step.instructions).toBe('');
    expect(step.durationSec).toBeUndefined();
    expect(step.timers.map((t) => [t.label, t.durationSec])).toEqual([['Timer', 60]]);
    expect(step.reagents).toEqual([{ name: 'Ethanol', amount: undefined, unit: undefined }]);
    expect(step.dataFields[0].type).toBe('text');
    expect(step.cautions).toEqual(['Use a centrifuge balance']);
  });

  it('rejects output without steps, without titles, or with no steps', () => {
    expect(validateParsedProcedure({ title: 'x' }).ok).toBe(false);
    expect(validateParsedProcedure({ steps: [] }).ok).toBe(false);
    expect(validateParsedProcedure({ steps: [{ instructions: 'no title' }] })).toEqual({
      ok: false,
      error: 'Step 1 has no title',
    });
    expect(validateParsedProcedure(null).ok).toBe(false);
  });
});
