import { describe, expect, it } from 'vitest';
import { cleanStepTitle, deriveTitle, parseLocal, TITLE_MAX } from './localParse';
import { clipForModel, MAX_MODEL_INPUT_CHARS, SYSTEM_PROMPT } from './parsePrompt';
import { validateParsedProcedure } from './validateSteps';

describe('step titles never come from a caution or note label', () => {
  it('skips a leading Caution label and titles from the action', () => {
    expect(deriveTitle('Caution: Wear gloves. Incubate 20 min on ice.')).toBe('Incubate 20 min on ice');
  });

  it('does not cut the title at the colon after Caution', () => {
    expect(deriveTitle('Caution: PFA is toxic.')).toBe('PFA is toxic');
  });

  it('skips a Note label the same way', () => {
    expect(deriveTitle('Note: slices are light sensitive. Recover in ACSF at 32 °C for 30 min.')).toBe(
      'Recover in ACSF at 32 °C for 30 min',
    );
    expect(deriveTitle('Note: Slices are light sensitive.')).toBe('Slices are light sensitive');
  });

  it('never produces a title of just "Caution" or "Note" from parsed text', () => {
    const steps = parseLocal(
      ['Procedure', '1. Caution: PFA is toxic, work in the fume hood.', '2. Note: keep the lid closed.'].join('\n'),
    ).steps;
    expect(steps.map((s) => s.title)).not.toContain('Caution');
    expect(steps.map((s) => s.title)).not.toContain('Note');
    expect(steps[0].cautions).toEqual(['Caution: PFA is toxic, work in the fume hood.']);
    expect(steps[1].cautions).toEqual(['Note: keep the lid closed.']);
  });

  it('keeps a caution sentence in cautions[] rather than in the title', () => {
    const [step] = parseLocal('- Add 10 mL methanol to the gel. Caution: methanol is flammable.').steps;
    expect(step.title).toBe('Add 10 mL methanol to the gel');
    expect(step.cautions).toEqual(['Caution: methanol is flammable.']);
  });
});

describe('title length and cleanup', () => {
  it('cuts a long first clause at a word boundary within the limit', () => {
    const title = deriveTitle(
      'Carefully transfer the entire sample volume into the prepared microcentrifuge tubes labelled with the animal ID',
    );
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(title).not.toMatch(/\s…$/);
  });

  it('keeps the group prefix inside the limit', () => {
    const title = deriveTitle(
      'Carefully transfer the entire sample volume into the prepared microcentrifuge tubes labelled with the animal ID',
      'Sample preparation',
    );
    expect(title.startsWith('Sample preparation: Carefully')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it('cleanStepTitle strips a caution label and clamps long AI titles', () => {
    expect(cleanStepTitle('Caution: Wear gloves')).toBe('Wear gloves');
    const long = cleanStepTitle('Transfer the membrane into the cassette with the sponge and roller in cold transfer buffer for the run');
    expect(long.length).toBeLessThanOrEqual(TITLE_MAX);
  });

  it('applies the same cleanup to titles returned by the AI parser', () => {
    const result = validateParsedProcedure({
      title: 'Western blot from lysate',
      steps: [{ title: 'Note: Keep lysates cold', instructions: 'Keep lysates on ice at all times.', timers: [] }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.steps[0].title).toBe('Keep lysates cold');
  });
});

describe('AI input limits and prompt', () => {
  it('clips long input to the model limit and keeps the start', () => {
    const long = 'a'.repeat(MAX_MODEL_INPUT_CHARS + 500);
    expect(clipForModel(long)).toHaveLength(MAX_MODEL_INPUT_CHARS);
    expect(clipForModel('short text')).toBe('short text');
  });

  it('asks for timers, cautions and data fields and forbids caution titles', () => {
    expect(SYSTEM_PROMPT).toMatch(/timers/);
    expect(SYSTEM_PROMPT).toMatch(/cautions/);
    expect(SYSTEM_PROMPT).toMatch(/dataFields/);
    expect(SYSTEM_PROMPT).toMatch(/never start with "Caution"/);
    expect(SYSTEM_PROMPT).toMatch(/Skip introductions/);
  });
});
