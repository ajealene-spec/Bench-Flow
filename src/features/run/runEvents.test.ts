import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import { listExecutionEvents } from '../../db/executionLog';
import { logStepStart, STEP_START_DEDUPE_MS } from './runEvents';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`run-events-${crypto.randomUUID()}`);
  await database.open();
});

describe('logStepStart dedupe', () => {
  it('skips an identical step_start within the window (StrictMode double effect)', async () => {
    const first = await logStepStart('exp-1', 's1', database, 10_000);
    const second = await logStepStart('exp-1', 's1', database, 10_000 + 200);
    expect(second.id).toBe(first.id);
    expect(await listExecutionEvents('exp-1', database)).toHaveLength(1);
  });

  it('logs again once the window has passed', async () => {
    await logStepStart('exp-1', 's1', database, 10_000);
    await logStepStart('exp-1', 's1', database, 10_000 + STEP_START_DEDUPE_MS);
    expect(await listExecutionEvents('exp-1', database)).toHaveLength(2);
  });

  it('does not dedupe across steps or experiments', async () => {
    await logStepStart('exp-1', 's1', database, 10_000);
    await logStepStart('exp-1', 's2', database, 10_000);
    await logStepStart('exp-2', 's1', database, 10_000);
    expect(await listExecutionEvents('exp-1', database)).toHaveLength(2);
    expect(await listExecutionEvents('exp-2', database)).toHaveLength(1);
  });

  it('logs when a different event for the step came last', async () => {
    await logStepStart('exp-1', 's1', database, 10_000);
    await database.executionEvents.add({ id: 'n1', experimentId: 'exp-1', stepId: 's1', type: 'note', note: 'x', at: 10_100 });
    await logStepStart('exp-1', 's1', database, 10_200);
    expect((await listExecutionEvents('exp-1', database)).map((e) => e.type)).toEqual(['step_start', 'note', 'step_start']);
  });

  it('handles concurrent calls without writing twice', async () => {
    await Promise.all([
      logStepStart('exp-1', 's1', database, 10_000),
      logStepStart('exp-1', 's1', database, 10_000),
    ]);
    expect(await listExecutionEvents('exp-1', database)).toHaveLength(1);
  });
});
