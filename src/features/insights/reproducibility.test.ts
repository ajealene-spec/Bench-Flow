import { describe, expect, it } from 'vitest';
import type { ExecutionEvent } from '../../types';
import { REPRODUCIBILITY_WEIGHTS, scoreReproducibility, type ReproducibilityInput } from './reproducibility';

let n = 0;
function ev(partial: Partial<ExecutionEvent> & Pick<ExecutionEvent, 'type'>): ExecutionEvent {
  n += 1;
  return { id: `e${n}`, experimentId: 'x', at: 1000 + n, ...partial };
}

const STEPS = [
  { id: 's1', title: 'Fix', instructions: 'Fix the tissue' },
  { id: 's2', title: 'Block', instructions: 'Block for 1 h' },
  { id: 's3', title: 'Stain', instructions: 'Add antibody' },
];

function input(overrides: Partial<ReproducibilityInput> = {}): ReproducibilityInput {
  return { steps: STEPS, events: [], reagents: [], animals: [], safetyChecklist: undefined, ...overrides };
}

function component(score: ReturnType<typeof scoreReproducibility>, id: string) {
  const c = score.components.find((x) => x.id === id);
  if (!c) throw new Error(`missing ${id}`);
  return c;
}

describe('scoreReproducibility', () => {
  it('weights sum to 100 so a perfect run scores 100', () => {
    const sum = Object.values(REPRODUCIBILITY_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('gives a fully documented run 100', () => {
    const events = [
      ev({ type: 'step_complete', stepId: 's1' }),
      ev({ type: 'step_complete', stepId: 's2' }),
      ev({ type: 'step_complete', stepId: 's3' }),
      ev({ type: 'timer_stop', stepId: 's2', planned: 3600, actual: 3550 }),
    ];
    const result = scoreReproducibility(
      input({
        events,
        reagents: [{ id: 'r', kind: 'antibody', name: 'Ab', lotNumber: 'L1', rrid: 'RRID:AB_1' }],
        animals: [{ id: 'a', rrid: 'RRID:IMSR_JAX:000664' }],
        safetyChecklist: [{ itemId: 'c', label: 'PPE', checked: true }],
      }),
    );
    expect(result.score).toBe(100);
  });

  it('marks components with nothing to measure as not applicable and leaves them out of the score', () => {
    const events = [
      ev({ type: 'step_complete', stepId: 's1' }),
      ev({ type: 'step_complete', stepId: 's2' }),
      ev({ type: 'step_complete', stepId: 's3' }),
    ];
    const result = scoreReproducibility(input({ events }));
    expect(component(result, 'timerAdherence').fraction).toBeNull();
    expect(component(result, 'reagentLots').fraction).toBeNull();
    expect(component(result, 'rrids').fraction).toBeNull();
    expect(component(result, 'safety').fraction).toBeNull();
    // Only steps, deviations (no deviations means full credit) and methods apply: 20 + 15 + 10 of 45.
    expect(result.score).toBe(100);
  });

  it('returns null when nothing applies, so an empty run is not scored as 60', () => {
    const result = scoreReproducibility({ steps: [], events: [], reagents: [], animals: [] });
    expect(result.score).toBeNull();
  });

  it('scores a run that logged events but has no stored steps from the other components only', () => {
    const result = scoreReproducibility({
      steps: [],
      events: [ev({ type: 'value_change', stepId: 's1', deviation: { kind: 'value', delta: 1 } })],
      reagents: [],
      animals: [],
    });
    // Only the undocumented deviation applies: 0 of 1.
    expect(result.score).toBe(0);
  });

  it('does not credit a step completed out of order', () => {
    const events = [
      ev({ type: 'step_complete', stepId: 's2' }),
      ev({ type: 'step_reorder', stepId: 's2', deviation: { kind: 'order' } }),
      ev({ type: 'step_complete', stepId: 's1' }),
      ev({ type: 'step_complete', stepId: 's3' }),
    ];
    const c = component(scoreReproducibility(input({ events })), 'stepsInOrder');
    expect(c.fraction).toBeCloseTo(2 / 3, 10);
  });

  it('counts skipped steps as not completed', () => {
    const events = [ev({ type: 'step_complete', stepId: 's1' }), ev({ type: 'step_skip', stepId: 's2', deviation: { kind: 'skip' } })];
    const c = component(scoreReproducibility(input({ events })), 'stepsInOrder');
    expect(c.fraction).toBeCloseTo(1 / 3, 10);
  });

  it('applies the 10% timer tolerance at the boundary', () => {
    const events = [
      ev({ type: 'timer_stop', stepId: 's1', planned: 100, actual: 110 }),
      ev({ type: 'timer_stop', stepId: 's1', planned: 100, actual: 111 }),
      ev({ type: 'timer_stop', stepId: 's1', planned: 100, actual: 85 }),
      ev({ type: 'timer_stop', stepId: 's1', planned: 0, actual: 5 }),
    ];
    const c = component(scoreReproducibility(input({ events })), 'timerAdherence');
    expect(c.fraction).toBeCloseTo(1 / 3, 10);
  });

  it('credits deviations that have a note on the same step and penalises undocumented ones', () => {
    const events = [
      ev({ type: 'timer_stop', stepId: 's1', planned: 100, actual: 200, deviation: { kind: 'timer', delta: 100, tolerance: 0.1 } }),
      ev({ type: 'note', stepId: 's1', note: 'Fridge door was open', deviation: { kind: 'note' } }),
      ev({ type: 'value_change', stepId: 's2', planned: 5, actual: 7, deviation: { kind: 'value', delta: 2 } }),
    ];
    // Three deviations: the timer is explained by the note, the note documents itself, the value change has no note.
    const c = component(scoreReproducibility(input({ events })), 'deviationsDocumented');
    expect(c.fraction).toBeCloseTo(2 / 3, 10);
  });

  it('does not count a blank note as documentation', () => {
    const events = [
      ev({ type: 'step_skip', stepId: 's2', deviation: { kind: 'skip' } }),
      ev({ type: 'note', stepId: 's2', note: '   ' }),
    ];
    const c = component(scoreReproducibility(input({ events })), 'deviationsDocumented');
    expect(c.fraction).toBe(0);
  });

  it('scores reagent lots, RRIDs for antibodies and animals, and the safety checklist as fractions', () => {
    const result = scoreReproducibility(
      input({
        reagents: [
          { id: 'a', kind: 'antibody', name: 'A', lotNumber: 'L', rrid: 'RRID:AB_1' },
          { id: 'b', kind: 'antibody', name: 'B', lotNumber: '', rrid: undefined },
          { id: 'c', kind: 'buffer', name: 'PBS', lotNumber: undefined },
        ],
        animals: [{ id: 'm', rrid: '' }],
        safetyChecklist: [
          { itemId: '1', label: 'Gloves', checked: true },
          { itemId: '2', label: 'Fume hood', checked: false },
        ],
      }),
    );
    expect(component(result, 'reagentLots').fraction).toBeCloseTo(1 / 3, 10);
    expect(component(result, 'rrids').fraction).toBeCloseTo(1 / 3, 10);
    expect(component(result, 'safety').fraction).toBeCloseTo(1 / 2, 10);
  });

  it('gives no methods credit when steps lack instructions', () => {
    const result = scoreReproducibility(
      input({ steps: [{ id: 's1', title: 'Fix' }, { id: 's2', title: 'Block', instructions: 'Wait' }] }),
    );
    expect(component(result, 'methods').fraction).toBe(0.5);
  });

  it('is deterministic and rounds to a whole number', () => {
    const a = scoreReproducibility(input({ events: [ev({ type: 'step_complete', stepId: 's1' })] }));
    const b = scoreReproducibility(input({ events: [ev({ type: 'step_complete', stepId: 's1' })] }));
    expect(a).toEqual(b);
    expect(Number.isInteger(a.score)).toBe(true);
  });
});
