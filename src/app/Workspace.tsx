import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../db';
import { createLab, listLabSummaries } from '../db/helpers';
import type { LabStatus } from '../types';

const STATUS_LABEL: Record<LabStatus, string> = {
  draft: 'Draft',
  in_progress: 'In progress',
  done: 'Done',
};

const STATUS_CLASS: Record<LabStatus, string> = {
  draft: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  in_progress: 'bg-amber-200 text-amber-900 dark:bg-amber-700 dark:text-amber-50',
  done: 'bg-emerald-200 text-emerald-900 dark:bg-emerald-700 dark:text-emerald-50',
};

export function Workspace() {
  const navigate = useNavigate();
  const summaries = useLiveQuery(() => listLabSummaries(db), []);

  async function handleCreate() {
    const lab = await createLab('Untitled lab');
    navigate(`/lab/${lab.id}/import`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 p-4 sm:p-6 lg:max-w-5xl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Lab Companion</h1>
        <button
          type="button"
          onClick={handleCreate}
          className="min-h-12 rounded-xl bg-teal-700 px-5 font-medium text-white active:bg-teal-800"
        >
          New lab
        </button>
      </header>

      {summaries === undefined && <p className="text-slate-500">Loading labs…</p>}

      {summaries?.length === 0 && (
        <p className="text-slate-600 dark:text-slate-400">No labs yet. Tap “New lab” to start one.</p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {summaries?.map(({ lab, lastStepTitle }) => (
          <li key={lab.id}>
            <Link
              to={lab.status === 'draft' ? `/lab/${lab.id}/import` : `/lab/${lab.id}/run`}
              className="flex min-h-12 flex-col gap-2 rounded-xl border border-slate-300 p-4 active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-lg font-medium">{lab.name}</span>
                <span className={`rounded-full px-3 py-1 text-sm ${STATUS_CLASS[lab.status]}`}>
                  {STATUS_LABEL[lab.status]}
                </span>
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {lastStepTitle ? `Last step: ${lastStepTitle}` : 'No steps yet'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
