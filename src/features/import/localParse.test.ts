import { describe, expect, it } from 'vitest';
import { detectDurations, deriveTitle, parseLocal } from './localParse';

const PCR = `PCR master mix
1. Thaw reagents on ice.
2. Combine 10 µL 2x master mix, 1 µL each primer (10 µM), 2 µL cDNA, and nuclease-free water to 20 µL.
3. Spin down briefly and place in thermocycler.
4. Initial denaturation at 95 °C for 3 min.
5. Cycle 35 times: 95 °C for 30 s, 60 °C for 30 s, 72 °C for 1 min.
6. Final extension at 72 °C for 5 min, then hold at 4 °C.`;

const WESTERN = `- Lyse cells in RIPA buffer for 15 min on ice.
- Centrifuge at 14,000 g for 10 min at 4 °C.
- Load 20 µg protein per lane; run gel at 120 V for 1 h 30 min.
- Transfer to PVDF at 100 V for 1 hr.
- Block membrane in 5% milk for 1 h at RT.
- Incubate with primary antibody overnight at 4 °C.
- Wash 3 x 5 min in TBST.
- Incubate with HRP secondary for 1–2 h at RT.`;

const PERFUSION = `Perfuse animal with ice-cold PBS for 10 min, then 4% PFA for 15 min.
Remove brain and post-fix overnight in PFA.
Caution: PFA is toxic, work in the fume hood.`;

const SLICE_PREP = `Acute slice prep
1. Anesthetize mouse with isoflurane; decapitate.
2. Transfer brain to ice-cold cutting solution (bubbled with 95% O2 / 5% CO2).
   - Cut 300 µm coronal sections on the vibratome.
   - Keep slices in the cutting solution.
3. Recover slices in ACSF at 32 °C for 30 min, then at room temperature for at least 1 h.
Note: slices are light sensitive.`;

describe('parseLocal: numbered protocols', () => {
  it('splits a numbered PCR protocol into steps and keeps the preamble as the title', () => {
    const result = parseLocal(PCR);
    expect(result.title).toBe('PCR master mix');
    expect(result.steps).toHaveLength(6);
    expect(result.steps[0].instructions).toBe('Thaw reagents on ice.');
    expect(result.steps[1].instructions).toContain('Combine 10 µL');
  });

  it('does not treat unit-less numbers or µL/µM amounts as durations', () => {
    const [, combine, spin] = parseLocal(PCR).steps;
    expect(combine.durationSec).toBeUndefined();
    expect(combine.timers).toEqual([]);
    expect(spin.durationSec).toBeUndefined();
  });

  it('turns a single duration into durationSec and a timer', () => {
    const denature = parseLocal(PCR).steps[3];
    expect(denature.durationSec).toBe(180);
    expect(denature.timers).toHaveLength(1);
    expect(denature.timers[0]).toMatchObject({ stepId: denature.id, label: '3 min', durationSec: 180, status: 'idle' });
  });

  it('creates one timer per duration in a multi-phase cycling step', () => {
    const cycle = parseLocal(PCR).steps[4];
    expect(cycle.durationSec).toBe(30);
    expect(cycle.timers.map((t) => t.durationSec)).toEqual([30, 30, 60]);
  });
});

describe('parseLocal: bulleted lab notes', () => {
  it('parses bullets and converts hours, mixed units and overnight', () => {
    const steps = parseLocal(WESTERN).steps;
    expect(steps).toHaveLength(8);

    expect(steps[0].durationSec).toBe(900);
    expect(steps[1].durationSec).toBe(600);
    expect(steps[2].durationSec).toBe(5400); // "1 h 30 min" is one duration
    expect(steps[2].timers).toHaveLength(1);
    expect(steps[2].timers[0].label).toBe('1 h 30 min');
    expect(steps[3].durationSec).toBe(3600); // "1 hr"
    expect(steps[5].durationSec).toBe(16 * 3600); // overnight
    expect(steps[5].timers[0].label.toLowerCase()).toBe('overnight');
    expect(steps[6].durationSec).toBe(300); // "3 x 5 min"
  });

  it('uses the upper bound of a range so the timer never ends early', () => {
    expect(parseLocal(WESTERN).steps[7].durationSec).toBe(7200);
  });

  it('does not count molar or volume units as durations', () => {
    const [step] = parseLocal('- Add 10 mM Tris, 5 mL water and 20 µL enzyme').steps;
    expect(step.durationSec).toBeUndefined();
    expect(step.timers).toEqual([]);
  });
});

describe('parseLocal: messy notes and nested sub-bullets', () => {
  it('treats each line of unlisted notes as its own step', () => {
    const result = parseLocal(PERFUSION);
    expect(result.title).toBeUndefined();
    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].title.startsWith('Perfuse animal')).toBe(true);
    expect(result.steps[0].timers.map((t) => t.durationSec)).toEqual([600, 900]);
    expect(result.steps[0].durationSec).toBe(600);
    expect(result.steps[1].durationSec).toBe(16 * 3600);
  });

  it('flags caution sentences', () => {
    const caution = parseLocal(PERFUSION).steps[2];
    expect(caution.cautions).toEqual(['Caution: PFA is toxic, work in the fume hood.']);
    expect(parseLocal(PERFUSION).steps[0].cautions).toEqual([]);
  });

  it('folds indented sub-bullets and continuation lines into the step above', () => {
    const result = parseLocal(SLICE_PREP);
    expect(result.title).toBe('Acute slice prep');
    expect(result.steps).toHaveLength(3);
    expect(result.steps[1].instructions).toContain('Cut 300 µm coronal sections');
    expect(result.steps[1].instructions).toContain('Keep slices in the cutting solution.');
    expect(result.steps[2].instructions).toContain('Note: slices are light sensitive.');
  });

  it('keeps a multi-duration recovery step as separate timers', () => {
    const recover = parseLocal(SLICE_PREP).steps[2];
    expect(recover.timers.map((t) => t.durationSec)).toEqual([1800, 3600]);
    expect(recover.durationSec).toBe(1800);
  });

  it('does not treat a decimal quantity at line start as a list item', () => {
    const result = parseLocal('1.5 mL of buffer\n2. Add water');
    expect(result.title).toBe('1.5 mL of buffer');
    expect(result.steps.map((s) => s.instructions)).toEqual(['Add water']);
  });

  it('returns no steps for empty input and gives every step a unique id', () => {
    expect(parseLocal('   \n\n  ').steps).toEqual([]);
    const ids = parseLocal(WESTERN).steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('detectDurations', () => {
  it('reads seconds, minutes and hours in common spellings', () => {
    expect(detectDurations('spin 30 s')[0].seconds).toBe(30);
    expect(detectDurations('wait 2 min')[0].seconds).toBe(120);
    expect(detectDurations('wait 2 minutes')[0].seconds).toBe(120);
    expect(detectDurations('wait 1 h')[0].seconds).toBe(3600);
    expect(detectDurations('wait 1 hour')[0].seconds).toBe(3600);
  });

  it('returns each separate duration in order', () => {
    expect(detectDurations('at 37 °C for 2 h, then 4 °C for 1 h')).toEqual([
      { seconds: 7200, label: '2 h' },
      { seconds: 3600, label: '1 h' },
    ]);
  });

  it('ignores text without durations', () => {
    expect(detectDurations('Add 10 mM Tris, 5 mL water, 20 µL enzyme')).toEqual([]);
  });
});

describe('deriveTitle', () => {
  it('uses the text before a colon when it is short', () => {
    expect(deriveTitle('Add 10 µL: mix well')).toBe('Add 10 µL');
  });

  it('uses the first sentence when it fits', () => {
    expect(deriveTitle('Spin at 500 g. Then discard supernatant.')).toBe('Spin at 500 g');
  });

  it('trims long text at a word boundary', () => {
    const title = deriveTitle(
      'Carefully transfer the entire sample volume into the prepared microcentrifuge tubes labelled with the animal ID',
    );
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(61);
  });
});
