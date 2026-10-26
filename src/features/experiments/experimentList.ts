import type { Experiment, ExperimentStatus, StepRecord } from '../../types';

/** Pure sort, filter, group and search logic for the Experiments page. No database or React in here. */

export type SortKey = 'started' | 'ended' | 'opened' | 'name' | 'protocol';
export type SortDir = 'asc' | 'desc';

export const SORT_LABELS: Record<SortKey, string> = {
  started: 'Date started',
  ended: 'Date ended',
  opened: 'Last opened',
  name: 'Name',
  protocol: 'Protocol',
};

export interface ListItem {
  experiment: Experiment;
  protocolTitle: string;
  /** Lower-case text the search matches: title, notes and recorded values. */
  searchText: string;
}

export interface ListFilters {
  query: string;
  status: ExperimentStatus | 'all';
  /** Exact protocol title, or 'all'. */
  protocol: string;
  /** Every tag listed must be on the experiment. Compared in lower case. */
  tags: string[];
  /** Inclusive bounds on the date started, in ms. */
  startFrom?: number;
  startTo?: number;
}

export const EMPTY_FILTERS: ListFilters = { query: '', status: 'all', protocol: 'all', tags: [] };

/** The date an experiment counts as started: the first start, or its creation for runs not yet started. */
export function startDate(experiment: Experiment): number {
  return experiment.startedAt ?? experiment.createdAt;
}

/** The date a sort or month grouping uses. Name and protocol sorts group by the start date. */
function dateFor(item: ListItem, key: SortKey): number | undefined {
  switch (key) {
    case 'ended':
      return item.experiment.endedAt;
    case 'opened':
      return item.experiment.lastOpenedAt;
    default:
      return startDate(item.experiment);
  }
}

function sortValue(item: ListItem, key: SortKey): number | string | undefined {
  if (key === 'name') return item.experiment.name;
  if (key === 'protocol') return item.protocolTitle;
  return dateFor(item, key);
}

/**
 * Sorts a copy of the items. Dates that are missing always sort last, in either direction, so
 * "not ended yet" does not jump to the top when the order is flipped. Ties fall back to id.
 */
export function sortItems(items: ListItem[], key: SortKey, dir: SortDir): ListItem[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    let result: number;
    if (va === undefined || vb === undefined) {
      if (va === vb) result = 0;
      else return va === undefined ? 1 : -1;
    } else if (typeof va === 'number' && typeof vb === 'number') {
      result = (va - vb) * sign;
    } else {
      result = String(va).localeCompare(String(vb), undefined, { sensitivity: 'base', numeric: true }) * sign;
    }
    return result !== 0 ? result : a.experiment.id.localeCompare(b.experiment.id);
  });
}

/** Keeps the items that match every filter. `inFolder` decides the folder part (see folderRows.ts). */
export function filterItems(
  items: ListItem[],
  filters: ListFilters,
  inFolder: (folderId: string | null) => boolean = () => true,
): ListItem[] {
  const wantedTags = filters.tags.map(normalizeTag).filter(Boolean);
  return items.filter((item) => {
    const e = item.experiment;
    if (!inFolder(e.folderId)) return false;
    if (filters.status !== 'all' && e.status !== filters.status) return false;
    if (filters.protocol !== 'all' && item.protocolTitle !== filters.protocol) return false;
    if (wantedTags.length > 0) {
      const own = new Set((e.tags ?? []).map(normalizeTag));
      if (!wantedTags.every((t) => own.has(t))) return false;
    }
    const started = startDate(e);
    if (filters.startFrom !== undefined && started < filters.startFrom) return false;
    if (filters.startTo !== undefined && started > filters.startTo) return false;
    return matchesQuery(item.searchText, filters.query);
  });
}

export interface MonthGroup {
  key: string;
  label: string;
  items: ListItem[];
}

/**
 * Splits already-sorted items into calendar months, keeping their order. Items with no date for
 * the sort key go into a final "No date" group.
 */
export function groupByMonth(items: ListItem[], key: SortKey): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const byKey = new Map<string, MonthGroup>();
  const undated: ListItem[] = [];
  for (const item of items) {
    const at = dateFor(item, key);
    if (at === undefined) {
      undated.push(item);
      continue;
    }
    const date = new Date(at);
    const groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    let group = byKey.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        label: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        items: [],
      };
      byKey.set(groupKey, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  if (undated.length > 0) groups.push({ key: 'none', label: 'No date', items: undated });
  return groups;
}

/** Text the search looks at for one experiment: its title, notes and every recorded number, timer and note. */
export function buildSearchText(experiment: Experiment, records: StepRecord[]): string {
  const parts = [experiment.name, experiment.notes ?? ''];
  for (const r of records) {
    parts.push(r.label, r.value !== undefined ? String(r.value) : '', r.unit ?? '', r.note ?? '');
  }
  return parts.join('\n').toLowerCase();
}

/** True when every word of the query appears in the text. An empty query matches everything. */
export function matchesQuery(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((word) => text.includes(word));
}

/** Tags are stored trimmed, single-spaced, lower case and at most 40 characters. */
export function normalizeTag(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 40);
}

/** Adds a tag to a list if it is not there yet (compared after normalizing). Blank input changes nothing. */
export function addTag(tags: string[] | undefined, input: string): string[] {
  const current = tags ?? [];
  const next = normalizeTag(input);
  if (!next || current.some((t) => normalizeTag(t) === next)) return current;
  return [...current, next];
}

/** Every distinct tag used by the items, sorted. */
export function collectTags(items: ListItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) for (const t of item.experiment.tags ?? []) set.add(normalizeTag(t));
  return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Every distinct protocol title, sorted. */
export function collectProtocols(items: ListItem[]): string[] {
  return [...new Set(items.map((i) => i.protocolTitle).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * Turns a yyyy-mm-dd value from a date input into a local timestamp. The start of the day is used for
 * a "from" bound and the last millisecond of the day for a "to" bound. Blank or malformed input gives undefined.
 */
export function parseDateInput(value: string, endOfDay: boolean): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = endOfDay ? new Date(year, month, day + 1).getTime() - 1 : new Date(year, month, day).getTime();
  return Number.isNaN(date) ? undefined : date;
}
