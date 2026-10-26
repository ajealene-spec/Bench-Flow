import type { Timer } from '../../types';

/*
 * Pure timer math. A running timer stores `startedAt` (wall-clock ms) and the
 * seconds that were left when that run segment began (`pausedRemainingSec`).
 * Remaining time is always derived from Date.now(), so sleep, reloads and
 * navigation do not drift the countdown.
 */

export function remainingSec(timer: Timer, now: number): number {
  if (timer.status === 'done') return 0;
  if (timer.status === 'running' && timer.startedAt !== undefined) {
    const segmentStartSec = timer.pausedRemainingSec ?? timer.durationSec;
    return Math.max(0, segmentStartSec - (now - timer.startedAt) / 1000);
  }
  return Math.max(0, timer.pausedRemainingSec ?? timer.durationSec);
}

export function isExpired(timer: Timer, now: number): boolean {
  return timer.status === 'running' && remainingSec(timer, now) <= 0;
}

/** Starts (or restarts a finished timer from full duration); resumes a paused one. */
export function startTimer(timer: Timer, now: number): Timer {
  if (timer.status === 'running') return timer;
  const from = timer.status === 'paused' ? timer.pausedRemainingSec ?? timer.durationSec : timer.durationSec;
  return { ...timer, status: 'running', startedAt: now, pausedRemainingSec: from };
}

export function pauseTimer(timer: Timer, now: number): Timer {
  if (timer.status !== 'running') return timer;
  return { ...timer, status: 'paused', pausedRemainingSec: remainingSec(timer, now), startedAt: undefined };
}

export function finishTimer(timer: Timer): Timer {
  return { ...timer, status: 'done', pausedRemainingSec: 0, startedAt: undefined };
}

/** Back to full duration, paused, so Resume starts it again. */
export function resetTimer(timer: Timer): Timer {
  return { ...timer, status: 'paused', pausedRemainingSec: timer.durationSec, startedAt: undefined };
}

/** m:ss, or h:mm:ss for an hour or more. Rounds up so 0.2s left shows as 0:01. */
export function formatRemaining(sec: number): string {
  const total = Math.max(0, Math.ceil(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
