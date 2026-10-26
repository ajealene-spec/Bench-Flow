import { db as defaultDb, type LabCompanionDB } from '../../db';
import { logEvent } from '../../db/executionLog';
import type { ExecutionEvent, Timer } from '../../types';
import { timerDeviation } from '../run/deviation';
import { remainingSec } from './timeMath';

/** Seconds the timer actually ran (paused time excluded), measured against its planned duration. */
export function timerActualSec(timer: Timer, now: number): number {
  return Math.max(0, timer.durationSec - remainingSec(timer, now));
}

/** Logs a timer stop with planned vs actual time. No-op for timers that do not belong to a run. */
export async function logTimerStop(
  timer: Timer,
  now: number = Date.now(),
  database: LabCompanionDB = defaultDb,
): Promise<ExecutionEvent | undefined> {
  if (!timer.experimentId) return undefined;
  const actual = timerActualSec(timer, now);
  const deviation = timerDeviation(timer.durationSec, actual);
  return logEvent(
    {
      experimentId: timer.experimentId,
      type: 'timer_stop',
      stepId: timer.stepId,
      planned: timer.durationSec,
      actual: Math.round(actual),
      unit: 's',
      note: timer.label,
      deviation,
      at: now,
    },
    database,
  );
}

/** Logs a timer start. The planned duration is recorded so a later stop can be compared with it. */
export async function logTimerStart(
  timer: Timer,
  now: number = Date.now(),
  database: LabCompanionDB = defaultDb,
): Promise<ExecutionEvent | undefined> {
  if (!timer.experimentId) return undefined;
  return logEvent(
    {
      experimentId: timer.experimentId,
      type: 'timer_start',
      stepId: timer.stepId,
      planned: timer.durationSec,
      unit: 's',
      note: timer.label,
      at: now,
    },
    database,
  );
}
