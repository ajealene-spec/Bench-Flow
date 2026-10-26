import { describe, expect, it } from 'vitest';
import type { Procedure, Step, StepRecord } from '../../types';
import { groupRecordsByStep, SUMMARY_HEADERS, summaryRows, toCSV, toTSV } from './summary';

function step(id: string, title: string): Step {
  return { id, title, instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] };
}

const procedure: Procedure = {
  id: 'p1',
  experimentId: 'e1',
  title: 'Western blot',
  steps: [step('s1', 'Lyse cells'), step('s2', 'Quantify'), step('s3', 'Run gel')],
  createdAt: 0,
  updatedAt: 0,
};

function rec(partial: Partial<StepRecord> & Pick<StepRecord, 'id' | 'stepId' | 'createdAt'>): StepRecord {
  return { experimentId: 'e1', kind: 'number', label: '', ...partial };
}

describe('groupRecordsByStep', () => {
  it('orders groups by procedure order, not by when records were made', () => {
    const records = [
      rec({ id: 'a', stepId: 's3', createdAt: 1, value: 1 }),
      rec({ id: 'b', stepId: 's1', createdAt: 2, value: 2 }),
      rec({ id: 'c', stepId: 's3', createdAt: 3, value: 3 }),
    ];
    const groups = groupRecordsByStep(procedure, records);
    expect(groups.map((g) => g.stepTitle)).toEqual(['Lyse cells', 'Run gel']);
    expect(groups.map((g) => g.stepNumber)).toEqual([1, 3]);
    expect(groups[1].records.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('leaves out steps with no records', () => {
    const groups = groupRecordsByStep(procedure, [rec({ id: 'a', stepId: 's2', createdAt: 1 })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].stepTitle).toBe('Quantify');
  });

  it('keeps records whose step was removed, at the end', () => {
    const groups = groupRecordsByStep(procedure, [
      rec({ id: 'gone', stepId: 'old', createdAt: 1 }),
      rec({ id: 'b', stepId: 's1', createdAt: 2 }),
    ]);
    expect(groups.map((g) => g.stepTitle)).toEqual(['Lyse cells', 'Removed step']);
  });
});

describe('summaryRows and exports', () => {
  const records: StepRecord[] = [
    rec({ id: 'a', stepId: 's1', createdAt: 1, label: 'Protein', value: 12.5, unit: 'µg/µL', note: 'Line 1\nline 2' }),
    rec({
      id: 'b',
      stepId: 's1',
      createdAt: 2,
      kind: 'timer',
      label: 'Incubate, 30 min',
      elapsedSec: 3725,
      startedAt: 0,
      stoppedAt: 3725000,
    }),
  ];
  const groups = groupRecordsByStep(procedure, records);
  const rows = summaryRows(groups);

  it('produces one row per record with step, label, value, unit and elapsed time', () => {
    expect(rows).toHaveLength(2);
    expect(rows[0].slice(0, 6)).toEqual(['1', 'Lyse cells', 'Number', 'Protein', '12.5', 'µg/µL']);
    expect(rows[1][2]).toBe('Time');
    expect(rows[1][6]).toBe('1:02:05');
    expect(rows[1][7]).toBe('3725');
  });

  it('writes TSV with a header and no stray tabs or line breaks in cells', () => {
    const tsv = toTSV(SUMMARY_HEADERS, rows);
    const lines = tsv.split('\n');
    expect(lines[0]).toBe(SUMMARY_HEADERS.join('\t'));
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Line 1 line 2');
    for (const line of lines) expect(line.split('\t')).toHaveLength(SUMMARY_HEADERS.length);
  });

  it('quotes CSV cells that contain commas, quotes or line breaks', () => {
    const csv = toCSV(SUMMARY_HEADERS, rows);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(SUMMARY_HEADERS.join(','));
    expect(lines[2]).toContain('"Incubate, 30 min"');
    const quoted = toCSV(['A'], [['say "hi"']]);
    expect(quoted).toBe('A\r\n"say ""hi"""');
  });
});
