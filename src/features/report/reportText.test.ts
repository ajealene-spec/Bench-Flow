import { describe, expect, it } from 'vitest';
import type { Procedure, StepRecord } from '../../types';
import { buildReport } from './buildReport';
import { reportToCSV, reportToJSON, reportToMarkdown } from './reportText';

const procedure: Procedure = {
  id: 'p1',
  experimentId: 'exp-1',
  title: 'PCR',
  steps: [
    { id: 's1', title: 'Mix', instructions: 'Combine', timers: [], reagents: [{ name: 'Taq', amount: '1', unit: 'U' }], dataFields: [], cautions: ['Keep on ice'] },
    { id: 's2', title: 'Cycle', instructions: 'Run', timers: [], reagents: [], dataFields: [], cautions: [] },
  ],
  createdAt: 0,
  updatedAt: 0,
};

const records: StepRecord[] = [
  { id: 'r1', experimentId: 'exp-1', stepId: 's2', kind: 'number', label: 'Ct', value: 21.5, createdAt: 2 },
  { id: 'r2', experimentId: 'exp-1', stepId: 's1', kind: 'number', label: 'Volume, uL', value: 10, unit: 'uL', note: 'said "ok"', createdAt: 1 },
];

describe('reportToMarkdown', () => {
  it('renders title, steps, numbers, deviations and reagents', () => {
    const report = buildReport({
      experiment: { id: 'exp-1', name: 'Run A', status: 'in_progress', folderId: null, createdAt: 0, updatedAt: 0 },
      procedure,
      runState: { experimentId: 'exp-1', currentStepIndex: 1, completedStepIds: ['s1'], updatedAt: 0 },
      records,
    });
    const md = reportToMarkdown(report);
    expect(md).toContain('# Run A');
    expect(md).toContain('- Status: in progress');
    expect(md).toContain('### 1. Mix (completed)');
    expect(md).toContain('- Caution: Keep on ice');
    expect(md).toContain('- Volume, uL: 10 uL (said "ok")');
    expect(md).toContain('### 2. Cycle (not completed)');
    expect(md).toContain('- Ct: 21.5');
    expect(md).toContain('## Deviations');
    expect(md).toContain('- Step 2 (Cycle) was not completed');
    expect(md).toContain('- Taq: 1 U (steps 1)');
    expect(md).toContain('## Notes\n\nNone.');
  });

  it('shows placeholders for an empty experiment', () => {
    const md = reportToMarkdown(
      buildReport({ experiment: { id: 'e', name: 'Empty', status: 'draft', folderId: null, createdAt: 0, updatedAt: 0 } }),
    );
    expect(md).toContain('No steps.');
    expect(md).toContain('- Started: —');
    expect(md).toContain('- Total duration: —');
    expect(md).toContain('## Deviations\n\nNone.');
  });
});

describe('reportToCSV', () => {
  it('lists records in procedure order with the summary columns', () => {
    const csv = reportToCSV(procedure, records);
    const lines = csv.split('\r\n');
    expect(lines[0]).toMatch(/^Step number,Step,Type,Label,Value,Unit/);
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith('1,Mix,Number,"Volume, uL",10,uL')).toBe(true);
    expect(lines[2].startsWith('2,Cycle,Number,Ct,21.5')).toBe(true);
  });

  it('returns only the header when there are no records', () => {
    expect(reportToCSV(undefined, []).split('\r\n')).toHaveLength(1);
  });
});

describe('reportToJSON', () => {
  it('round-trips the full report model', () => {
    const report = buildReport({ experiment: { id: 'e', name: 'X', status: 'done', folderId: null, createdAt: 0, updatedAt: 0 }, procedure });
    expect(JSON.parse(reportToJSON(report))).toEqual(JSON.parse(JSON.stringify(report)));
  });
});

describe('reportToEventsCSV', () => {
  it('writes one row per event, oldest first, with planned, actual and deviation columns', async () => {
    const { reportToEventsCSV } = await import('./reportText');
    const csv = reportToEventsCSV([
      { id: 'b', experimentId: 'e', at: 2_000, type: 'timer_stop', stepId: 's1', planned: 60, actual: 90, unit: 's', note: 'Block', deviation: { kind: 'timer', delta: 30 } },
      { id: 'a', experimentId: 'e', at: 1_000, type: 'step_start', stepId: 's1' },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('deviation_kind');
    expect(lines[1]).toContain('step_start');
    expect(lines[2]).toContain('timer_stop');
    expect(lines[2]).toContain(',timer,30');
  });
});
