import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { listExecutionEvents } from '../../db/executionLog';
import {
  getExperiment,
  getProcedureForExperiment,
  getRunState,
  markRunStarted,
  saveRunState,
  setExperimentStatus,
  updateExperiment,
} from '../../db/helpers';
import { getTemplate } from '../../db/templates';
import type { Hazard, Procedure, SafetyChecklistItem } from '../../types';
import { StepTimerButtons } from '../timers/StepTimerButtons';
import { StepDataPanel } from '../data/StepDataPanel';
import { FocusMode } from './FocusMode';
import { PausedPanel, PhasePausePrompt } from './PhasePausePanel';
import { ScheduleList } from './ScheduleList';
import { StepNote } from './StepNote';
import { StepText } from '../assist/StepText';
import { dayNumber, phaseEndedAt, type PhaseEnd } from './phasePause';
import { projectSchedule } from './schedule';
import {
  logPhasePause,
  logPhaseResume,
  logStepComplete,
  logStepSkip,
  logStepStart,
} from './runEvents';
import {
  completeCurrentStep,
  goBack,
  goNext,
  jumpTo,
  restoreRunState,
  type RunStateInput,
} from './runState';
import { SafetyGate, SafetySummary } from './SafetyGate';
import { buildSafetyChecklist, hazardsForStep, setItemChecked, allChecked } from './safety';

const BIG_BUTTON =
  'min-h-16 rounded-2xl px-5 text-lg font-semibold active:opacity-80 disabled:opacity-40';

interface Loaded {
  procedure: Procedure;
  state: RunStateInput;
  safety: SafetyChecklistItem[];
  safetyConfirmedAt?: number;
  /** Hazards from the source template, and the template step id for each run step (by index). */
  hazards: Hazard[];
  templateStepIds: string[];
  /** Set while the run is paused between days. */
  pausedAt?: number;
  pausedAtPhaseId?: string;
  /** True once the run has been marked finished (even if steps were skipped). */
  done: boolean;
}

export default function RunPage() {
  const { id = '' } = useParams();
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const [listOpen, setListOpen] = useState(false);
  const [focus, setFocus] = useState(true);
  const [pausePrompt, setPausePrompt] = useState<PhaseEnd | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /** Step ids that already have a step_start in the log, so each step is logged once per run. */
  const startedSteps = useRef(new Set<string>());
  const events = useLiveQuery(() => listExecutionEvents(id, db), [id], []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // Restore exact position on open, then mark the experiment as started.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [procedure, saved, experiment] = await Promise.all([
        getProcedureForExperiment(id, db),
        getRunState(id, db),
        getExperiment(id, db),
      ]);
      if (cancelled) return;
      if (!procedure) {
        setLoaded(null);
        return;
      }
      const template = experiment?.templateId ? await getTemplate(experiment.templateId, db) : undefined;
      const hazards = template?.hazards ?? [];
      let safety = experiment?.safetyChecklist ?? [];
      // Experiments created before the gate existed have no checklist yet. Build one once.
      if (safety.length === 0) {
        safety = buildSafetyChecklist(hazards);
        await updateExperiment(id, { safetyChecklist: safety }, db);
      }
      const state = restoreRunState(id, saved, procedure);
      setLoaded({
        procedure,
        state,
        safety,
        safetyConfirmedAt: experiment?.safetyConfirmedAt,
        hazards,
        templateStepIds: template?.steps.map((s) => s.id) ?? [],
        pausedAt: experiment?.pausedAt,
        pausedAtPhaseId: experiment?.pausedAtPhaseId,
        done: experiment?.status === 'done',
      });
      await saveRunState(state, db);
      const log = await listExecutionEvents(id, db);
      startedSteps.current = new Set(log.filter((e) => e.type === 'step_start').map((e) => e.stepId ?? ''));
      const current = procedure.steps[state.currentStepIndex];
      if (current && !startedSteps.current.has(current.id) && !state.completedStepIds.includes(current.id)) {
        startedSteps.current.add(current.id);
        void logStepStart(id, current.id, db);
      }
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
          className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-accent px-6 text-lg font-semibold text-white"
        >
          Go to import
        </Link>
      </main>
    );
  }

  const { procedure, state, safety, safetyConfirmedAt, hazards, templateStepIds } = loaded;
  const total = procedure.steps.length;

  // Every change goes through here so the saved position never lags the screen.
  function commit(next: RunStateInput) {
    setLoaded((prev) => (prev ? { ...prev, state: next } : prev));
    void saveRunState(next, db);
    setPausePrompt(null);
    const entered = procedure.steps[next.currentStepIndex];
    if (next.currentStepIndex !== state.currentStepIndex && entered && !startedSteps.current.has(entered.id)) {
      startedSteps.current.add(entered.id);
      void logStepStart(id, entered.id, db);
    }
  }

  async function pauseHere(end: PhaseEnd) {
    const at = Date.now();
    setPausePrompt(null);
    setLoaded((prev) => (prev ? { ...prev, pausedAt: at, pausedAtPhaseId: end.phase.id } : prev));
    await updateExperiment(id, { pausedAt: at, pausedAtPhaseId: end.phase.id }, db);
    await logPhasePause(id, end.phase.id, end.day, db);
  }

  /** Clears the pause. The saved step is untouched, so the run resumes on the exact step it stopped at. */
  async function resumeRun(pausedAt: number | undefined, pausedPhaseId: string | undefined) {
    if (pausedAt === undefined) return;
    const at = Date.now();
    await logPhaseResume(id, pausedPhaseId, pausedAt, at, db);
    await updateExperiment(id, { pausedAt: undefined, pausedAtPhaseId: undefined }, db);
    setLoaded((prev) => (prev ? { ...prev, pausedAt: undefined, pausedAtPhaseId: undefined } : prev));
  }

  // Each check is saved right away so a reload or resume keeps it.
  function toggleSafety(itemId: string, checked: boolean) {
    const next = setItemChecked(safety, itemId, checked);
    setLoaded((prev) => (prev ? { ...prev, safety: next } : prev));
    void updateExperiment(id, { safetyChecklist: next }, db);
  }

  function confirmSafety() {
    if (!allChecked(safety)) return;
    const at = Date.now();
    setLoaded((prev) => (prev ? { ...prev, safetyConfirmedAt: at } : prev));
    void updateExperiment(id, { safetyChecklist: safety, safetyConfirmedAt: at }, db);
  }

  if (total === 0) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 p-4 sm:p-6">
        <BackLink />
        <h1 className="text-2xl font-semibold">{procedure.title}</h1>
        <p className="text-slate-600 dark:text-slate-400">This procedure has no steps.</p>
        <Link to={`/experiment/${id}/import`} className="underline text-accent dark:text-slate-300">
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
  const stepHazards = hazardsForStep(hazards, templateStepIds[index]);

  function handleMarkComplete() {
    const outOfOrder = procedure.steps.slice(0, index).some((s) => !state.completedStepIds.includes(s.id));
    void logStepComplete(id, step.id, outOfOrder, db);
    const { state: next, finished } = completeCurrentStep(state, procedure);
    commit(next);
    if (finished) {
      void setExperimentStatus(id, 'done', db);
      setLoaded((prev) => (prev ? { ...prev, done: true } : prev));
      return;
    }
    setPausePrompt(phaseEndedAt(procedure.steps, procedure.phases, index) ?? null);
  }

  function handleSkip() {
    void logStepSkip(id, step.id, db);
    commit(goNext(state, procedure));
  }

  const gated = safetyConfirmedAt === undefined;
  const paused = loaded.pausedAt !== undefined;
  const schedule = projectSchedule(procedure.steps, events, now);
  const pausedDay = dayNumber(procedure.phases, loaded.pausedAtPhaseId);
  const resumeDay = dayNumber(procedure.phases, step.phaseId);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-5 p-4 pb-10 sm:p-6 lg:max-w-5xl">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BackLink />
          <span className="text-base text-slate-600 dark:text-slate-400">{procedure.title}</span>
        </div>

        {gated ? (
          <SafetyGate items={safety} onToggle={toggleSafety} onConfirm={confirmSafety} />
        ) : (
          <SafetySummary items={safety} />
        )}

        {gated && (
          <p className="text-base text-slate-600 dark:text-slate-400">The steps unlock after the safety checklist is confirmed.</p>
        )}
      </header>

      {!gated && (
        <>
        <div className="flex justify-end">
          <button
            type="button"
            aria-pressed={focus}
            onClick={() => setFocus((f) => !f)}
            className="min-h-12 rounded-lg border border-slate-300 px-4 text-base font-medium dark:border-slate-700"
          >
            Focus mode: {focus ? 'On' : 'Off'}
          </button>
        </div>
        <header className="flex flex-col gap-3">

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
              className="h-full rounded-full bg-accent transition-[width] duration-300 dark:bg-slate-300"
              style={{ width: `${(completedCount / total) * 100}%` }}
            />
          </div>
        </div>
      </header>

      {pausePrompt && !paused && <PhasePausePrompt end={pausePrompt} onPause={() => void pauseHere(pausePrompt)} onKeepGoing={() => setPausePrompt(null)} />}

      {paused ? (
        <PausedPanel
          pausedDay={pausedDay}
          resumeDay={resumeDay}
          nextStepTitle={step.title}
          experimentId={id}
          onResume={() => void resumeRun(loaded.pausedAt, loaded.pausedAtPhaseId)}
        />
      ) : focus ? (
        <>
          <FocusMode
            experimentId={id}
            step={step}
            index={index}
            total={total}
            isCompleted={isCompleted}
            hazards={stepHazards}
            isLast={isLast}
            done={loaded.done}
            onBack={() => commit(goBack(state))}
            onNext={() => commit(goNext(state, procedure))}
            onComplete={handleMarkComplete}
            onSkip={handleSkip}
          />
          {(loaded.done || completedCount === total) && <FinishLinks id={id} />}
        </>
      ) : (
        <>
      <article className="flex flex-col gap-6 rounded-2xl border border-slate-300 p-5 sm:p-8 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{step.title}</h1>
          {isCompleted && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-base font-medium text-slate-900 dark:bg-slate-400 dark:text-slate-100">
              Completed
            </span>
          )}
        </div>

        {stepHazards.length > 0 && (
          <ul aria-label="Hazards for this step" className="flex flex-wrap gap-2">
            {stepHazards.map((h) => (
              <li
                key={h.id}
                className="rounded-full bg-slate-100 px-3 py-1 text-base font-semibold text-slate-900 dark:bg-slate-400 dark:text-slate-100"
              >
                ⚠ {h.name}
              </li>
            ))}
          </ul>
        )}

        <StepText step={step} experimentId={id} />

        {step.cautions.length > 0 && (
          <section
            aria-label="Cautions"
            className="flex flex-col gap-2 rounded-xl border-2 border-slate-400 bg-slate-100 p-4 dark:border-slate-400 dark:bg-slate-900/60"
          >
            <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Caution</h2>
            <ul className="list-disc pl-6 text-lg font-medium text-slate-900 dark:text-slate-100">
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


      <StepNote experimentId={id} stepId={step.id} />

      <StepDataPanel key={step.id} experimentId={id} step={step} />

      {(loaded.done || completedCount === total) && (
        <Link to={`/experiment/${id}#recorded-data`} className="inline-flex min-h-16 items-center justify-center rounded-2xl border-2 border-accent px-5 text-lg font-semibold text-accent-hover dark:border-slate-300 dark:text-slate-300">
          View all recorded data
        </Link>
      )}
      {(loaded.done || completedCount === total) && (
        <Link to={`/experiment/${id}/report`} className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-accent px-5 text-lg font-semibold text-white">
          View report
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
          className={`${BIG_BUTTON} col-span-2 bg-accent text-white sm:col-span-1 dark:bg-accent dark:text-slate-950`}
          onClick={handleMarkComplete}
        >
          {isLast ? (loaded.done ? 'Run finished' : 'Mark complete and finish') : 'Mark complete'}
        </button>
      </nav>


        </>
      )}

      <ScheduleList items={schedule} />

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
                        ? 'bg-slate-100 font-semibold text-accent-hover dark:bg-accent-hover/50 dark:text-slate-100'
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
        </>
      )}
    </main>
  );
}

function FinishLinks({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Link to={`/experiment/${id}#recorded-data`} className="inline-flex min-h-16 items-center justify-center rounded-2xl border-2 border-accent px-5 text-lg font-semibold text-accent-hover dark:border-slate-300 dark:text-slate-300">
        View all recorded data
      </Link>
      <Link to={`/experiment/${id}/report`} className="inline-flex min-h-16 items-center justify-center rounded-2xl bg-accent px-5 text-lg font-semibold text-white">
        View report
      </Link>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-12 items-center rounded-lg px-3 font-medium text-accent underline dark:text-slate-300"
    >
      Workspace
    </Link>
  );
}
