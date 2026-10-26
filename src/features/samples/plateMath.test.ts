import { describe, expect, it } from 'vitest';
import type { SampleWell } from '../../types';
import {
  applyGrid,
  assignWells,
  fitWellsToFormat,
  groupColor,
  groupNames,
  parseGrid,
  plateCsv,
  wellIds,
  wellPosition,
  wellsInRect,
} from './plateMath';

describe('well geometry', () => {
  it('lists 96 and 24 wells in reading order', () => {
    const ninetySix = wellIds('96');
    expect(ninetySix).toHaveLength(96);
    expect(ninetySix.slice(0, 3)).toEqual(['A1', 'A2', 'A3']);
    expect(ninetySix[95]).toBe('H12');
    expect(wellIds('24')).toHaveLength(24);
    expect(wellIds('24')[23]).toBe('D6');
  });

  it('parses well ids and rejects non-wells', () => {
    expect(wellPosition('c7')).toEqual({ row: 2, col: 7 });
    expect(wellPosition('I1')).toBeUndefined();
    expect(wellPosition('A13')).toEqual({ row: 0, col: 13 });
  });

  it('selects a rectangle whichever way the drag went', () => {
    expect(wellsInRect('96', 'B2', 'A1')).toEqual(['A1', 'A2', 'B1', 'B2']);
    expect(wellsInRect('24', 'A1', 'A3')).toEqual(['A1', 'A2', 'A3']);
  });
});

describe('assignWells', () => {
  it('sets label and group, and clears wells when both are blank', () => {
    let wells = assignWells('96', {}, ['A1', 'A2'], { label: 'Ctrl', group: 'Control' });
    expect(wells.A1).toEqual({ sampleId: 'Ctrl', label: 'Ctrl', group: 'Control' });
    wells = assignWells('96', wells, ['A2'], { label: '', group: '' });
    expect(wells.A2).toBeUndefined();
    expect(wells.A1).toBeDefined();
  });

  it('ignores wells that are not on the plate format', () => {
    const wells = assignWells('24', {}, ['H12', 'A1'], { label: 'x', group: '' });
    expect(Object.keys(wells)).toEqual(['A1']);
  });
});

describe('groups and colors', () => {
  const wells: Record<string, SampleWell> = {
    B1: { sampleId: 'k', label: 'k', group: 'Control' },
    A1: { sampleId: 't', label: 't', group: 'Drug' },
    A2: { sampleId: 'u', label: 'u', group: 'Drug' },
  };

  it('lists groups in reading order of first use', () => {
    expect(groupNames('96', wells)).toEqual(['Drug', 'Control']);
  });

  it('gives each group a palette color and blanks no color', () => {
    const groups = groupNames('96', wells);
    expect(groupColor(groups, 'Drug')).toBe('#006747');
    expect(groupColor(groups, 'Control')).not.toBe(groupColor(groups, 'Drug'));
    expect(groupColor(groups, '')).toBe('transparent');
  });
});

describe('pasting from a spreadsheet', () => {
  it('reads tab-separated and comma-separated rows, dropping trailing blank lines', () => {
    expect(parseGrid('a\tb\r\nc\td\n\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseGrid('x, y\n')).toEqual([['x', 'y']]);
  });

  it('places the grid from the origin well and keeps existing groups', () => {
    const start: Record<string, SampleWell> = { B2: { sampleId: 'old', label: 'old', group: 'Drug' } };
    const wells = applyGrid('96', start, 'A1', [
      ['s1', 's2', ''],
      ['s3', 's4', 's5'],
    ]);
    expect(wells.A1.label).toBe('s1');
    expect(wells.A3).toBeUndefined();
    expect(wells.B2).toEqual({ sampleId: 's4', label: 's4', group: 'Drug' });
    expect(wells.B3.label).toBe('s5');
  });

  it('drops cells that fall off the plate', () => {
    const wells = applyGrid('24', {}, 'D6', [['a', 'b']]);
    expect(Object.keys(wells)).toEqual(['D6']);
  });

  it('switching to a smaller plate drops wells outside it', () => {
    const wells = fitWellsToFormat('24', { A1: { sampleId: 'a', label: 'a', group: '' }, E1: { sampleId: 'b', label: 'b', group: '' } });
    expect(Object.keys(wells)).toEqual(['A1']);
  });
});

describe('plateCsv', () => {
  it('exports only filled wells in reading order with a header', () => {
    const wells: Record<string, SampleWell> = {
      B1: { sampleId: 'mouse, 3', label: 'mouse, 3', group: 'Drug' },
      A2: { sampleId: 'a2', label: 'a2', group: '' },
    };
    expect(plateCsv('96', wells).split('\r\n')).toEqual([
      'well,sample_id,label,group',
      'A2,a2,a2,',
      'B1,"mouse, 3","mouse, 3",Drug',
    ]);
  });

  it('exports just the header for an empty plate', () => {
    expect(plateCsv('24', {})).toBe('well,sample_id,label,group');
  });
});
