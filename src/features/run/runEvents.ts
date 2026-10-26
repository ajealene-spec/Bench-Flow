import type { LabCompanionDB } from '../../db';
import { db as defaultDb } from '../../db';
import { logEvent } from '../../db/executionLog';
import type { ExecutionEvent } from '../../types';
import { formatGap } from './phasePause';

/*
 * Run-level event helpers. Each one writes a single append-only row to the execution log.
 */

/** A repeated step_start for the same step within this window is a duplicate (for example, StrictMode effects). */
export const STEP_START_DEDUPE_MS = 2000;

/**
 * Logs that a step was started. Idempotent: when the latest event for this experiment and step is a
 * step_start less than STEP_START_DEDUPE_MS ago, that event is returned and nothing new is written.
 * The check and the write share one transaction, so two calls in flight cannot both log.
 */
export function logStepStart(
  experimentId: string,
  stepId: string,
  database: LabCompanionDB = defaultDb,
  now: number = Date.now(),
): Promise<ExecutionEvent> {
  return database.transaction('rw', database.executionEvents, async () => {
    const latest = await database.executionEvents
      .where('[experimentId+at]')
      .between([experimentId, -Infinity], [experimentId, Infinity])
      .filter((e) => e.stepId === stepId)
      .last();
    if (latest && latest.type === 'step_start' && now - latest.at < STEP_START_DEDUPE_MS) return latest;
    return logEvent({ experimentId, type: 'step_start', stepId, at: now }, database);
  });
}

/** A completion. `outOfOrder` is true when an earlier step is still open, which also logs a reorder. */
export async function logStepComplete(
  experimentId: string,
  stepId: string,
  outOfOrder: boolean,
  database: LabCompanionDB = defaultDb,
): Promise<ExecutionEvent[]> {
  const out = [await logEvent({ experimentId, type: 'step_complete', stepId }, database)];
  if (outOfOrder) {
    out.push(
      await logEvent(
        { experimentId, type: 'step_reorder', stepId, deviation: { kind: 'order' } },
        database,
      ),
    );
  }
  return out;
}

export function logStepSkip(experimentId: string, stepId: string, database: LabCompanionDB = defaultDb) {
  return logEvent({ experimentId, type: 'step_skip', stepId, deviation: { kind: 'skip' } }, database);
}

/** A note on a step. Marked as a deviation when the user flags it. */
export function logStepNote(
  experimentId: string,
  stepId: string,
  note: string,
  isDeviation: boolean,
  database: LabCompanionDB = defaultDb,
) {
  return logEvent(
    { experimentId, type: 'note', stepId, note, deviation: isDeviation ? { kind: 'note' } : undefined },
    database,
  );
}

export function logPhasePause(
  experimentId: string,
  phaseId: string,
  day: number,
  database: LabCompanionDB = defaultDb,
) {
  return logEvent({ experimentId, type: 'phase_pause', phaseId, note: `Day ${day} complete` }, database);
}

/** A resume. The note records how long the run was paused. */
export function logPhaseResume(
  experimentId: string,
  phaseId: string | undefined,
  pausedAt: number,
  now: number = Date.now(),
  database: LabCompanionDB = defaultDb,
) {
  return logEvent(
    {
      experimentId,
      type: 'phase_resume',
      phaseId,
      actual: now - pausedAt,
      unit: 'ms',
      note: `Resumed after ${formatGap(now - pausedAt)} gap`,
      at: now,
    },
    database,
  );
}
