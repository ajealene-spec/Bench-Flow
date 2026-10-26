import type { LabCompanionDB } from '../db';
import { db as defaultDb } from '../db';
import { listExperiments } from '../db/helpers';
import type { Experiment, Procedure, RunState, Step, Timer } from '../types';
import { dayNumber } from '../features/run/phasePause';

/** One in-progress experiment on the home page. */
export interface WorkspaceEntry {
  experiment: Experiment;
  currentStep?: Step;
  completed: number;
  total: number;
  /** 0 to 100. */
  percent: number;
  /** Timers that are counting down for this run. */
  runningTimers: Timer[];
  /** Set while the run is paused between days: the day that the run will resume on. */
  resumeDay?: number;
}

/** A recently finished or opened experiment. */
export interface ActivityEntry {
  experiment: Experiment;
  /** The later of endedAt and lastOpenedAt. */
  at: number;
}

export function progressFor(completed: number, total: number): number {
  return total === 0 ? 0 : Math.min(100, Math.round((completed / total) * 100));
}

/** In-progress experiments with their current step, progress and running timers. */
export async function listWorkspaceEntries(database: LabCompanionDB = defaultDb): Promise<WorkspaceEntry[]> {
  const experiments = (await listExperiments(database)).filter((e) => e.status === 'in_progress');
  if (experiments.length === 0) return [];

  const [procedures, states, running] = await Promise.all([
    database.procedures.toArray(),
    database.experimentRunStates.toArray(),
    database.timers.where('status').equals('running').toArray(),
  ]);

  return experiments.map((experiment) => {
    const procedure: Procedure | undefined = procedures.find((p) => p.experimentId === experiment.id);
    const state: RunState | undefined = states.find((s) => s.experimentId === experiment.id);
    const steps = procedure?.steps ?? [];
    const stepIds = new Set(steps.map((s) => s.id));
    const completed = state?.completedStepIds.length ?? 0;
    return {
      experiment,
      currentStep: steps[state?.currentStepIndex ?? 0],
      completed,
      total: steps.length,
      percent: progressFor(completed, steps.length),
      runningTimers: running.filter((t) => t.experimentId === experiment.id || stepIds.has(t.stepId)),
      resumeDay: experiment.pausedAt !== undefined ? resumeDayFor(steps, procedure?.phases, state) : undefined,
    };
  });
}

/** The day a paused run resumes on: the day of the step it stopped at (the next step), or the day after the pause. */
function resumeDayFor(steps: Step[], phases: Procedure['phases'], state: RunState | undefined): number | undefined {
  const next = steps[state?.currentStepIndex ?? 0];
  return dayNumber(phases, next?.phaseId);
}

/** Experiments ordered by when they were last finished or opened. Never-opened experiments are left out. */
export async function listRecentActivity(limit = 5, database: LabCompanionDB = defaultDb): Promise<ActivityEntry[]> {
  const experiments = await listExperiments(database);
  return experiments
    .map((experiment) => ({ experiment, at: Math.max(experiment.endedAt ?? 0, experiment.lastOpenedAt ?? 0) }))
    .filter((entry) => entry.at > 0)
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}
