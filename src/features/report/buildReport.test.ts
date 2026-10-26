import { describe, expect, it } from 'vitest';
import type { Experiment, Procedure, RunState, Step, StepRecord, Timer } from '../../types';
import { buildReport } from './buildReport';

function timer(label: string, durationSec: number, stepId: string): Timer {
  return { id: `${stepId}-${label}`, stepId, label, durationSec, status: 'idle' };
}

function step(id: string, title: string, extra: Partial<Step> = {}): Step {
  return { id, title, instructions: `Do ${title}`, timers: [], reagents: [], dataFields: [], cautions: [], ...extra };
}

const experiment: Experiment = {
  id: 'exp-1',
  name: 'Run 1',
  status: 'done',
  folderId: null,
  createdAt: 0,
  updatedAt: 0,
};

/** Run state with every step completed, so timer tests do not also report unfinished steps. */
function allDone(steps: Step[]): RunState {
  return { experimentId: 'exp-1', currentStepIndex: steps.length - 1, completedStepIds: steps.map((s) => s.id), updatedAt: 0 };
}

function procedure(steps: Step[]): Procedure {
  return { id: 'proc-1', experimentId: 'exp-1', title: 'Western Blot', steps, createdAt: 0, updatedAt: 0 };
}

function record(partial: Partial<StepRecord> & Pick<StepRecord, 'stepId' | 'kind' | 'label'>): StepRecord {
  return { id: `r-${Math.random()}`, experimentId: 'exp-1', createdAt: 0, ...partial };
}

describe('buildReport', () => {
  it('handles an empty experiment with no procedure or records', () => {
    const report = buildReport({ experiment: { ...experiment, status: 'draft' } });
    expect(report.title).toBe('Run 1');
    expect(report.protocol.title).toBe('Unknown protocol');
    expect(report.steps).toEqual([]);
    expect(report.deviations).toEqual([]);
    expect(report.reagents).toEqual([]);
    expect(report.safety).toEqual({ confirmedAt: undefined, items: [], hazards: [] });
    expect(report.dates.durationSec).toBeUndefined();
    expect(report.notes).toBe('');
    expect(report.recordCount).toBe(0);
  });

  it('computes total duration from start and end, and leaves it out when either is missing', () => {
    const ended = buildReport({ experiment: { ...experiment, startedAt: 1_000, endedAt: 61_000 } });
    expect(ended.dates.durationSec).toBe(60);

    const running = buildReport({ experiment: { ...experiment, startedAt: 1_000, endedAt: undefined } });
    expect(running.dates.durationSec).toBeUndefined();
  });

  it('never reports a negative duration', () => {
    const report = buildReport({ experiment: { ...experiment, startedAt: 5_000, endedAt: 1_000 } });
    expect(report.dates.durationSec).toBe(0);
  });

  it('keeps steps in procedure order and records in time order within a step', () => {
    const steps = [step('s1', 'Lyse'), step('s2', 'Load'), step('s3', 'Image')];
    const records = [
      record({ stepId: 's3', kind: 'number', label: 'Exposure', value: 2, createdAt: 30 }),
      record({ stepId: 's1', kind: 'number', label: 'Second', value: 2, createdAt: 20 }),
      record({ stepId: 's1', kind: 'number', label: 'First', value: 1, createdAt: 10 }),
    ];
    const report = buildReport({ experiment, procedure: procedure(steps), records });
    expect(report.steps.map((s) => s.title)).toEqual(['Lyse', 'Load', 'Image']);
    expect(report.steps.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(report.steps[0].numbers.map((n) => n.label)).toEqual(['First', 'Second']);
    expect(report.steps[1].numbers).toEqual([]);
    expect(report.recordCount).toBe(3);
  });

  it('marks completed steps from run state', () => {
    const steps = [step('s1', 'A'), step('s2', 'B')];
    const runState: RunState = { experimentId: 'exp-1', currentStepIndex: 2, completedStepIds: ['s1', 's2'], updatedAt: 0 };
    const report = buildReport({ experiment, procedure: procedure(steps), runState });
    expect(report.steps.every((s) => s.completed)).toBe(true);
    expect(report.deviations).toEqual([]);
  });

  it('flags steps not completed, and skipped steps that have a completed step after them', () => {
    const steps = [step('s1', 'A'), step('s2', 'B'), step('s3', 'C'), step('s4', 'D')];
    // Step 2 was jumped over (step 3 done); step 4 was never reached.
    const runState: RunState = { experimentId: 'exp-1', currentStepIndex: 3, completedStepIds: ['s1', 's3'], updatedAt: 0 };
    const report = buildReport({ experiment, procedure: procedure(steps), runState });
    expect(report.deviations).toEqual([
      { kind: 'skipped', stepNumber: 2, message: 'Step 2 (B) was skipped' },
      { kind: 'not_completed', stepNumber: 4, message: 'Step 4 (D) was not completed' },
    ]);
  });

  it('flags timers that ran more than 10% off plan in either direction', () => {
    const steps = [
      step('s1', 'Incubate', { timers: [timer('Block', 600, 's1'), timer('Wash', 300, 's1')] }),
    ];
    const records = [
      record({ stepId: 's1', kind: 'timer', label: 'Block', elapsedSec: 720 }), // +20%
      record({ stepId: 's1', kind: 'timer', label: 'Wash', elapsedSec: 300 }), // on plan
    ];
    const report = buildReport({ experiment, procedure: procedure(steps), records, runState: allDone(steps) });
    expect(report.deviations).toEqual([
      {
        kind: 'timer_variance',
        stepNumber: 1,
        message: 'Timer "Block" in step 1 ran 12:00, planned 10:00 (+20%)',
      },
    ]);
  });

  it('does not flag a timer exactly at the 10% boundary, and flags a short run', () => {
    const steps = [step('s1', 'Spin', { timers: [timer('Spin', 100, 's1')] })];
    const atBoundary = buildReport({
      experiment,
      procedure: procedure(steps),
      runState: allDone(steps),
      records: [record({ stepId: 's1', kind: 'timer', label: 'Spin', elapsedSec: 110 })],
    });
    expect(atBoundary.deviations).toEqual([]);

    const short = buildReport({
      experiment,
      procedure: procedure(steps),
      runState: allDone(steps),
      records: [record({ stepId: 's1', kind: 'timer', label: 'Spin', elapsedSec: 80 })],
    });
    expect(short.deviations).toHaveLength(1);
    expect(short.deviations[0].message).toContain('(-20%)');
  });

  it('lists planned timers that never ran without flagging them as deviations', () => {
    const steps = [step('s1', 'Block', { timers: [timer('Overnight', 3600, 's1')] })];
    const report = buildReport({ experiment, procedure: procedure(steps), runState: allDone(steps) });
    expect(report.steps[0].timers).toEqual([{ label: 'Overnight', plannedSec: 3600 }]);
    expect(report.deviations).toEqual([]);
  });

  it('pairs each timer run with its planned duration and keeps pause-inclusive elapsed time', () => {
    const steps = [step('s1', 'Incubate', { timers: [timer('Block', 600, 's1')] })];
    const report = buildReport({
      experiment,
      procedure: procedure(steps),
      runState: allDone(steps),
      records: [record({ stepId: 's1', kind: 'timer', label: 'Block', elapsedSec: 605, startedAt: 1, stoppedAt: 2 })],
    });
    expect(report.steps[0].timers).toEqual([
      { label: 'Block', plannedSec: 600, actualSec: 605, startedAt: 1, stoppedAt: 2 },
    ]);
    expect(report.deviations).toEqual([]);
  });

  it('merges reagents across steps by name and lists the steps that use them', () => {
    const steps = [
      step('s1', 'Prep', { reagents: [{ name: 'Tris', amount: '1', unit: 'M' }, { name: 'NaCl' }] }),
      step('s2', 'Run', { reagents: [{ name: 'tris ', amount: '9', unit: 'mM' }, { name: '  ' }] }),
      step('s3', 'Wash', { reagents: [{ name: 'NaCl', amount: '150', unit: 'mM' }] }),
    ];
    const report = buildReport({ experiment, procedure: procedure(steps) });
    expect(report.reagents).toEqual([
      { name: 'Tris', amount: '1', unit: 'M', stepNumbers: [1, 2] },
      { name: 'NaCl', amount: undefined, unit: undefined, stepNumbers: [1, 3] },
    ]);
  });

  it('carries the safety checklist, hazards, notes and calculator results', () => {
    const steps = [step('s1', 'Mix')];
    const report = buildReport({
      experiment: {
        ...experiment,
        notes: '  Used fresh buffer  ',
        safetyChecklist: [{ itemId: 'gloves', label: 'Gloves on', checked: true }],
        safetyConfirmedAt: 500,
      },
      procedure: procedure(steps),
      template: {
        title: 'Western Blot',
        category: 'Western Blot',
        hazards: [{ id: 'h1', name: 'Acrylamide', kind: 'chemical', reason: 'Neurotoxin', ppe: ['gloves'], stepIds: ['s1'] }],
      },
      calculatorResults: [
        { stepId: 's1', label: 'Stock volume', value: 2.5, unit: 'mL' },
        { stepId: 'other', label: 'Ignored', value: 1 },
      ],
      generatedAt: 999,
    });
    expect(report.protocol).toEqual({ title: 'Western Blot', category: 'Western Blot' });
    expect(report.safety.confirmedAt).toBe(500);
    expect(report.safety.items).toEqual([{ label: 'Gloves on', checked: true }]);
    expect(report.safety.hazards).toEqual([
      { name: 'Acrylamide', kind: 'chemical', reason: 'Neurotoxin', ppe: ['gloves'] },
    ]);
    expect(report.notes).toBe('Used fresh buffer');
    expect(report.steps[0].calculations).toEqual([{ stepId: 's1', label: 'Stock volume', value: 2.5, unit: 'mL' }]);
    expect(report.generatedAt).toBe(999);
  });
});

describe('buildReport RRIDs, animals and comments', () => {
  const exp: Experiment = { id: 'e9', name: 'Stain 9', status: 'done', folderId: null, createdAt: 1, updatedAt: 1 };
  const procedure: Procedure = {
    id: 'p9',
    experimentId: 'e9',
    title: 'IF',
    steps: [step('s1', 'Block', { reagents: [{ name: 'Anti-GFAP' }, { name: 'PBS' }] })],
    createdAt: 1,
    updatedAt: 1,
  };

  it('attaches the inventory RRID to a matching reagent and leaves the others without one', () => {
    const report = buildReport({ experiment: exp, procedure, reagentRrids: { 'anti-gfap': 'RRID:AB_2298772' } });
    expect(report.reagents).toEqual([
      expect.objectContaining({ name: 'Anti-GFAP', rrid: 'RRID:AB_2298772' }),
      expect.objectContaining({ name: 'PBS' }),
    ]);
    expect(report.reagents[1].rrid).toBeUndefined();
  });

  it('carries animals and experiment comments into the report', () => {
    const report = buildReport({
      experiment: exp,
      procedure,
      animals: [{ label: 'M-07', species: 'Mouse', strain: 'C57BL/6J', genotype: 'WT', sex: 'female' }],
      comments: [{ author: 'Ana', text: 'Good signal', createdAt: 5, resolved: true }],
    });
    expect(report.animals).toHaveLength(1);
    expect(report.comments).toEqual([{ author: 'Ana', text: 'Good signal', createdAt: 5, resolved: true }]);
  });

  it('has empty animals and comments when none are given', () => {
    const report = buildReport({ experiment: exp, procedure });
    expect(report.animals).toEqual([]);
    expect(report.comments).toEqual([]);
  });
});
