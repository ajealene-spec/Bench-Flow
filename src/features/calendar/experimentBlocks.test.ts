import { describe, expect, it } from 'vitest';
import type { Experiment, ExecutionEvent, ProtocolPhase, Step } from '../../types';
import { expandExperimentBlocks, placeSteps, scheduleSteps, shiftPlannedStart, type ExperimentSource } from './experimentBlocks';

/** Local time, so the tests do not depend on the machine's time zone. */
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();

function step(id: string, hours: number, phaseId?: string): Step {
  return {
    id,
    title: id,
    instructions: '',
    durationSec: hours * 3600,
    timers: [],
    reagents: [],
    dataFields: [],
    cautions: [],
    phaseId,
  };
}

function experiment(over: Partial<Experiment> = {}): Experiment {
  return {
    id: 'exp-1',
    name: 'Run 1',
    status: 'draft',
    folderId: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  } as Experiment;
}

const PHASES: ProtocolPhase[] = [
  { id: 'prep', name: 'Prep' },
  { id: 'blot', name: 'Blot' },
  { id: 'ab', name: 'Antibody' },
  { id: 'detect', name: 'Detect' },
];

const STEPS: Step[] = [
  step('lysis', 4, 'prep'),
  step('gel', 4, 'blot'),
  step('primary', 16, 'ab'),
  step('secondary', 2, 'detect'),
];

function source(over: Partial<Experiment>, extra: Partial<ExperimentSource> = {}): ExperimentSource {
  return {
    experiment: experiment({ plannedStart: at(5, 9), ...over }),
    title: 'Western Blot',
    steps: STEPS,
    phases: PHASES,
    events: [],
    ...extra,
  };
}

const RANGE_START = '2026-10-05';
const RANGE_END = '2026-10-07';

describe('expandExperimentBlocks: multi-day expansion', () => {
  it('splits an overnight phase across two days and labels each day', () => {
    const blocks = expandExperimentBlocks([source({})], RANGE_START, RANGE_END, at(1, 0));
    const summary = blocks.map((b) => [b.date, b.startMin, b.endMin, b.label]);
    expect(summary).toEqual([
      ['2026-10-05', 540, 780, 'Western Blot — Day 1: Prep'],
      ['2026-10-05', 780, 1020, 'Western Blot — Day 1: Blot'],
      ['2026-10-05', 1020, 1440, 'Western Blot — Day 1: Antibody'],
      ['2026-10-06', 0, 540, 'Western Blot — Day 2: Antibody'],
      ['2026-10-06', 540, 660, 'Western Blot — Day 2: Detect'],
    ]);
  });

  it('only returns blocks inside the requested range', () => {
    const blocks = expandExperimentBlocks([source({})], '2026-10-06', '2026-10-06', at(1, 0));
    expect(blocks.map((b) => b.phaseId)).toEqual(['ab', 'detect']);
    expect(blocks[0].dayNumber).toBe(2);
  });

  it('gives a multi-day phase one block per day with its day number', () => {
    const blocks = expandExperimentBlocks([source({})], RANGE_START, RANGE_END, at(1, 0));
    const antibody = blocks.filter((b) => b.phaseId === 'ab');
    expect(antibody.map((b) => b.dayNumber)).toEqual([1, 2]);
  });

  it('marks only the first block of an unstarted run as the move handle', () => {
    const blocks = expandExperimentBlocks([source({})], RANGE_START, RANGE_END, at(1, 0));
    expect(blocks.filter((b) => b.moveHandle).map((b) => b.phaseId)).toEqual(['prep']);
  });

  it('shows every phase as upcoming for an unstarted run', () => {
    const blocks = expandExperimentBlocks([source({})], RANGE_START, RANGE_END, at(1, 0));
    expect(new Set(blocks.map((b) => b.status))).toEqual(new Set(['upcoming']));
  });

  it('returns nothing without a start time or steps', () => {
    const none = source({ plannedStart: undefined });
    expect(expandExperimentBlocks([none], RANGE_START, RANGE_END, 0)).toEqual([]);
    expect(expandExperimentBlocks([source({}, { steps: [] })], RANGE_START, RANGE_END, 0)).toEqual([]);
  });
});

describe('expandExperimentBlocks: overnight rollover', () => {
  it('a step that crosses midnight pushes the next step to 09:00 the next morning', () => {
    const steps = [step('late', 1, 'prep'), step('next', 1, 'blot')];
    const placed = placeSteps(steps, at(5, 23));
    expect(placed[0].endAt).toBe(at(6, 0));
    expect(placed[1].startAt).toBe(at(6, 9));
  });

  it('a step that stays within the day does not roll over', () => {
    const placed = placeSteps([step('a', 1), step('b', 1)], at(5, 10));
    expect(placed[1].startAt).toBe(at(5, 11));
  });

  it('labels the day after an overnight step with the next day number', () => {
    const src = source(
      { plannedStart: at(5, 23) },
      { steps: [step('ab', 2, 'ab'), step('gel', 1, 'blot')], phases: PHASES },
    );
    const blocks = expandExperimentBlocks([src], RANGE_START, RANGE_END, 0);
    expect(blocks.find((b) => b.phaseId === 'blot')).toMatchObject({ date: '2026-10-06', dayNumber: 2, startMin: 540 });
  });
});

describe('expandExperimentBlocks: pause and resume shift', () => {
  const started = (events: ExecutionEvent[]): ExperimentSource => ({
    experiment: experiment({ startedAt: at(5, 9), status: 'in_progress' }),
    title: 'Pause run',
    steps: [step('a', 2, 'prep'), step('b', 2, 'prep'), step('c', 1, 'blot')],
    phases: [
      { id: 'prep', name: 'Prep' },
      { id: 'blot', name: 'Blot' },
    ],
    events,
  });

  const events: ExecutionEvent[] = [
    { id: 'e1', experimentId: 'exp-1', at: at(5, 11), type: 'step_complete', stepId: 'a' },
    { id: 'e2', experimentId: 'exp-1', at: at(5, 11), type: 'phase_pause', phaseId: 'prep' },
    { id: 'e3', experimentId: 'exp-1', at: at(5, 15), type: 'phase_resume', phaseId: 'prep' },
  ];

  it('moves the remaining steps to the resume time', () => {
    // Now is during the pause, so the schedule holds at the resume.
    const blocks = expandExperimentBlocks([started(events)], RANGE_START, RANGE_END, at(5, 12));
    const blot = blocks.find((b) => b.phaseId === 'blot');
    expect(blot).toMatchObject({ date: '2026-10-05', startMin: 17 * 60, endMin: 18 * 60, status: 'upcoming' });
    // Prep still has step b to run, so it is the current phase.
    expect(blocks.find((b) => b.phaseId === 'prep')?.status).toBe('current');
  });

  it('extends the prep phase through the shifted step b', () => {
    const blocks = expandExperimentBlocks([started(events)], RANGE_START, RANGE_END, at(5, 12));
    const prep = blocks.filter((b) => b.phaseId === 'prep');
    expect(prep).toHaveLength(1);
    expect(prep[0]).toMatchObject({ startMin: 9 * 60, endMin: 17 * 60 });
  });

  it('keeps finished steps where they were planned', () => {
    const plan = scheduleSteps(started(events), at(5, 12)) ?? [];
    expect(plan.find((p) => p.stepId === 'a')).toMatchObject({ startAt: at(5, 9), endAt: at(5, 11) });
  });

  it('projects from now when the run is not paused and nothing has resumed', () => {
    const plan = scheduleSteps(started([]), at(5, 10)) ?? [];
    expect(plan.find((p) => p.stepId === 'a')?.startAt).toBe(at(5, 10));
  });
});

describe('shiftPlannedStart', () => {
  it('moves the run to another day and keeps the time of day', () => {
    const shifted = shiftPlannedStart(at(5, 14, 30), '2026-10-05', '2026-10-09');
    expect(shifted).toBe(at(9, 14, 30));
  });

  it('moves backwards too', () => {
    expect(shiftPlannedStart(at(5, 8), '2026-10-05', '2026-10-02')).toBe(at(2, 8));
  });
});

