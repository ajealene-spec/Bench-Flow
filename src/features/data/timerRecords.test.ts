import { describe, expect, it } from 'vitest';
import { finishTimer, pauseTimer, startTimer } from '../timers/timeMath';
import type { Timer } from '../../types';
import { timerRunRecord } from './timerRecords';
import { formatElapsed, parseDuration } from './time';

const base: Timer = {
  id: 't1',
  stepId: 'step-1',
  label: 'Incubate',
  durationSec: 600,
  status: 'idle',
  experimentId: 'exp-1',
};

describe('timer run elapsed time', () => {
  it('counts pauses in the elapsed time, from first start to stop', () => {
    // Start at 0s, pause at 10s, resume at 30s, stop (dismiss) at 50s.
    let t: Timer = { ...base, firstStartedAt: 0 };
    t = startTimer(t, 0);
    t = pauseTimer(t, 10_000);
    t = startTimer(t, 30_000);
    const record = timerRunRecord(t, 50_000);
    expect(record?.startedAt).toBe(0);
    expect(record?.stoppedAt).toBe(50_000);
    expect(record?.elapsedSec).toBe(50);
    expect(record?.kind).toBe('timer');
    expect(record?.label).toBe('Incubate');
    expect(record?.stepId).toBe('step-1');
  });

  it('records the finish time of a timer that ran to zero', () => {
    const running = startTimer({ ...base, durationSec: 30, firstStartedAt: 1_000 }, 1_000);
    const record = timerRunRecord(finishTimer(running), 31_000);
    expect(record?.elapsedSec).toBe(30);
  });

  it('does not log a run without an experiment or a start time', () => {
    expect(timerRunRecord({ ...base, experimentId: undefined, firstStartedAt: 0 }, 1000)).toBeUndefined();
    expect(timerRunRecord({ ...base }, 1000)).toBeUndefined();
  });
});

describe('time formatting', () => {
  it('formats elapsed seconds as m:ss or h:mm:ss', () => {
    expect(formatElapsed(50)).toBe('0:50');
    expect(formatElapsed(605)).toBe('10:05');
    expect(formatElapsed(3725)).toBe('1:02:05');
    expect(formatElapsed(undefined)).toBe('');
  });

  it('parses manual time taken as mm:ss or h:mm:ss', () => {
    expect(parseDuration('12:30')).toBe(750);
    expect(parseDuration('1:02:05')).toBe(3725);
    expect(parseDuration('0:45')).toBe(45);
    expect(parseDuration('12:75')).toBeUndefined();
    expect(parseDuration('90')).toBeUndefined();
    expect(parseDuration('abc')).toBeUndefined();
  });
});
