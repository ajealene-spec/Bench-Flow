import { describe, expect, it } from 'vitest';
import type { Experiment, Procedure, StepRecord } from '../../types';
import { buildExperimentsCsv, EXPORT_HEADERS } from './exportCsv';

const experiment = (id: string, name: string): Experiment => ({
  id,
  name,
  status: 'done',
  folderId: null,
  createdAt: 1,
  updatedAt: 1,
});

const procedure: Procedure = {
  id: 'p',
  experimentId: 'e1',
  title: 'Blot',
  steps: [
    { id: 's1', title: 'Load gel', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] },
  ],
  createdAt: 1,
  updatedAt: 1,
};

const record: StepRecord = {
  id: 'r1',
  experimentId: 'e1',
  stepId: 's1',
  kind: 'number',
  label: 'Band, MW',
  value: 52,
  unit: 'kDa',
  createdAt: 1000,
};

describe('buildExperimentsCsv', () => {
  it('starts with the experiment and protocol columns and then the summary columns', () => {
    const csv = buildExperimentsCsv([
      { experiment: experiment('e1', 'Blot 1'), protocolTitle: 'Blot', procedure, records: [record] },
    ]);
    const [header, row] = csv.split('\r\n');
    expect(header.split(',')).toEqual(EXPORT_HEADERS);
    expect(row.startsWith('Blot 1,Blot,done,1,Load gel,Number,')).toBe(true);
    // The label contains a comma, so it is quoted.
    expect(row).toContain('"Band, MW"');
  });

  it('keeps an experiment with no records as a single row', () => {
    const csv = buildExperimentsCsv([
      { experiment: experiment('e2', 'Empty'), protocolTitle: '', procedure: undefined, records: [] },
    ]);
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1].startsWith('Empty,,done,')).toBe(true);
  });

  it('writes one block of rows per experiment in the order given', () => {
    const csv = buildExperimentsCsv([
      { experiment: experiment('e2', 'Second'), protocolTitle: 'X', procedure: undefined, records: [] },
      { experiment: experiment('e1', 'First'), protocolTitle: 'Blot', procedure, records: [record] },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[1].startsWith('Second,')).toBe(true);
    expect(lines[2].startsWith('First,')).toBe(true);
  });
});
