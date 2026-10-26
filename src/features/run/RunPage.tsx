import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../../db';
import { getProcedureForExperiment, getRunState, markRunStarted, saveRunState, setExperimentStatus, updateExperiment } from '../../db/helpers';
import type { Procedure } from '../../types';
import { StepTimerButtons } from '../timers/StepTimerButtons';
import { StepDataPanel } from '../data/StepDataPanel';
import {
  completeCurrentStep,
  goBack,
  goNext,
  jumpTo,
  restoreRunState,
  type RunStateInput,
} from './runState';

const BIG_BUTTON =
  'min-h-16 rounded-2xl px-5 text-lg font-semibold active:opacity-80 disabled:opacity-40';

interface Loaded {
  procedure: Procedure;
  state: RunStateInput;
}

export default function RunPage() {
  const { id = '' } = useParams();
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const [listOpen, setListOpen] = useState(false);

  // Restore exact position on open, then mark the experiment as started.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [procedure, saved] = await Promise.all([getProcedureForExperiment(id, db), getRunState(id, db)]);
      if (cancelled) return;
      if (!procedure) {
        setLoaded(null);
        return;
      }
      const state = restoreRunState(id, saved, procedure);
      setLoaded({ procedure, state });
      await saveRunState(state, db);
      await markRunStarted(id, db);
      await updateExperiment(id, { lastOpenedAt: Date.now() }, db);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loaded === undefined) {
    return <main className="p-6 text-slate-500">Loading run…</main>;
  }

  if (loaded === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <BackLink />
        <h1 className="text-2xl font-semibold">No procedure yet</h1>
        <p className="text-slate-600 dark:text-slate-400">Import or write a procedure for this experiment before running it.</p>
        <Link
          to={`/experiment/${id}/import`}
          className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-teal-700 px-6 text-lg font-semibold text-white"
        >
          Go to import
        </Link>
      </main>
    );
  }

  const { procedure, state } = loaded;
  const total = procedure.steps.length;

  // Every change goes through here so the saved position never lags the screen.
  function commit(next: RunStateInput) {
    setLoaded({ procedure, state: next });
    void saveRunState(next, db);
  }

  if (total === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <BackLink />
        <h1 className="text-2xl font-semibold">{procedure.title}</h1>
        <p className="text-slate-600 dark:text-slate-400">This procedure has no steps.</p>
        <Link to={`/experiment/${id}/import`} className="underline text-teal-700 dark:text-teal-300">
          Edit procedure
        </Link>
      </main>
    );
  }

  const index = state.currentStepIndex;
  const step = procedure.steps[index];
  const isLast = index === total - 1;
  const isCompleted = state.completedStepIds.includes(step.id);
  const completedCount = state.completedStepIds.length;

  function handleMarkComplete() {
    const { state: next, finished } = completeCurrentStep(state, procedure);
    commit(next);
    if (finished) void setExperimentStatus(id, 'done', db);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 p-4 pb-10 sm:p-6 lg:max-w-5xl">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BackLink />
          <span className="text-base text-slate-600 dark:text-slate-400">{procedure.title}</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-base text-slate-700 dark:text-slate-300">
            <span>
              Step {index + 1} of {total}
            </span>
            <span>{completedCount} complete</span>
          </div>
          <div
            role="progressbar"
            aria-label="Procedure progress"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={completedCount}
            className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
          >
            <div
              className="h-full rounded-full bg-teal-600 transition-[width] duration-300 dark:bg-teal-400"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <article className="flex flex-col gap-6 rounded-2xl border border-slate-300 p-5 sm:p-8 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{step.title}</h1>
          {isCompleted && (
            <span className="rounded-full bg-emerald-200 px-3 py-1 text-base font-medium text-emerald-900 dark:bg-emerald-700 dark:text-emerald-50">
              Completed
            </span>
          )}
        </div>

        {step.instructions && (
          <p className="whitespace-pre-line text-xl leading-relaxed">{step.instructions}</p>
        )}

        {step.cautions.length > 0 && (
          <section
            aria-label="Cautions"
            className="flex flex-col gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 dark:border-amber-400 dark:bg-amber-950/60"
          >
            <h2 className="text-lg font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">Caution</h2>
            <ul className="list-disc pl-6 text-lg font-medium text-amber-950 dark:text-amber-50">
              {step.cautions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        )}

        {step.reagents.length > 0 && (
          <section aria-label="Reagents" className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Reagents</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {step.reagents.map((r, i) => (
                <li
                  key={`${r.name}-${i}`}
                  className="rounded-lg bg-slate-100 px-4 py-3 text-lg dark:bg-slate-800"
                >
                  <span className="font-medium">{r.name}</span>
                  {(r.amount || r.unit) && (
                    <span className="text-slate-600 dark:text-slate-300">
                      {' '}
                      — {[r.amount, r.unit].filter(Boolean).join(' ')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <StepTimerButtons timers={step.timers} experimentId={id} />
      </article>

      <StepDataPanel key={step.id} experimentId={id} step={step} />

      {completedCount === total && (
        <Link to={`/experiment/${id}#recorded-data`} className="inline-flex min-h-16 items-center justify-center rounded-2xl border-2 border-teal-700 px-5 text-lg font-semibold text-teal-800 dark:border-teal-400 dark:text-teal-200">
          View all recorded data
        </Link>
      )}

      <nav aria-label="Step navigation" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <button
          type="button"
          className={`${BIG_BUTTON} bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
          disabled={index === 0}
          onClick={() => commit(goBack(state))}
        >
          Back
        </button>
        <button
          type="button"
          className={`${BIG_BUTTON} bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
          disabled={isLast}
          onClick={() => commit(goNext(state, procedure))}
        >
          Next
        </button>
        <button
          type="button"
          className={`${BIG_BUTTON} col-span-2 bg-teal-700 text-white sm:col-span-1 dark:bg-teal-500 dark:text-slate-950`}
          onClick={handleMarkComplete}
        >
          {isLast ? 'Mark complete and finish' : 'Mark complete'}
        </button>
      </nav>

      <section aria-label="Step list" className="flex flex-col gap-3">
        <button
          type="button"
          aria-expanded={listOpen}
          aria-controls="step-list"
          onClick={() => setListOpen((o) => !o)}
          className="flex min-h-16 items-center justify-between rounded-2xl border border-slate-300 px-5 text-lg font-semibold dark:border-slate-700"
        >
          <span>All steps ({total})</span>
          <span aria-hidden="true">{listOpen ? 'Hide' : 'Show'}</span>
        </button>
        {listOpen && (
          <ol id="step-list" className="flex flex-col gap-2">
            {procedure.steps.map((s, i) => {
              const done = state.completedStepIds.includes(s.id);
              const current = i === index;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-current={current ? 'step' : undefined}
                    onClick={() => commit(jumpTo(state, i, procedure))}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-4 text-left text-lg ${
                      current
                        ? 'bg-teal-100 font-semibold text-teal-900 dark:bg-teal-900/50 dark:text-teal-50'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span aria-hidden="true" className="w-6 text-center">
                      {done ? '✓' : i + 1}
                    </span>
                    <span>{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-12 items-center rounded-lg px-3 font-medium text-teal-700 underline dark:text-teal-300"
    >
      Workspace
    </Link>
  );
}
