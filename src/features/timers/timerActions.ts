import { db as defaultDb, type LabCompanionDB } from '../../db';
import { deleteTimer as deleteTimerRow, newId, saveTimer } from '../../db/helpers';
import type { Timer } from '../../types';
import { logTimerRun } from '../data/timerRecords';
import { finishTimer, isExpired, pauseTimer, resetTimer, startTimer } from './timeMath';

/*
 * Each run of a step timer is its own row in the `timers` table. Read-modify-write
 * happens inside a transaction so a tap and the tray's expiry check cannot clash.
 */

async function updateRow(
  id: string,
  change: (timer: Timer, now: number) => Timer | undefined,
  database: LabCompanionDB,
): Promise<Timer | undefined> {
  return database.transaction('rw', database.timers, async () => {
    const current = await database.timers.get(id);
    if (!current) return undefined;
    const next = change(current, Date.now());
    if (!next || next === current) return current;
    await database.timers.put(next);
    return next;
  });
}

/** Creates a running row from a step's timer definition. */
export async function startStepTimer(template: Timer, database: LabCompanionDB = defaultDb): Promise<Timer> {
  const row: Timer = {
    ...template,
    id: newId(),
    status: 'idle',
    startedAt: undefined,
    pausedRemainingSec: undefined,
  };
  const now = Date.now();
  const running: Timer = { ...startTimer(row, now), firstStartedAt: now };
  await saveTimer(running, database);
  return running;
}

export function pauseStepTimer(id: string, database: LabCompanionDB = defaultDb) {
  return updateRow(id, (t, now) => pauseTimer(t, now), database);
}

export function resumeStepTimer(id: string, database: LabCompanionDB = defaultDb) {
  return updateRow(id, (t, now) => ({ ...startTimer(t, now), firstStartedAt: t.firstStartedAt ?? now }), database);
}

export function resetStepTimer(id: string, database: LabCompanionDB = defaultDb) {
  // A reset discards the run in progress, so it is not logged when dismissed.
  return updateRow(id, (t) => ({ ...resetTimer(t), firstStartedAt: undefined }), database);
}

/**
 * Removes a timer from the tray. A run that was still going (running or paused) is logged first.
 * A finished run was already logged when it finished, so it is not logged again.
 */
export async function dismissStepTimer(id: string, database: LabCompanionDB = defaultDb) {
  const current = await database.timers.get(id);
  if (current && current.status !== 'done') await logTimerRun(current, Date.now(), database);
  return deleteTimerRow(id, database);
}

/**
 * Marks a running timer done if its time has passed. Returns the finished timer
 * only when this call did the transition, so the alarm fires exactly once.
 */
export async function finishIfExpired(id: string, database: LabCompanionDB = defaultDb): Promise<Timer | undefined> {
  let finished: Timer | undefined;
  await database.transaction('rw', database.timers, async () => {
    const current = await database.timers.get(id);
    if (!current || !isExpired(current, Date.now())) return;
    finished = finishTimer(current);
    await database.timers.put(finished);
  });
  // Logged here, on the one transition that returns a value, so a run is recorded exactly once.
  if (finished) await logTimerRun(finished, Date.now(), database);
  return finished;
}
