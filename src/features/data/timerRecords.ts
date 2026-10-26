import { db as defaultDb, type LabCompanionDB } from '../../db';
import { addStepRecord } from '../../db/helpers';
import type { StepRecord, Timer } from '../../types';
import { elapsedSecBetween } from './time';

/**
 * Builds the record for one timer run. Elapsed time runs from the first start to the stop,
 * so time spent paused is included. Returns undefined when the timer has no start or no experiment.
 */
export function timerRunRecord(
  timer: Timer,
  stoppedAt: number,
): Omit<StepRecord, 'id' | 'createdAt'> | undefined {
  if (!timer.experimentId || timer.firstStartedAt === undefined) return undefined;
  return {
    experimentId: timer.experimentId,
    stepId: timer.stepId,
    kind: 'timer',
    label: timer.label,
    startedAt: timer.firstStartedAt,
    stoppedAt,
    elapsedSec: elapsedSecBetween(timer.firstStartedAt, stoppedAt),
  };
}

/** Logs a finished or dismissed timer run as a timer StepRecord. No-op when the run cannot be logged. */
export async function logTimerRun(
  timer: Timer,
  stoppedAt: number = Date.now(),
  database: LabCompanionDB = defaultDb,
): Promise<StepRecord | undefined> {
  const input = timerRunRecord(timer, stoppedAt);
  if (!input) return undefined;
  return addStepRecord(input, database);
}
