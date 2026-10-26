import { describe, expect, it } from 'vitest';
import type { EphysRecord } from '../../types';
import { ephysCsv, flagEphysRecords } from './ephysMath';

function rec(id: string, cellId: string, at: number, Ra: number): EphysRecord {
  return { id, experimentId: 'e1', cellId, Rm: 500, Ra, Cm: 100, holding: -70, at };
}

describe('flagEphysRecords', () => {
  it('flags Ra above 25 MOhm', () => {
    const flags = flagEphysRecords([rec('a', 'c1', 1, 25), rec('b', 'c2', 2, 25.1)]);
    expect(flags.has('a')).toBe(false);
    expect(flags.get('b')?.map((f) => f.kind)).toEqual(['ra_high']);
  });

  it('flags a change of more than 20% from the previous record of the same cell', () => {
    const flags = flagEphysRecords([rec('a', 'c1', 1, 10), rec('b', 'c1', 2, 12.1)]);
    expect(flags.get('b')?.[0].kind).toBe('ra_change');
    expect(flags.get('b')?.[0].message).toContain('+21%');
  });

  it('does not flag a change of exactly 20%', () => {
    expect(flagEphysRecords([rec('a', 'c1', 1, 10), rec('b', 'c1', 2, 12)]).size).toBe(0);
  });

  it('flags a drop in Ra as well', () => {
    const flags = flagEphysRecords([rec('a', 'c1', 1, 20), rec('b', 'c1', 2, 10)]);
    expect(flags.get('b')?.[0].message).toContain('-50%');
  });

  it('never compares Ra across different cells', () => {
    const flags = flagEphysRecords([rec('a', 'c1', 1, 10), rec('b', 'c2', 2, 30)]);
    expect(flags.get('b')?.map((f) => f.kind)).toEqual(['ra_high']);
  });

  it('compares each record with the one before it in time order, not list order', () => {
    const flags = flagEphysRecords([rec('late', 'c1', 3, 10), rec('early', 'c1', 1, 10), rec('mid', 'c1', 2, 10)]);
    expect(flags.size).toBe(0);
  });
});

describe('ephysCsv', () => {
  it('writes a header, one row per record in time order, and the flags', () => {
    const csv = ephysCsv([rec('b', 'c1', 2000, 30), rec('a', 'c1', 1000, 10)]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('cell_id,recorded_at,step_id,Rm_MOhm,Ra_MOhm,Cm_pF,holding_mV,notes,flags');
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith('c1,1970-01-01T00:00:01.000Z')).toBe(true);
    expect(lines[2]).toContain('Ra 30 MΩ is above 25 MΩ');
  });

  it('quotes notes that contain commas and quotes', () => {
    const record = { ...rec('a', 'c1', 1, 10), notes: 'seal "good", stable' };
    expect(ephysCsv([record]).split('\r\n')[1]).toContain('"seal ""good"", stable"');
  });
});
