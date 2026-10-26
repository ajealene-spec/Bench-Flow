import { SORT_LABELS, type SortDir, type SortKey } from './experimentList';
import { BUTTON_SECONDARY, INPUT, LABEL } from './styles';

export interface ControlState {
  query: string;
  sortKey: SortKey;
  sortDir: SortDir;
  groupMonths: boolean;
  status: 'all' | 'draft' | 'in_progress' | 'done';
  protocol: string;
  from: string;
  to: string;
  tags: string[];
}

export const DEFAULT_CONTROLS: ControlState = {
  query: '',
  sortKey: 'started',
  sortDir: 'desc',
  groupMonths: false,
  status: 'all',
  protocol: 'all',
  from: '',
  to: '',
  tags: [],
};

const STATUS_OPTIONS: Array<[ControlState['status'], string]> = [
  ['all', 'Any status'],
  ['draft', 'Draft'],
  ['in_progress', 'In progress'],
  ['done', 'Done'],
];

interface Props {
  value: ControlState;
  onChange: (next: ControlState) => void;
  protocols: string[];
  tags: string[];
  shown: number;
  total: number;
}

/** Search, sort, month grouping and filters for the experiment list. */
export function ListControls({ value, onChange, protocols, tags, shown, total }: Props) {
  const set = (patch: Partial<ControlState>) => onChange({ ...value, ...patch });
  const filtered =
    value.status !== 'all' || value.protocol !== 'all' || value.from !== '' || value.to !== '' || value.tags.length > 0;

  return (
    <section aria-label="Find and sort" className="flex flex-col gap-4">
      <label className={LABEL}>
        Search titles, notes and recorded values
        <input
          type="search"
          className={INPUT}
          value={value.query}
          placeholder="For example: blot, 52 kDa, cloudy"
          onChange={(e) => set({ query: e.target.value })}
        />
      </label>

      <div className="flex flex-wrap items-end gap-3">
        <label className={`${LABEL} min-w-44 flex-1`}>
          Sort by
          <select
            className={INPUT}
            value={value.sortKey}
            onChange={(e) => set({ sortKey: e.target.value as SortKey })}
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={BUTTON_SECONDARY}
          aria-label={`Sort order: ${value.sortDir === 'desc' ? 'descending, click for ascending' : 'ascending, click for descending'}`}
          onClick={() => set({ sortDir: value.sortDir === 'desc' ? 'asc' : 'desc' })}
        >
          {value.sortDir === 'desc' ? 'Newest first ↓' : 'Oldest first ↑'}
        </button>
        <button
          type="button"
          aria-pressed={value.groupMonths}
          className={`${BUTTON_SECONDARY} ${value.groupMonths ? 'border-accent bg-accent text-on-accent' : ''}`}
          onClick={() => set({ groupMonths: !value.groupMonths })}
        >
          Group by month
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={LABEL}>
          Status
          <select
            className={INPUT}
            value={value.status}
            onChange={(e) => set({ status: e.target.value as ControlState['status'] })}
          >
            {STATUS_OPTIONS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Protocol
          <select className={INPUT} value={value.protocol} onChange={(e) => set({ protocol: e.target.value })}>
            <option value="all">Any protocol</option>
            {protocols.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          Started from
          <input type="date" className={INPUT} value={value.from} onChange={(e) => set({ from: e.target.value })} />
        </label>
        <label className={LABEL}>
          Started to
          <input type="date" className={INPUT} value={value.to} onChange={(e) => set({ to: e.target.value })} />
        </label>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-text-muted">Tags (a run must have all chosen)</span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const on = value.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  className={`inline-flex min-h-12 items-center rounded-full border px-4 text-base ${
                    on ? 'border-accent bg-accent text-on-accent' : 'border-border bg-surface text-text active:bg-surface-2'
                  }`}
                  onClick={() =>
                    set({ tags: on ? value.tags.filter((t) => t !== tag) : [...value.tags, tag] })
                  }
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-text-muted">
          Showing {shown} of {total} experiment{total === 1 ? '' : 's'}
        </p>
        {(filtered || value.query !== '') && (
          <button type="button" className={BUTTON_SECONDARY} onClick={() => onChange({ ...DEFAULT_CONTROLS, sortKey: value.sortKey, sortDir: value.sortDir, groupMonths: value.groupMonths })}>
            Clear search and filters
          </button>
        )}
      </div>
    </section>
  );
}
