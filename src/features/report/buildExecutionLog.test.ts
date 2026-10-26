import { describe, expect, it } from 'vitest';
import type { ExecutionEvent, RunValue, Step } from '../../types';
import { buildExecutionLog } from './buildExecutionLog';

const MIN = 60_000;
const T0 = 1_000_000;

const steps: Step[] = [
  { id: 's1', title: 'Block membranes', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] },
  {
    id: 's2',
    title: 'Primary antibody',
    instructions: '',
    timers: [],
    reagents: [],
    dataFields: [],
    cautions: [],
    variables: [{ id: 'vol', token: 'Volume', value: 10, unit: 'mL', role: 'input' }],
  },
  { id: 's3', title: 'Wash', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] },
];

function ev(partial: Partial<ExecutionEvent> & Pick<ExecutionEvent, 'type' | 'at'>): ExecutionEvent {
  return { id: `${partial.type}-${partial.at}-${partial.stepId ?? ''}`, experimentId: 'exp-1', ...partial };
}

const events: ExecutionEvent[] = [
  ev({ type: 'step_start', stepId: 's1', at: T0 }),
  ev({ type: 'timer_start', stepId: 's1', note: 'Block', planned: 3600, unit: 's', at: T0 + MIN }),
  ev({ type: 'timer_stop', stepId: 's1', note: 'Block', planned: 3600, actual: 3720, unit: 's', at: T0 + MIN + 3720_000 }),
  ev({ type: 'step_complete', stepId: 's1', at: T0 + 64 * MIN }),
  ev({ type: 'step_start', stepId: 's2', at: T0 + 65 * MIN }),
  ev({
    type: 'value_change',
    stepId: 's2',
    note: 'Volume',
    planned: 10,
    actual: 15,
    unit: 'mL',
    at: T0 + 66 * MIN,
    deviation: { kind: 'value', delta: 5 },
  }),
  ev({ type: 'phase_pause', phaseId: 'p1', note: 'Day 1 complete', at: T0 + 70 * MIN }),
  ev({ type: 'phase_resume', phaseId: 'p1', actual: 90 * MIN, unit: 'ms', at: T0 + 70 * MIN + 90 * MIN }),
  ev({ type: 'step_start', stepId: 's3', at: T0 + 170 * MIN }),
  ev({ type: 'step_reorder', stepId: 's3', at: T0 + 171 * MIN, deviation: { kind: 'order' } }),
  ev({ type: 'step_skip', stepId: 's2', at: T0 + 172 * MIN, deviation: { kind: 'skip' } }),
  ev({ type: 'note', stepId: 's3', note: 'Bubble in well 4', at: T0 + 173 * MIN, deviation: { kind: 'note' } }),
  ev({ type: 'step_complete', stepId: 's3', at: T0 + 174 * MIN }),
];

const runValues: RunValue[] = [{ experimentId: 'exp-1', stepId: 's2', varId: 'vol', value: 15, unit: 'mL', editedAt: T0 }];

describe('buildExecutionLog timeline', () => {
  it('returns steps in procedure order with actual start and end times', () => {
    const log = buildExecutionLog({ id: 'exp-1' }, steps, events, runValues);
    expect(log.steps.map((s) => s.stepId)).toEqual(['s1', 's2', 's3']);
    expect(log.steps[0]).toMatchObject({ startedAt: T0, endedAt: T0 + 64 * MIN, completed: true });
    expect(log.steps[0].timers[0]).toMatchObject({ label: 'Block', plannedSec: 3600, actualSec: 3720 });
  });

  it('sorts out-of-order input by time and keeps a timeline entry per event', () => {
    const log = buildExecutionLog({ id: 'exp-1' }, steps, [...events].reverse(), runValues);
    expect(log.timeline).toHaveLength(events.length);
    const times = log.timeline.map((t) => t.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe('buildExecutionLog deviations', () => {
  it('lists skips, reorders, notes, value overrides and flagged timers', () => {
    const log = buildExecutionLog({ id: 'exp-1' }, steps, events, runValues);
    const kinds = log.deviations.map((d) => d.kind);
    expect(kinds).toEqual(expect.arrayContaining(['value', 'order', 'skip', 'note']));
    expect(log.deviations.find((d) => d.kind === 'skip')).toMatchObject({ stepNumber: 2 });
    expect(log.deviations.find((d) => d.kind === 'value')?.message).toContain('15 mL');
  });

  it('flags a timer only when the event carries a timer deviation', () => {
    const flagged = [
      ev({ type: 'timer_start', stepId: 's3', note: 'Wash', planned: 600, unit: 's', at: T0 }),
      ev({
        type: 'timer_stop',
        stepId: 's3',
        note: 'Wash',
        planned: 600,
        actual: 900,
        unit: 's',
        at: T0 + 900_000,
        deviation: { kind: 'timer', delta: 300, tolerance: 0.1 },
      }),
    ];
    const log = buildExecutionLog({ id: 'exp-1' }, steps, flagged, []);
    expect(log.deviations).toEqual([expect.objectContaining({ kind: 'timer', stepNumber: 3 })]);
    expect(log.deviations[0].message).toContain('planned 10 min');
  });
});

describe('buildExecutionLog pause gap', () => {
  it('reports the gap from the resume event for the phase', () => {
    const log = buildExecutionLog({ id: 'exp-1' }, steps, events, runValues);
    expect(log.pauses).toEqual([{ phaseId: 'p1', pausedAt: T0 + 70 * MIN, resumedAt: T0 + 160 * MIN, gapMs: 90 * MIN }]);
  });

  it('falls back to the time between pause and resume when the resume has no gap value', () => {
    const log = buildExecutionLog(
      { id: 'exp-1' },
      steps,
      [
        ev({ type: 'phase_pause', phaseId: 'p2', at: T0 }),
        ev({ type: 'phase_resume', phaseId: 'p2', at: T0 + 2 * 60 * MIN }),
      ],
      [],
    );
    expect(log.pauses[0].gapMs).toBe(2 * 60 * MIN);
  });
});

describe('buildExecutionLog methodsText', () => {
  it('states an overridden volume with its planned value and includes reagent lots', () => {
    const log = buildExecutionLog(
      { id: 'exp-1' },
      steps,
      events,
      runValues,
      [{ stepId: 's2', name: 'Primary antibody', lotNumber: 'AB-2231', vendor: 'Cell Signaling' }],
    );
    expect(log.methodsText).toContain('Step 2, "Primary antibody," was started but not completed');
    expect(log.methodsText).toContain('Volume 15 mL (overridden from 10 mL)');
    expect(log.methodsText).toContain('Primary antibody (lot AB-2231, Cell Signaling)');
  });

  it('gives the timer actual and planned time in minutes in past tense', () => {
    const log = buildExecutionLog({ id: 'exp-1' }, steps, events, runValues);
    expect(log.methodsText).toContain('Step 1, "Block membranes," was completed for 62 min (planned 60 min) during Block.');
  });

  it('does not overstate a value that matches its plan', () => {
    const log = buildExecutionLog({ id: 'exp-1' }, steps, events, [{ ...runValues[0], value: 10 }]);
    expect(log.methodsText).not.toContain('overridden');
  });
});
