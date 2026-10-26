import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db';
import {
  getExperiment,
  getProcedureForExperiment,
  listFolders,
  renameExperiment,
  setExperimentFolder,
  updateExperiment,
} from '../db/helpers';
import type { ExperimentStatus } from '../types';
import { formatDate } from './format';
import { RecordedDataSummary } from '../features/data/RecordedDataSummary';

const BUTTON = 'inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-base font-medium';
const BUTTON_PRIMARY = `${BUTTON} bg-teal-700 text-white active:bg-teal-800`;
const BUTTON_SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;
const INPUT =
  'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const STATUS_LABEL: Record<ExperimentStatus, string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  done: 'Done',
};

export default function ExperimentPage() {
  const { id = '' } = useParams();
  const loaded = useLiveQuery(async () => ({ experiment: await getExperiment(id, db) }), [id]);
  const folders = useLiveQuery(() => listFolders(db), []);
  const procedure = useLiveQuery(() => getProcedureForExperiment(id, db), [id]);

  if (loaded === undefined) {
    return <main className="p-6 text-slate-600 dark:text-slate-400">Loading…</main>;
  }
  const experiment = loaded.experiment;
  if (!experiment) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <BackLink />
        <h1 className="text-2xl font-semibold">Experiment not found</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 pb-10 sm:p-6">
      <BackLink />

      <header className="flex flex-col gap-2">
        <NameField key={experiment.id} experimentId={experiment.id} initial={experiment.name} />
        <span className="text-base text-slate-600 dark:text-slate-400">
          {STATUS_LABEL[experiment.status]}
          {procedure ? ` · ${procedure.title}` : ''}
        </span>
      </header>

      <section aria-label="Dates" className="grid gap-3 sm:grid-cols-2">
        <DateRow label="Started" value={formatDate(experiment.startedAt)} />
        <DateRow label="Ended" value={formatDate(experiment.endedAt)} />
      </section>

      <section aria-label="Actions" className="flex flex-wrap gap-3">
        <Link to={`/experiment/${experiment.id}/run`} className={BUTTON_PRIMARY}>
          Continue run
        </Link>
        <Link to={`/experiment/${experiment.id}/import`} className={BUTTON_SECONDARY}>
          Re-import procedure
        </Link>
      </section>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Folder</span>
        <select
          className={INPUT}
          value={experiment.folderId ?? ''}
          onChange={(e) => void setExperimentFolder(experiment.id, e.target.value || null, db)}
        >
          <option value="">Unfiled</option>
          {folders?.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>

      <NotesField key={experiment.id} experimentId={experiment.id} initial={experiment.notes ?? ''} />

      <RecordedDataSummary experimentId={experiment.id} experimentName={experiment.name} />
    </main>
  );
}

function NameField({ experimentId, initial }: { experimentId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Name</span>
      <input
        className={`${INPUT} text-2xl font-semibold`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void renameExperiment(experimentId, value, db)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

/** Notes save automatically: after a short pause while typing, and when the field loses focus. */
function NotesField({ experimentId, initial }: { experimentId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const pending = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  function flush() {
    window.clearTimeout(timer.current);
    if (pending.current === null) return;
    const next = pending.current;
    pending.current = null;
    void updateExperiment(experimentId, { notes: next }, db);
  }

  useEffect(() => flush, []);

  return (
    <label className="flex flex-col gap-1">
      <span className="font-medium">Notes</span>
      <textarea
        className="min-h-32 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          pending.current = e.target.value;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(flush, 600);
        }}
        onBlur={flush}
      />
      <span className="text-sm text-slate-500 dark:text-slate-400">Saves automatically.</span>
    </label>
  );
}

function DateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-300 px-4 py-3 dark:border-slate-700">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className="text-lg font-medium">{value}</span>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-12 w-fit items-center rounded-lg px-3 font-medium text-teal-700 underline dark:text-teal-300"
    >
      Back to workspace
    </Link>
  );
}
