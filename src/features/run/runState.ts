import type { Procedure, RunState } from '../../types';

export type RunStateInput = Omit<RunState, 'updatedAt'>;

const unique = (ids: string[]) => [...new Set(ids)];
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function freshRunState(experimentId: string): RunStateInput {
  return { experimentId, currentStepIndex: 0, completedStepIds: [] };
}

/**
 * Rebuilds run state from storage. Tolerates a procedure that changed since the
 * last save: out-of-range indexes are clamped and unknown step ids are dropped.
 */
export function restoreRunState(experimentId: string, saved: RunState | undefined, procedure: Procedure): RunStateInput {
  if (!saved || saved.experimentId !== experimentId) return freshRunState(experimentId);
  const last = Math.max(0, procedure.steps.length - 1);
  const known = new Set(procedure.steps.map((s) => s.id));
  const index = Number.isInteger(saved.currentStepIndex) ? clamp(saved.currentStepIndex, 0, last) : 0;
  return {
    experimentId,
    currentStepIndex: index,
    completedStepIds: unique(saved.completedStepIds.filter((id) => known.has(id))),
  };
}

export function goBack(state: RunStateInput): RunStateInput {
  return { ...state, currentStepIndex: Math.max(0, state.currentStepIndex - 1) };
}

export function goNext(state: RunStateInput, procedure: Procedure): RunStateInput {
  const last = Math.max(0, procedure.steps.length - 1);
  return { ...state, currentStepIndex: Math.min(last, state.currentStepIndex + 1) };
}

export function jumpTo(state: RunStateInput, index: number, procedure: Procedure): RunStateInput {
  const last = Math.max(0, procedure.steps.length - 1);
  return { ...state, currentStepIndex: clamp(index, 0, last) };
}

/** Marks the current step complete and advances. `finished` is true when it was the last step. */
export function completeCurrentStep(
  state: RunStateInput,
  procedure: Procedure,
): { state: RunStateInput; finished: boolean } {
  const step = procedure.steps[state.currentStepIndex];
  if (!step) return { state, finished: false };
  const finished = state.currentStepIndex === procedure.steps.length - 1;
  return {
    state: { ...goNext(state, procedure), completedStepIds: unique([...state.completedStepIds, step.id]) },
    finished,
  };
}
