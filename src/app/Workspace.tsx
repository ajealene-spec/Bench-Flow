import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db';
import {
  createExperiment,
  createFolder,
  deleteExperiment,
  deleteFolder,
  listExperimentSummaries,
  listFolders,
  renameFolder,
  type ExperimentSummary,
} from '../db/helpers';
import { listTemplates } from '../db/templates';
import type { ExperimentStatus, Folder, ProtocolTemplate, Timer } from '../types';
import { formatDate } from './format';
import { listRecentActivity, listWorkspaceEntries, type WorkspaceEntry } from './commandCenterData';
import { StartExperimentForm } from '../features/library/StartExperimentForm';
import { formatRemaining, remainingSec } from '../features/timers/timeMath';
import { EmptyState } from './EmptyState';

const STATUS_LABEL: Record<ExperimentStatus, string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  done: 'Done',
};

const STATUS_CLASS: Record<ExperimentStatus, string> = {
  draft:'bg-surface-2 text-text',
  in_progress: 'bg-accent text-white',
  done:'bg-accent text-white',
};

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-medium';
const BUTTON_PRIMARY = `${BUTTON} bg-accent text-white active:bg-accent-hover`;
const BUTTON_SECONDARY =`${BUTTON} border border-border bg-surface shadow-card text-text active:bg-surface-2`;
const INPUT =
'min-h-12 w-full rounded-xl border border-border bg-surface shadow-card px-3 text-base text-text';
const CARD ='flex flex-col gap-3 rounded-xl border border-border bg-surface shadow-card p-4 sm:p-5';

export function Workspace() {
  const summaries = useLiveQuery(() => listExperimentSummaries(db), []);
  const folders = useLiveQuery(() => listFolders(db), []);
  const workspace = useLiveQuery(() => listWorkspaceEntries(db), []);
  const recent = useLiveQuery(() => listRecentActivity(5, db), []);
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
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-4 pb-12 sm:p-6 md:max-w-4xl lg:max-w-6xl">
      <header className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">Lab Companion</span>
        <h1 className="text-3xl font-semibold tracking-tight text-text">Command Center</h1>
      </header>

      <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          aria-expanded={picking}
          className={`${CARD} min-h-24 text-left active:bg-surface-2`}
        >
          <span className="text-lg font-semibold text-accent-text">New experiment</span>
          <span className="text-sm text-text-muted">Start a run from a protocol, or from a blank page.</span>
        </button>
        <Link to="/library/new" className={`${CARD} min-h-24 active:bg-surface-2`}>
          <span className="text-lg font-semibold text-text">Draft protocol</span>
          <span className="text-sm text-text-muted">Paste or upload a new protocol into the library.</span>
        </Link>
      </section>

      {picking && <TemplatePicker onDone={() => setPicking(false)} />}

      <section aria-label="Active workspace" className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-text">Active workspace</h2>
        {workspace === undefined && <p className="text-text-muted">Loading…</p>}
        {workspace?.length === 0 && (
          <EmptyState title="Nothing is running" primary={{ label: 'Browse protocols', to: '/library' }}>
            When you start an experiment, it appears here with its current step and any timers still running.
          </EmptyState>
        )}
        {workspace && workspace.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workspace.map((entry) => (
              <ActiveCard key={entry.experiment.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Recent activity" className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-text">Recent activity</h2>
        {recent?.length === 0 && (
          <p className="text-text-muted">Experiments you open or finish will be listed here.</p>
        )}
        {recent && recent.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {recent.map(({ experiment, at }) => (
              <li key={experiment.id} className="flex items-stretch gap-2 rounded-xl border border-border bg-surface shadow-card">
                <Link
                  to={`/experiment/${experiment.id}`}
                  className="flex min-h-12 flex-1 flex-col justify-center gap-1 rounded-l-xl p-4 active:bg-surface-2"
                >
                  <span className="font-medium text-text">{experiment.name}</span>
                  <span className="text-sm text-text-muted">
                    {experiment.endedAt ? 'Finished' : 'Opened'} {formatDate(at)} · {STATUS_LABEL[experiment.status]}
                  </span>
                </Link>
                <Link
                  to={`/experiment/${experiment.id}/report`}
                  className="flex min-h-12 items-center rounded-r-xl border-l border-border px-4 font-medium text-accent-text active:bg-surface-2"
                >
                  Report
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Folders and experiments" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-text">All experiments</h2>
          <button type="button" onClick={() => setCreatingFolder((c) => !c)} className={BUTTON_SECONDARY}>
            New folder
          </button>
        </div>

        {creatingFolder && <FolderForm onDone={() => setCreatingFolder(false)} />}

        {summaries === undefined && <p className="text-text-muted">Loading experiments…</p>}

        {summaries?.length === 0 && (
          <EmptyState
            title="No experiments yet"
            primary={{ label: 'New experiment', onClick: () => setPicking(true) }}
            secondary={{ label: 'Draft a protocol', to: '/library/new' }}
          >
            An experiment is one run of a protocol. It keeps your timers, numbers, photos and notes together, and you can file runs into folders.
          </EmptyState>
        )}

        {folders?.map((folder) => (
          <FolderSection key={folder.id} folder={folder} items={grouped.get(folder.id) ?? []} />
        ))}

        {summaries && summaries.length > 0 && (
          <Section title={folders && folders.length > 0 ? 'Unfiled' : 'Experiments'} items={unfiled} />
        )}
      </section>
    </main>
  );
}

function ActiveCard({ entry }: { entry: WorkspaceEntry }) {
  const { experiment, currentStep, completed, total, percent, runningTimers, resumeDay } = entry;
  return (
    <li className={CARD}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg font-semibold text-text">{experiment.name}</span>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm ${STATUS_CLASS[experiment.status]}`}>
          {STATUS_LABEL[experiment.status]}
        </span>
      </div>

      {resumeDay !== undefined && (
        <span className="text-sm font-semibold text-accent-text">Paused – resume Day {resumeDay}</span>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-sm text-text-muted">Current step</span>
        <span className="text-text">{currentStep?.title || (total === 0 ?'No steps yet' :'Finished')}</span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm text-text-muted">
          <span>
            {completed} of {total} steps
          </span>
          <span>{percent}%</span>
        </div>
        <div role="progressbar" aria-label={`${experiment.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-2 rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {runningTimers.length > 0 && (
        <ul className="flex flex-col gap-1">
          {runningTimers.map((timer) => (
            <li key={timer.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span className="truncate text-text-muted">{timer.label}</span>
              <LiveCountdown timer={timer} />
            </li>
          ))}
        </ul>
      )}

      <Link to={`/experiment/${experiment.id}/run`} className={`${BUTTON_PRIMARY} w-full`}>
        Resume
      </Link>
    </li>
  );
}

/** Ticks once a second so a running timer shows its live remaining time. */
function LiveCountdown({ timer }: { timer: Timer }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="font-semibold tabular-nums text-text">{formatRemaining(remainingSec(timer, now))}</span>;
}

/** Start from a protocol in the library, or from a blank experiment. */
function TemplatePicker({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const templates = useLiveQuery(() => listTemplates(db), []);
  const [chosen, setChosen] = useState<ProtocolTemplate | null>(null);
  const [blankError, setBlankError] = useState<string | null>(null);

  async function startBlank() {
    setBlankError(null);
    try {
      const experiment = await createExperiment('', db);
      navigate(`/experiment/${experiment.id}`);
    } catch {
      setBlankError('Could not create the experiment. Please try again.');
    }
  }

  return (
    <section aria-label="Start an experiment" className={CARD}>
      <h2 className="text-lg font-semibold text-text">Start from a protocol</h2>

      {templates === undefined && <p className="text-text-muted">Loading protocols…</p>}

      {templates?.length === 0 && (
        <EmptyState title="Your library is empty" primary={{ label: 'Draft a protocol', to: '/library/new' }}>
          Paste the text of a protocol or upload a PDF to make a reusable one. You can also start blank above.
        </EmptyState>
      )}

      {chosen ? (
        <StartExperimentForm template={chosen} onDone={() => setChosen(null)} />
      ) : (
        <ul className="flex flex-col gap-2">
          {templates?.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
              <div className="flex flex-col">
                <span className="font-medium text-text">{t.title}</span>
                <span className="text-sm text-text-muted">{t.category}</span>
              </div>
              <button type="button" className={BUTTON_PRIMARY} onClick={() => setChosen(t)}>
                Start
              </button>
            </li>
          ))}
        </ul>
      )}

      {blankError && <p role="alert" className="text-rose-700">{blankError}</p>}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON_SECONDARY} onClick={() => void startBlank()}>
          Start blank
        </button>
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
      className={`${CARD} sm:flex-row`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-sm font-medium text-text-muted">Folder name</span>
        <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <div className="flex gap-2 sm:items-end">
        <button type="submit" className={BUTTON_PRIMARY}>
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
            <button type="submit" className={BUTTON_PRIMARY}>
              Save
            </button>
            <button type="button" className={BUTTON_SECONDARY} onClick={() => setEditing(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-text">{folder.name}</h3>
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
      <Cards items={items} emptyText="No experiments in this folder yet. Move one here from its page." />
    </section>
  );
}

function Section({ title, items }: { title: string; items: ExperimentSummary[] }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-text">{title}</h3>
      <Cards items={items} emptyText="Every experiment is in a folder." />
    </section>
  );
}

function Cards({ items, emptyText }: { items: ExperimentSummary[]; emptyText: string }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">{emptyText}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {items.map(({ experiment, lastStepTitle }) => (
        <li key={experiment.id} className="flex items-stretch gap-2">
          <Link
            to={`/experiment/${experiment.id}`}
            className="flex min-h-12 flex-1 flex-col gap-2 rounded-xl border border-border bg-surface shadow-card p-4 active:bg-surface-2"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-lg font-medium text-text">{experiment.name}</span>
              <span className={`shrink-0 rounded-full px-3 py-1 text-sm ${STATUS_CLASS[experiment.status]}`}>
                {STATUS_LABEL[experiment.status]}
              </span>
            </div>
            <span className="text-sm text-text-muted">
              Started {formatDate(experiment.startedAt)} · Ended {formatDate(experiment.endedAt)}
            </span>
            <span className="text-sm text-text-muted">
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
