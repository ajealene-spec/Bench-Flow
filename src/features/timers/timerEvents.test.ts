import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import { listExecutionEvents } from '../../db/executionLog';
import type { Timer } from '../../types';
import { timerActualSec, logTimerStop } from './timerEvents';
import { finishTimer, pauseTimer, startTimer } from './timeMath';
import { dismissStepTimer, startStepTimer } from './timerActions';

const template: Timer = { id: 'def', stepId: 's1', label: 'Incubate', durationSec: 600, status: 'idle', experimentId: 'exp-1' };

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`timer-events-${crypto.randomUUID()}`);
  await database.open();
});

describe('timer stop logging', () => {
  it('measures actual time without counting paused time', () => {
    const running = startTimer({ ...template, status: 'idle' }, 0);
    const paused = pauseTimer(running, 60_000); // ran 60s, then paused with 540s left
    expect(timerActualSec(paused, 10_000_000)).toBe(60);
    expect(timerActualSec(finishTimer(paused), 10_000_000)).toBe(600);
  });

  it('logs planned vs actual with no deviation when the timer ran to plan', async () => {
    const timer = startTimer({ ...template, status: 'idle' }, 0);
    const event = await logTimerStop(finishTimer(timer), 600_000, database);
    expect(event).toMatchObject({ type: 'timer_stop', planned: 600, actual: 600, unit: 's', stepId: 's1' });
    expect(event?.deviation).toBeUndefined();
  });

  it('adds a timer deviation when a run is dismissed more than 10% early', async () => {
    const started = await startStepTimer(template, database);
    await dismissStepTimer(started.id, database);
    const stops = (await listExecutionEvents('exp-1', database)).filter((e) => e.type === 'timer_stop');
    expect(stops).toHaveLength(1);
    expect(stops[0].planned).toBe(600);
    // Dismissed right away: about 0s of 600s ran, so the deviation is large and negative.
    expect(stops[0].deviation?.kind).toBe('timer');
    expect(stops[0].deviation?.delta).toBeLessThan(-500);
  });

  it('logs timer starts with the planned duration', async () => {
    await startStepTimer(template, database);
    const starts = (await listExecutionEvents('exp-1', database)).filter((e) => e.type === 'timer_start');
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ planned: 600, stepId: 's1' });
  });

  it('does not log for a timer that belongs to no run', async () => {
    const loose = startTimer({ ...template, experimentId: undefined, status: 'idle' }, 0);
    expect(await logTimerStop(loose, 1_000, database)).toBeUndefined();
  });
});
