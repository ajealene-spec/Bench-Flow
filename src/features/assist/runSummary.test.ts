import { describe, expect, it } from 'vitest';
import type { Experiment, Procedure, Step, StepRecord } from '../../types';
import { buildReport } from '../report/buildReport';
import { compactRunSummary, stepLines } from './runSummary';

const experiment: Experiment = {
  id: 'e1',
  name: 'WB run',
  status: 'done',
  folderId: null,
  notes: 'Used fresh milk',
  createdAt: 0,
  updatedAt: 0,
};

const steps: Step[] = [
  {
    id: 's1',
    title: 'Block',
    instructions: 'Block in 5% milk.',
    timers: [{ id: 't1', stepId: 's1', label: 'Block', durationSec: 3600, status: 'idle' }],
    reagents: [{ name: 'Milk', amount: '5', unit: '%' }],
    dataFields: [],
    cautions: ['Wear gloves'],
  },
  {
    id: 's2',
    title: 'Primary antibody',
    instructions: 'Incubate with anti-GAPDH 1:1000 overnight.',
    timers: [],
    reagents: [],
    dataFields: [],
    cautions: [],
  },
];

const procedure: Procedure = { id: 'p1', experimentId: 'e1', title: 'WB', steps, createdAt: 0, updatedAt: 0 };

const records: StepRecord[] = [
  { id: 'r1', experimentId: 'e1', stepId: 's1', kind: 'timer', label: 'Block', startedAt: 0, stoppedAt: 1800000, elapsedSec: 1800, createdAt: 1 },
  { id: 'r2', experimentId: 'e1', stepId: 's2', kind: 'number', label: 'Antibody dilution', value: 1000, createdAt: 2 },
];

describe('compactRunSummary', () => {
  it('keeps planned and actual timers, recorded numbers, reagents and deviations', () => {
    const report = buildReport({ experiment, procedure, records, runState: { experimentId: 'e1', currentStepIndex: 1, completedStepIds: ['s1'], updatedAt: 0 } });
    const summary = compactRunSummary(report);
    expect(summary.experimentName).toBe('WB run');
    expect(summary.notes).toBe('Used fresh milk');
    expect(summary.steps[0].timers).toEqual([{ label: 'Block', plannedSec: 3600, actualSec: 1800 }]);
    expect(summary.steps[1].numbers).toEqual([{ label: 'Antibody dilution', value: 1000, unit: undefined, note: undefined }]);
    expect(summary.steps[1].completed).toBe(false);
    expect(summary.reagents).toEqual([{ name: 'Milk', amount: '5', unit: '%', stepNumbers: [1] }]);
    expect(summary.deviations.some((d) => d.includes('(-50%)'))).toBe(true);
  });

  it('clips long instructions', () => {
    const long = { ...steps[0], instructions: 'x'.repeat(1000) };
    const report = buildReport({ experiment, procedure: { ...procedure, steps: [long] } });
    const text = compactRunSummary(report).steps[0].instructions;
    expect(text.length).toBeLessThanOrEqual(300);
    expect(text.endsWith('…')).toBe(true);
  });
});

describe('stepLines', () => {
  it('gives one short line per step with its title and instructions', () => {
    expect(stepLines(steps)).toEqual(['Block: Block in 5% milk.', 'Primary antibody: Incubate with anti-GAPDH 1:1000 overnight.']);
  });
});
