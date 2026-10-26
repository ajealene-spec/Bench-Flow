import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db';
import {
  createFolder,
  deleteExperiment,
  deleteFolder,
  listExperimentSummaries,
  listFolders,
  renameFolder,
  type ExperimentSummary,
} from '../db/helpers';
import { listTemplates } from '../db/templates';
import type { ExperimentStatus, Folder, ProtocolTemplate } from '../types';
import { formatDate } from './format';
import { StartExperimentForm } from '../features/library/StartExperimentForm';

const STATUS_LABEL: Record<ExperimentStatus, string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  done: 'Done',
};

const STATUS_CLASS: Record<ExperimentStatus, string> = {
  draft: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  in_progress: 'bg-amber-200 text-amber-900 dark:bg-amber-700 dark:text-amber-50',
  done: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-700 dark:text-emerald-50',
};

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;
const INPUT =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export function Workspace() {
  const summaries = useLiveQuery(() => listExperimentSummaries(db), []);
  const folders = useLiveQuery(() => listFolders(db), []);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [picking, setPicking] = useState(false);

  // Experiments whose folder was removed (for example on another device) fall back to Unfiled.
  const folderIds = new Set(folders?.map((f) => f.id) ?? []);
  const grouped = new Map<string | null, ExperimentSummary[]>();
  for (const summary of summaries ?? []) {
    const key = summary.experiment.folderId && folderIds.has(summary.experiment.folderId) ? summary.experiment.folderId : null;
    grouped.set(key, [...(grouped.get(key) ?? []), summary]);
  }
  const unfiled = grouped.get(null) ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm text-slate-500 dark:text-slate-400">Lab Companion</span>
          <h1 className="text-2xl font-semibold">Experiments</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCreatingFolder((c) => !c)} className={BUTTON_SECONDARY}>
            New folder
          </button>
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            aria-expanded={picking}
            className={`${BUTTON} bg-teal-700 px-5 text-white active:bg-teal-800`}
          >
            New experiment
          </button>
        </div>
      </header>

      {picking && <TemplatePicker onDone={() => setPicking(false)} />}

      {creatingFolder && (
        <FolderForm
          onDone={() => setCreatingFolder(false)}
        />
      )}

      {summaries === undefined && <p className="text-slate-500">Loading experiments…</p>}

      {summaries?.length === 0 && (
        <p className="text-slate-600 dark:text-slate-400">No experiments yet. Tap “New experiment” to start one.</p>
      )}

      {folders?.map((folder) => (
        <FolderSection key={folder.id} folder={folder} items={grouped.get(folder.id) ?? []} />
      ))}

      {summaries && summaries.length > 0 && (
        <Section title={folders && folders.length > 0 ? 'Unfiled' : 'All experiments'} items={unfiled} />
      )}
    </main>
  );
}

/** "New experiment": pick a protocol from the library, or paste a new one. */
function TemplatePicker({ onDone }: { onDone: () => void }) {
  const templates = useLiveQuery(() => listTemplates(db), []);
  const [chosen, setChosen] = useState<ProtocolTemplate | null>(null);

  return (
    <section aria-label="Start an experiment" className="flex flex-col gap-3 rounded-xl border border-slate-300 p-4 dark:border-slate-700">
      <h2 className="text-lg font-semibold">Start from a protocol</h2>

      {templates === undefined && <p className="text-slate-500">Loading protocols…</p>}

      {templates?.length === 0 && <p className="text-slate-600 dark:text-slate-400">The library is empty.</p>}

      {chosen ? (
        <StartExperimentForm template={chosen} onDone={() => setChosen(null)} />
      ) : (
        <ul className="flex flex-col gap-2">
          {templates?.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-col">
                <span className="font-medium">{t.title}</span>
                <span className="text-sm text-slate-600 dark:text-slate-400">{t.category}</span>
              </div>
              <button type="button" className={`${BUTTON} bg-teal-700 px-5 text-white active:bg-teal-800`} onClick={() => setChosen(t)}>
                Start
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Link to="/library/new" className={`${BUTTON} bg-teal-700 px-5 text-white active:bg-teal-800`}>
          Paste a new protocol
        </Link>
        <button type="button" className={BUTTON_SECONDARY} onClick={onDone}>
          Close
        </button>
      </div>
    </section>
  );
}

function FolderForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  async function submit() {
    await createFolder(name);
    onDone();
  }
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-slate-300 p-4 sm:flex-row dark:border-slate-700"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-sm font-medium">Folder name</span>
        <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="flex gap-2 sm:items-end">
        <button type="submit" className={`${BUTTON} bg-teal-700 text-white active:bg-teal-800`}>
          Create folder
        </button>
        <button type="button" className={BUTTON_SECONDARY} onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function FolderSection({ folder, items }: { folder: Folder; items: ExperimentSummary[] }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);

  async function save() {
    await renameFolder(folder.id, name);
    setEditing(false);
  }

  async function remove() {
    const ok = window.confirm(`Delete the folder “${folder.name}”? Its experiments will move to Unfiled.`);
    if (ok) await deleteFolder(folder.id);
  }

  return (
    <section aria-label={`Folder ${folder.name}`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {editing ? (
          <form
            className="flex flex-1 flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="flex-1">
              <span className="sr-only">Folder name</span>
              <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </label>
            <button type="submit" className={`${BUTTON} bg-teal-700 text-white active:bg-teal-800`}>
              Save
            </button>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h2 className="text-lg font-semibold">{folder.name}</h2>
            <div className="flex gap-2">
              <button
                type="button"
                className={BUTTON_SECONDARY}
                onClick={() => {
                  setName(folder.name);
                  setEditing(true);
                }}
              >
                Rename
              </button>
              <button type="button" className={BUTTON_SECONDARY} onClick={() => void remove()}>
                Delete folder
              </button>
            </div>
          </>
        )}
      </div>
      <Cards items={items} emptyText="No experiments in this folder yet." />
    </section>
  );
}

function Section({ title, items }: { title: string; items: ExperimentSummary[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Cards items={items} emptyText="Nothing unfiled." />
    </section>
  );
}

function Cards({ items, emptyText }: { items: ExperimentSummary[]; emptyText: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map(({ experiment, lastStepTitle }) => (
        <li key={experiment.id} className="flex items-stretch gap-2">
          <Link
            to={`/experiment/${experiment.id}`}
            className="flex min-h-12 flex-1 flex-col gap-2 rounded-xl border border-slate-300 p-4 active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-800"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-lg font-medium">{experiment.name}</span>
              <span className={`rounded-full px-3 py-1 text-sm ${STATUS_CLASS[experiment.status]}`}>
                {STATUS_LABEL[experiment.status]}
              </span>
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Started {formatDate(experiment.startedAt)} · Ended {formatDate(experiment.endedAt)}
            </span>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {lastStepTitle ? `Last step: ${lastStepTitle}` : 'No steps yet'}
            </span>
          </Link>
          <DeleteExperimentButton id={experiment.id} name={experiment.name} />
        </li>
      ))}
    </ul>
  );
}

function DeleteExperimentButton({ id, name }: { id: string; name: string }) {
  async function remove() {
    const ok = window.confirm(
      `Delete the experiment “${name}”? Its steps, timers and recorded data will be deleted. The protocol stays in the library.`,
    );
    if (ok) await deleteExperiment(id, db);
  }
  return (
    <button type="button" className={`${BUTTON_SECONDARY} shrink-0 self-start`} onClick={() => void remove()}>
      Delete
    </button>
  );
}
