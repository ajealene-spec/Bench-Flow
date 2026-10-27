import { askConfirm } from '../../app/feedback';
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '../../db';
import { deleteExperiments, moveExperiments, addTagsToExperiments } from './experimentActions';
import { buildFolderRows, folderPredicate, type FolderSelection } from './folderRows';
import {
  buildSearchText,
  collectProtocols,
  collectTags,
  filterItems,
  groupByMonth,
  normalizeTag,
  parseDateInput,
  sortItems,
  type ListFilters,
  type ListItem,
  type MonthGroup,
} from './experimentList';
import { buildExperimentsCsv } from './exportCsv';
import { FolderPanel } from './FolderPanel';
import { ListControls, DEFAULT_CONTROLS, type ControlState } from './ListControls';
import { RunAgainPanel } from './RunAgainPanel';
import { ReproducibilityBadge } from '../insights/ReproducibilityBadge';
import { BUTTON_DANGER, BUTTON_SECONDARY, CARD, INPUT, LABEL } from './styles';
import { downloadText } from '../data/download';
import { formatDate } from '../../app/format';
import { EmptyState } from '../../app/EmptyState';
import type { Experiment, ExperimentStatus, Folder, Procedure, StepRecord } from '../../types';
import { PageHeader } from '../../app/ui';
import { isDemoExperiment, withSampleCsvNote } from '../tour/sampleNotice';

const STATUS_LABEL: Record<ExperimentStatus, string> = { draft: 'Draft', in_progress: 'In progress', done: 'Done' };

interface Loaded {
  experiments: Experiment[];
  folders: Folder[];
  procedures: Procedure[];
  records: StepRecord[];
}

async function loadAll(): Promise<Loaded> {
  const [experiments, folders, procedures, records] = await Promise.all([
    db.experiments.toArray(),
    db.folders.toArray(),
    db.procedures.toArray(),
    db.stepRecords.toArray(),
  ]);
  return { experiments, folders, procedures, records };
}

/** Joins the stored rows into list items. A run whose folder was deleted shows as Unfiled. */
function buildModel(data: Loaded) {
  const folderIds = new Set(data.folders.map((f) => f.id));
  const procByExp = new Map(data.procedures.map((p) => [p.experimentId, p]));
  const recsByExp = new Map<string, StepRecord[]>();
  for (const r of data.records) recsByExp.set(r.experimentId, [...(recsByExp.get(r.experimentId) ?? []), r]);

  const items: ListItem[] = data.experiments.map((e) => {
    const experiment = { ...e, folderId: e.folderId && folderIds.has(e.folderId) ? e.folderId : null };
    const records = recsByExp.get(e.id) ?? [];
    return {
      experiment,
      protocolTitle: procByExp.get(e.id)?.title ?? '',
      searchText: buildSearchText(experiment, records),
    };
  });
  const counts = new Map<string | null, number>();
  for (const item of items) counts.set(item.experiment.folderId, (counts.get(item.experiment.folderId) ?? 0) + 1);
  return { items, counts, procByExp, recsByExp };
}

type Model = ReturnType<typeof buildModel>;

interface DragState {
  ids: string[];
  x: number;
  y: number;
}

/** Experiments list with folders, search, sort, filters, multi-select, bulk actions and drag onto folders. */
export default function ExperimentsPage() {
  const data = useLiveQuery(loadAll, []);
  const [params, setParams] = useSearchParams();
  const [controls, setControls] = useState<ControlState>(DEFAULT_CONTROLS);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const dragRef = useRef<{ ids: string[]; x0: number; y0: number; active: boolean; over: string | null } | null>(null);

  const folders = useMemo(() => data?.folders ?? [], [data]);
  const model: Model | null = useMemo(() => (data ? buildModel(data) : null), [data]);

  const requested = params.get('folder') ?? 'all';
  const selection: FolderSelection =
    requested === 'all' || requested === 'unfiled' || folders.some((f) => f.id === requested) ? requested : 'all';

  function setSelection(next: FolderSelection) {
    setParams(next === 'all' ? {} : { folder: next }, { replace: true });
  }

  const visible = useMemo(() => {
    if (!model) return [];
    const filters: ListFilters = {
      query: controls.query,
      status: controls.status,
      protocol: controls.protocol,
      tags: controls.tags,
      startFrom: parseDateInput(controls.from, false),
      startTo: parseDateInput(controls.to, true),
    };
    const filtered = filterItems(model.items, filters, folderPredicate(selection, folders));
    return sortItems(filtered, controls.sortKey, controls.sortDir);
  }, [model, controls, selection, folders]);

  const groups: MonthGroup[] = useMemo(
    () => (controls.groupMonths ? groupByMonth(visible, controls.sortKey) : [{ key: 'all', label: '', items: visible }]),
    [visible, controls.groupMonths, controls.sortKey],
  );

  const protocols = useMemo(() => (model ? collectProtocols(model.items) : []), [model]);
  const tagChoices = useMemo(() => (model ? collectTags(model.items) : []), [model]);

  const selectedIds = [...selected].filter((id) => model?.items.some((i) => i.experiment.id === id));
  const folderName = (id: string | null) => (id === null ? 'Unfiled' : folders.find((f) => f.id === id)?.name ?? 'Unfiled');

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function moveTo(ids: string[], folderId: string | null) {
    try {
      await moveExperiments(ids, folderId, db);
      setSelected(new Set());
      setMessage(`Moved ${ids.length} experiment${ids.length === 1 ? '' : 's'} to ${folderId === null ? 'Unfiled' : folderName(folderId)}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not move them. Please try again.');
    }
  }

  // Drag: the handle captures the pointer, so moves keep coming even when the finger leaves the handle.
  function onHandleDown(e: ReactPointerEvent<HTMLButtonElement>, id: string) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ids = selected.has(id) ? selectedIds : [id];
    dragRef.current = { ids, x0: e.clientX, y0: e.clientY, active: false, over: null };
  }

  function onHandleMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d) return;
    if (!d.active && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
    d.active = true;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-folder-drop]') as HTMLElement | null;
    d.over = target?.dataset.folderDrop ?? null;
    setDropKey(d.over);
    setDrag({ ids: d.ids, x: e.clientX, y: e.clientY });
  }

  function onHandleUp() {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    setDropKey(null);
    if (!d?.active || d.over === null) return;
    void moveTo(d.ids, d.over === 'unfiled' ? null : d.over);
  }

  function onHandleCancel() {
    dragRef.current = null;
    setDrag(null);
    setDropKey(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 p-4 pb-32 sm:p-6 md:pb-12">
      <PageHeader
        title="Experiments"
        subtitle="Every run, with its status, folder and recorded data."
        actions={
          <Link to="/" className="btn btn-ghost">
            Command Center
          </Link>
        }
      />

      {data === undefined && <p className="text-text-muted">Loading experiments…</p>}

      {data && data.experiments.length === 0 && (
        <EmptyState title="No experiments yet" primary={{ label: 'Browse protocols', to: '/library' }}>
          An experiment is one run of a protocol. It keeps your timers, numbers, photos and notes together.
        </EmptyState>
      )}

      {model && data && data.experiments.length > 0 && (
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:items-start md:gap-6">
          <aside className="flex flex-col gap-3 md:sticky md:top-4 md:rounded-xl md:border md:border-border md:bg-surface md:p-3">
            <h2 className="text-lg font-semibold text-text">Folders</h2>
            <FolderPanel
              folders={folders}
              counts={model.counts}
              selection={selection}
              onSelect={setSelection}
              dropKey={dropKey}
              onMessage={setMessage}
            />
          </aside>

          <div className="flex min-w-0 flex-col gap-6">
            <ListControls
              value={controls}
              onChange={setControls}
              protocols={protocols}
              tags={tagChoices}
              shown={visible.length}
              total={model.items.length}
            />

            {message && (
              <p role="status" className="text-base text-text-muted">
                {message}
              </p>
            )}

            {visible.length === 0 && <p className="text-text-muted">No experiments match these filters in this folder.</p>}

            {groups.map((group) => (
              <section key={group.key} aria-label={group.label || 'Experiments'} className="flex flex-col gap-3">
                {group.label && (
                  <h2 className="text-lg font-semibold text-text">
                    {group.label} <span className="text-sm font-normal text-text-muted">({group.items.length})</span>
                  </h2>
                )}
                <ul className="flex flex-col gap-3">
                  {group.items.map((item) => (
                    <ExperimentCard
                      key={item.experiment.id}
                      item={item}
                      folderLabel={folderName(item.experiment.folderId)}
                      checked={selected.has(item.experiment.id)}
                      onToggle={(on) => toggle(item.experiment.id, on)}
                      onHandleDown={onHandleDown}
                      onHandleMove={onHandleMove}
                      onHandleUp={onHandleUp}
                      onHandleCancel={onHandleCancel}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      {drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent shadow-lg"
          style={{ left: drag.x + 14, top: drag.y + 14 }}
        >
          Moving {drag.ids.length} experiment{drag.ids.length === 1 ? '' : 's'}
          {dropKey ? ` to ${dropKey === 'unfiled' ? 'Unfiled' : folderName(dropKey)}` : ''}
        </div>
      )}

      {selectedIds.length > 0 && model && (
        <BulkBar
          count={selectedIds.length}
          folders={folders}
          onMove={(folderId) => void moveTo(selectedIds, folderId)}
          onTag={async (tag) => {
            try {
              await addTagsToExperiments(selectedIds, [normalizeTag(tag)].filter(Boolean), db);
              setMessage(`Tagged ${selectedIds.length} experiment${selectedIds.length === 1 ? '' : 's'}.`);
            } catch {
              setMessage('Could not add the tag. Please try again.');
            }
          }}
          onExport={() => {
            const inputs = selectedIds.map((id) => {
              const item = model.items.find((i) => i.experiment.id === id)!;
              return {
                experiment: item.experiment,
                protocolTitle: item.protocolTitle,
                procedure: model.procByExp.get(id),
                records: model.recsByExp.get(id) ?? [],
              };
            });
            const stamp = new Date().toISOString().slice(0, 10);
            const csv = '﻿' + buildExperimentsCsv(inputs);
            const hasSample = inputs.some((i) => isDemoExperiment(i.experiment));
            downloadText(`experiments-${stamp}.csv`, hasSample ? withSampleCsvNote(csv) : csv);
            setMessage(`Downloaded a CSV for ${inputs.length} experiment${inputs.length === 1 ? '' : 's'}.`);
          }}
          onDelete={async () => {
            const ok = await askConfirm({ title: `Delete ${selectedIds.length} experiment${selectedIds.length === 1 ? '' : 's'}?`, message: 'Their steps, timers and recorded data will be deleted. Protocols stay in the library.', confirmLabel: 'Delete', danger: true });
            if (!ok) return;
            try {
              await deleteExperiments(selectedIds, db);
              setSelected(new Set());
              setMessage('Deleted.');
            } catch {
              setMessage('Could not delete them. Please try again.');
            }
          }}
          onSelectVisible={() => setSelected(new Set(visible.map((i) => i.experiment.id)))}
          onClear={() => setSelected(new Set())}
        />
      )}
    </main>
  );
}

interface CardProps {
  item: ListItem;
  folderLabel: string;
  checked: boolean;
  onToggle: (on: boolean) => void;
  onHandleDown: (e: ReactPointerEvent<HTMLButtonElement>, id: string) => void;
  onHandleMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onHandleUp: () => void;
  onHandleCancel: () => void;
}

function ExperimentCard({
  item,
  folderLabel,
  checked,
  onToggle,
  onHandleDown,
  onHandleMove,
  onHandleUp,
  onHandleCancel,
}: CardProps) {
  const e = item.experiment;
  return (
    <li className={`${CARD} flex items-stretch gap-1 p-2`}>
      <label className="flex min-h-12 min-w-12 cursor-pointer items-center justify-center">
        <span className="sr-only">Select {e.name}</span>
        <input
          type="checkbox"
          className="size-6 accent-accent"
          checked={checked}
          onChange={(ev) => onToggle(ev.target.checked)}
        />
      </label>
      <button
        type="button"
        aria-label={`Drag ${e.name} onto a folder`}
        title="Drag onto a folder"
        className="flex min-h-12 min-w-12 touch-none cursor-grab select-none items-center justify-center rounded-lg text-xl text-text-muted active:bg-surface-2"
        onPointerDown={(ev) => onHandleDown(ev, e.id)}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleCancel}
      >
        ⠿
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-2 pr-2">
        <Link to={`/experiment/${e.id}`} className="flex min-h-12 flex-col justify-center gap-1 rounded-lg active:bg-surface-2">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-medium text-text">{e.name}</span>
              {isDemoExperiment(e) && (
                <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-sm font-medium text-text-muted">Sample</span>
              )}
            </span>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm text-text">{STATUS_LABEL[e.status]}</span>
          </span>
          <span className="text-sm text-text-muted">
            {item.protocolTitle || 'No protocol'} · Folder: {folderLabel}
          </span>
          <span className="text-sm text-text-muted">
            Started {formatDate(e.startedAt ?? e.createdAt)} · Ended {formatDate(e.endedAt)} · Last opened{' '}
            {formatDate(e.lastOpenedAt)}
          </span>
        </Link>
        <ReproducibilityBadge experimentId={e.id} compact />
        {(e.tags ?? []).length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {(e.tags ?? []).map((tag) => (
              <li key={tag} className="rounded-full border border-border px-3 py-1 text-sm text-text">
                {tag}
              </li>
            ))}
          </ul>
        )}
        <RunAgainPanel experiment={e} />
      </div>
    </li>
  );
}

function BulkBar(props: {
  count: number;
  folders: Folder[];
  onMove: (folderId: string | null) => void;
  onTag: (tag: string) => Promise<void>;
  onExport: () => void;
  onDelete: () => Promise<void>;
  onSelectVisible: () => void;
  onClear: () => void;
}) {
  const { count, folders } = props;
  const [tag, setTag] = useState('');
  const rows = buildFolderRows(folders);
  return (
    <section
      aria-label="Bulk actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface p-3 shadow-lg md:left-auto md:right-6 md:bottom-6 md:w-[28rem] md:rounded-xl md:border"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-text">{count} selected</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={BUTTON_SECONDARY} onClick={props.onSelectVisible}>
              Select all shown
            </button>
            <button type="button" className={BUTTON_SECONDARY} onClick={props.onClear}>
              Clear
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className={`${LABEL} min-w-40 flex-1`}>
            Move to
            <select
              className={INPUT}
              value=""
              onChange={(e) => {
                if (e.target.value === '') return;
                props.onMove(e.target.value === 'unfiled' ? null : e.target.value);
              }}
            >
              <option value="">Choose a folder</option>
              <option value="unfiled">Unfiled</option>
              {rows.map(({ folder, depth }) => (
                <option key={folder.id} value={folder.id}>
                  {`${' '.repeat(depth)}${folder.name}`}
                </option>
              ))}
            </select>
          </label>
          <form
            className="flex min-w-40 flex-1 items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!normalizeTag(tag)) return;
              void props.onTag(tag);
              setTag('');
            }}
          >
            <label className={`${LABEL} flex-1`}>
              Add tag
              <input className={INPUT} value={tag} onChange={(e) => setTag(e.target.value)} />
            </label>
            <button type="submit" className={BUTTON_SECONDARY}>
              Tag
            </button>
          </form>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON_SECONDARY} onClick={props.onExport}>
            Export CSV
          </button>
          <button type="button" className={BUTTON_DANGER} onClick={() => void props.onDelete()}>
            Delete
          </button>
        </div>
      </div>
    </section>
  );
}
