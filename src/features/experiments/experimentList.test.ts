import { describe, expect, it } from 'vitest';
import type { Experiment, StepRecord } from '../../types';
import {
  addTag,
  buildSearchText,
  collectProtocols,
  collectTags,
  EMPTY_FILTERS,
  filterItems,
  groupByMonth,
  matchesQuery,
  normalizeTag,
  parseDateInput,
  sortItems,
  startDate,
  type ListItem,
} from './experimentList';

function exp(id: string, patch: Partial<Experiment> = {}): Experiment {
  return {
    id,
    name: `Run ${id}`,
    status: 'draft',
    folderId: null,
    createdAt: 1000,
    updatedAt: 1000,
    ...patch,
  };
}

function item(id: string, patch: Partial<Experiment> = {}, protocolTitle = 'Western', searchText = ''): ListItem {
  const experiment = exp(id, patch);
  return { experiment, protocolTitle, searchText: `${experiment.name}\n${searchText}`.toLowerCase() };
}

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();

const items: ListItem[] = [
  item('a', { name: 'Alpha', startedAt: day(2026, 3, 5), endedAt: day(2026, 3, 9), lastOpenedAt: day(2026, 4, 1) }, 'PCR'),
  item('b', { name: 'beta', startedAt: day(2026, 5, 2), lastOpenedAt: day(2026, 2, 1) }, 'Western'),
  item('c', { name: 'Gamma', createdAt: day(2026, 1, 10), status: 'done', tags: ['Mouse'] }, 'Western'),
  item('d', { name: 'delta', startedAt: day(2026, 3, 20), endedAt: day(2026, 3, 25), status: 'done', tags: ['mouse', 'imaging'], folderId: 'f1' }, 'IHC'),
];

const ids = (list: ListItem[]) => list.map((i) => i.experiment.id);

describe('sortItems', () => {
  it('sorts by date started, newest first by default', () => {
    expect(ids(sortItems(items, 'started', 'desc'))).toEqual(['b', 'd', 'a', 'c']);
  });

  it('reverses with asc', () => {
    expect(ids(sortItems(items, 'started', 'asc'))).toEqual(['c', 'a', 'd', 'b']);
  });

  it('puts runs without an end date last in both directions', () => {
    expect(ids(sortItems(items, 'ended', 'desc'))).toEqual(['d', 'a', 'b', 'c']);
    expect(ids(sortItems(items, 'ended', 'asc'))).toEqual(['a', 'd', 'b', 'c']);
  });

  it('sorts by last opened, missing values last', () => {
    expect(ids(sortItems(items, 'opened', 'desc'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('sorts names case-insensitively and numerically aware', () => {
    // Alpha, beta, delta, Gamma when case is ignored.
    expect(ids(sortItems(items, 'name', 'asc'))).toEqual(['a', 'b', 'd', 'c']);
    expect(ids(sortItems(items, 'name', 'desc'))).toEqual(['c', 'd', 'b', 'a']);
  });

  it('sorts by protocol title, ties by id', () => {
    // IHC (d), PCR (a), then Western (b and c).
    expect(ids(sortItems(items, 'protocol', 'asc'))).toEqual(['d', 'a', 'b', 'c']);
  });

  it('does not change the input array', () => {
    const copy = [...items];
    sortItems(items, 'name', 'asc');
    expect(items).toEqual(copy);
  });

  it('falls back to creation date when a run has not started', () => {
    expect(startDate(exp('x', { createdAt: 5 }))).toBe(5);
    expect(startDate(exp('x', { createdAt: 5, startedAt: 9 }))).toBe(9);
  });
});

describe('filterItems', () => {
  it('returns everything with empty filters', () => {
    expect(filterItems(items, EMPTY_FILTERS)).toHaveLength(4);
  });

  it('filters by status and protocol', () => {
    expect(ids(filterItems(items, { ...EMPTY_FILTERS, status: 'done' }))).toEqual(['c', 'd']);
    expect(ids(filterItems(items, { ...EMPTY_FILTERS, protocol: 'Western' }))).toEqual(['b', 'c']);
  });

  it('keeps runs whose start date is inside the range', () => {
    const range = {
      ...EMPTY_FILTERS,
      startFrom: parseDateInput('2026-03-01', false),
      startTo: parseDateInput('2026-03-31', true),
    };
    expect(ids(filterItems(items, range))).toEqual(['a', 'd']);
  });

  it('requires every selected tag, ignoring case', () => {
    expect(ids(filterItems(items, { ...EMPTY_FILTERS, tags: ['MOUSE'] }))).toEqual(['c', 'd']);
    expect(ids(filterItems(items, { ...EMPTY_FILTERS, tags: ['mouse', 'imaging'] }))).toEqual(['d']);
  });

  it('applies the folder predicate', () => {
    expect(ids(filterItems(items, EMPTY_FILTERS, (folderId) => folderId === 'f1'))).toEqual(['d']);
    expect(ids(filterItems(items, EMPTY_FILTERS, (folderId) => folderId === null))).toEqual(['a', 'b', 'c']);
  });

  it('searches title, notes and recorded values', () => {
    const withRecords: ListItem[] = [
      item('n', { name: 'Plain' }, 'PCR', 'the sample looked cloudy'),
      item('v', { name: 'Other' }, 'PCR', '4.2 mm/s'),
    ];
    expect(ids(filterItems(withRecords, { ...EMPTY_FILTERS, query: 'CLOUDY' }))).toEqual(['n']);
    expect(ids(filterItems(withRecords, { ...EMPTY_FILTERS, query: '4.2 mm' }))).toEqual(['v']);
    expect(ids(filterItems(withRecords, { ...EMPTY_FILTERS, query: 'other' }))).toEqual(['v']);
  });
});

describe('groupByMonth', () => {
  it('groups by the chosen date in month order and puts undated runs last', () => {
    const sorted = sortItems(items, 'ended', 'desc');
    const groups = groupByMonth(sorted, 'ended');
    expect(groups.map((g) => g.key)).toEqual(['2026-03', 'none']);
    expect(ids(groups[0].items)).toEqual(['d', 'a']);
    expect(ids(groups[1].items)).toEqual(['b', 'c']);
  });

  it('groups by start date by default', () => {
    const groups = groupByMonth(sortItems(items, 'started', 'desc'), 'started');
    expect(groups.map((g) => g.key)).toEqual(['2026-05', '2026-03', '2026-01']);
  });
});

describe('buildSearchText and matchesQuery', () => {
  it('includes notes and every record field, lower-cased', () => {
    const records: StepRecord[] = [
      { id: 'r', experimentId: 'a', stepId: 's', kind: 'number', label: 'Band MW', value: 52, unit: 'kDa', note: 'Faint', createdAt: 1 },
    ];
    const text = buildSearchText(exp('a', { name: 'Blot', notes: 'Used fresh buffer' }), records);
    expect(text).toContain('blot');
    expect(text).toContain('fresh buffer');
    expect(text).toContain('band mw');
    expect(text).toContain('52');
    expect(text).toContain('faint');
  });

  it('matches every word, and an empty query matches anything', () => {
    expect(matchesQuery('fresh buffer blot', 'buffer blot')).toBe(true);
    expect(matchesQuery('fresh buffer', 'buffer missing')).toBe(false);
    expect(matchesQuery('anything', '   ')).toBe(true);
  });
});

describe('tags', () => {
  it('normalizes and de-duplicates tags', () => {
    expect(normalizeTag('  Two   Photon ')).toBe('two photon');
    expect(addTag(['mouse'], ' Mouse ')).toEqual(['mouse']);
    expect(addTag(undefined, 'Imaging')).toEqual(['imaging']);
    expect(addTag(['mouse'], '   ')).toEqual(['mouse']);
  });

  it('collects the distinct tags across items', () => {
    expect(collectTags(items)).toEqual(['imaging', 'mouse']);
    expect(collectProtocols(items)).toEqual(['IHC', 'PCR', 'Western']);
  });
});

describe('parseDateInput', () => {
  it('returns local start and end of day', () => {
    expect(parseDateInput('2026-03-01', false)).toBe(new Date(2026, 2, 1).getTime());
    expect(parseDateInput('2026-03-01', true)).toBe(new Date(2026, 2, 2).getTime() - 1);
  });

  it('returns undefined for blank or malformed input', () => {
    expect(parseDateInput('', false)).toBeUndefined();
    expect(parseDateInput('03/01/2026', false)).toBeUndefined();
  });
});
