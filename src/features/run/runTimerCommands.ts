import { db as defaultDb } from '../../db';
import { listActiveTimers } from '../../db/helpers';
import type { Step, Timer } from '../../types';
import { requestNotificationPermission, unlockAlarmAudio } from '../timers/alarm';
import { pauseStepTimer, resumeStepTimer, startStepTimer } from '../timers/timerActions';

/*
 * Timer actions for the current step, shared by keyboard shortcuts and voice commands.
 * Each one is a user gesture, so audio and notification permission are requested here.
 */

/** Starts, resumes or pauses the current step's timer. Returns what happened. */
export async function toggleStepTimer(step: Step, experimentId: string): Promise<'started' | 'resumed' | 'paused' | 'none'> {
  const active = (await listActiveTimers(defaultDb)).filter((t) => t.experimentId === experimentId && t.stepId === step.id);
  const running = active.filter((t) => t.status === 'running');
  if (running.length > 0) {
    for (const timer of running) await pauseStepTimer(timer.id);
    return 'paused';
  }
  unlockAlarmAudio();
  void requestNotificationPermission();
  const paused = active.find((t) => t.status === 'paused');
  if (paused) {
    await resumeStepTimer(paused.id);
    return 'resumed';
  }
  const template = step.timers[0];
  if (!template) return 'none';
  await startStepTimer({ ...template, experimentId });
  return 'started';
}

/**
 * Starts (or resumes a paused) timer of the current step without ever pausing one. Used by the
 * "start timer" voice command, so saying it twice does not stop the timer.
 */
export async function startStepTimerFor(step: Step, experimentId: string): Promise<'started' | 'resumed' | 'running' | 'none'> {
  const active = (await listActiveTimers(defaultDb)).filter((t) => t.experimentId === experimentId && t.stepId === step.id);
  if (active.some((t) => t.status === 'running')) return 'running';
  const paused = active.find((t) => t.status === 'paused');
  unlockAlarmAudio();
  void requestNotificationPermission();
  if (paused) {
    await resumeStepTimer(paused.id);
    return 'resumed';
  }
  const template = step.timers[0];
  if (!template) return 'none';
  await startStepTimer({ ...template, experimentId });
  return 'started';
}

/** Starts one specific timer definition from a step's list (the dense view's Start buttons). */
export async function startTimerNow(timer: Timer, experimentId: string): Promise<void> {
  unlockAlarmAudio();
  void requestNotificationPermission();
  await startStepTimer({ ...timer, experimentId });
}

/** Pauses every running timer of this run. Returns how many were paused. */
export async function pauseRunTimers(experimentId: string): Promise<number> {
  const running = (await listActiveTimers(defaultDb)).filter((t) => t.experimentId === experimentId && t.status === 'running');
  for (const timer of running) await pauseStepTimer(timer.id);
  return running.length;
}
