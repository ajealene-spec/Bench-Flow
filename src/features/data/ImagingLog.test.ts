import { describe, expect, it } from 'vitest';
import type { ImagingRecord } from '../../types';
import { imagingCsv, latestSettings, parseChannels } from './ImagingLog';

function rec(id: string, at: number, microscope: string): ImagingRecord {
  return {
    id,
    experimentId: 'e1',
    microscope,
    objective: '20x',
    laser: '488 nm, 5%',
    exposure: '200 ms',
    gain: 2,
    channels: ['GFP', 'DAPI'],
    at,
  };
}

describe('latestSettings', () => {
  it('copies the settings of the most recent acquisition, whatever the list order', () => {
    const settings = latestSettings([rec('a', 1, 'Old scope'), rec('b', 5, 'New scope')]);
    expect(settings).toEqual({
      microscope: 'New scope',
      objective: '20x',
      laser: '488 nm, 5%',
      exposure: '200 ms',
      gain: 2,
      channels: ['GFP', 'DAPI'],
    });
  });

  it('returns undefined when nothing has been recorded', () => {
    expect(latestSettings([])).toBeUndefined();
  });
});

describe('parseChannels', () => {
  it('splits on commas and semicolons and drops blanks', () => {
    expect(parseChannels(' DAPI, GFP;  RFP ,, ')).toEqual(['DAPI', 'GFP', 'RFP']);
  });
});

describe('imagingCsv', () => {
  it('writes entries in time order with channels joined by semicolons', () => {
    const lines = imagingCsv([rec('b', 2000, 'Scope B'), rec('a', 1000, 'Scope A')]).split('\r\n');
    expect(lines[0]).toBe('recorded_at,step_id,microscope,objective,channels,laser,exposure,gain,file');
    expect(lines[1]).toBe('1970-01-01T00:00:01.000Z,,Scope A,20x,GFP;DAPI,"488 nm, 5%",200 ms,2,');
    expect(lines).toHaveLength(3);
  });
});
