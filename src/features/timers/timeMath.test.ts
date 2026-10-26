import { describe, expect, it } from 'vitest';
import type { Timer } from '../../types';
import {
  finishTimer,
  formatRemaining,
  isExpired,
  pauseTimer,
  remainingSec,
  resetTimer,
  startTimer,
} from './timeMath';

const idle: Timer = { id: 't', stepId: 's', label: 'Incubate', durationSec: 60, status: 'idle' };

describe('timer math', () => {
  it('counts down from wall-clock time while running', () => {
    const running = startTimer(idle, 1_000);
    expect(remainingSec(running, 1_000)).toBe(60);
    expect(remainingSec(running, 16_000)).toBe(45);
  });

  it('keeps remaining time across pause and resume', () => {
    const running = startTimer(idle, 0);
    const paused = pauseTimer(running, 20_000);
    expect(paused.status).toBe('paused');
    expect(remainingSec(paused, 999_999)).toBe(40);

    const resumed = startTimer(paused, 500_000);
    expect(remainingSec(resumed, 510_000)).toBe(30);
  });

  it('reports expiry after a long sleep without ticking', () => {
    const running = startTimer(idle, 0);
    expect(isExpired(running, 59_000)).toBe(false);
    expect(isExpired(running, 3_600_000)).toBe(true);
    expect(remainingSec(running, 3_600_000)).toBe(0);
  });

  it('pausing or starting twice does not change the state', () => {
    const running = startTimer(idle, 0);
    expect(startTimer(running, 5_000)).toBe(running);
    expect(pauseTimer(idle, 5_000)).toBe(idle);
  });

  it('finish and reset return the expected states', () => {
    const finished = finishTimer(startTimer(idle, 0));
    expect(finished.status).toBe('done');
    expect(remainingSec(finished, 1e9)).toBe(0);

    const reset = resetTimer(pauseTimer(startTimer(idle, 0), 10_000));
    expect(reset).toMatchObject({ status: 'paused', pausedRemainingSec: 60 });
    expect(remainingSec(reset, 1e9)).toBe(60);
  });

  it('formats durations for the tray', () => {
    expect(formatRemaining(0)).toBe('0:00');
    expect(formatRemaining(0.2)).toBe('0:01');
    expect(formatRemaining(75)).toBe('1:15');
    expect(formatRemaining(3725)).toBe('1:02:05');
  });
});
