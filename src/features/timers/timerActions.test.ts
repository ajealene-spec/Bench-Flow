import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import { getTimer } from '../../db/helpers';
import type { Timer } from '../../types';
import {
  finishIfExpired,
  pauseStepTimer,
  resetStepTimer,
  resumeStepTimer,
  startStepTimer,
} from './timerActions';
import { remainingSec } from './timeMath';

const template: Timer = { id: 'def-1', stepId: 'step-1', label: 'Incubate', durationSec: 30, status: 'idle' };

let name: string;
let database: LabCompanionDB;

beforeEach(async () => {
  name = `timers-${crypto.randomUUID()}`;
  database = new LabCompanionDB(name);
  await database.open();
});

describe('timer actions', () => {
  it('creates a fresh running row per start, leaving the step definition untouched', async () => {
    const a = await startStepTimer(template, database);
    const b = await startStepTimer(template, database);
    expect(a.id).not.toBe(b.id);
    expect(a.stepId).toBe('step-1');
    expect(a.status).toBe('running');
    expect(template.status).toBe('idle');
  });

  it('pauses, resumes and resets through the db', async () => {
    const row = await startStepTimer(template, database);
    const paused = await pauseStepTimer(row.id, database);
    expect(paused?.status).toBe('paused');

    const resumed = await resumeStepTimer(row.id, database);
    expect(resumed?.status).toBe('running');

    const reset = await resetStepTimer(row.id, database);
    expect(reset).toMatchObject({ status: 'paused', pausedRemainingSec: 30 });
  });

  it('finishes an expired timer exactly once', async () => {
    const row = await startStepTimer(template, database);
    // Rewind the start time so the timer has already run out.
    await database.timers.put({ ...row, startedAt: Date.now() - 60_000 });

    const first = await finishIfExpired(row.id, database);
    const second = await finishIfExpired(row.id, database);
    expect(first?.status).toBe('done');
    expect(second).toBeUndefined();
    expect((await getTimer(row.id, database))?.status).toBe('done');
  });

  it('restores running timers after a reload with correct remaining time', async () => {
    const row = await startStepTimer(template, database);
    database.close();

    // Simulate a reload: a brand-new connection to the same database.
    const reloaded = new LabCompanionDB(name);
    await reloaded.open();
    const restored = await getTimer(row.id, reloaded);
    expect(restored?.status).toBe('running');
    expect(remainingSec(restored!, Date.now() + 10_000)).toBeCloseTo(20, 0);
    reloaded.close();
  });
});
