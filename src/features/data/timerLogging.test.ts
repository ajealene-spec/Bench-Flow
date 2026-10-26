import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import { listStepRecords } from '../../db/helpers';
import type { Timer } from '../../types';
import { dismissStepTimer, finishIfExpired, resetStepTimer, startStepTimer } from '../timers/timerActions';

const template: Timer = { id: 'def-1', stepId: 'step-1', label: 'Incubate', durationSec: 600, status: 'idle', experimentId: 'exp-1' };

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`timer-log-${crypto.randomUUID()}`);
  await database.open();
});

describe('timer runs become step records', () => {
  it('logs a running timer when it is dismissed', async () => {
    const run = await startStepTimer(template, database);
    await dismissStepTimer(run.id, database);
    const records = await listStepRecords('exp-1', database);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ kind: 'timer', stepId: 'step-1', label: 'Incubate' });
    expect(records[0].elapsedSec).toBeGreaterThanOrEqual(0);
    expect(records[0].startedAt).toBe(run.firstStartedAt);
  });

  it('logs a finished timer once, and not again when dismissed', async () => {
    const run = await startStepTimer({ ...template, durationSec: 0 }, database);
    const finished = await finishIfExpired(run.id, database);
    expect(finished).toBeDefined();
    await dismissStepTimer(run.id, database);
    expect(await listStepRecords('exp-1', database)).toHaveLength(1);
  });

  it('does not log a run that was reset before it was dismissed', async () => {
    const run = await startStepTimer(template, database);
    await resetStepTimer(run.id, database);
    await dismissStepTimer(run.id, database);
    expect(await listStepRecords('exp-1', database)).toHaveLength(0);
  });

  it('does not log timers that have no experiment', async () => {
    const run = await startStepTimer({ ...template, experimentId: undefined }, database);
    await dismissStepTimer(run.id, database);
    expect(await listStepRecords('exp-1', database)).toHaveLength(0);
  });
});
