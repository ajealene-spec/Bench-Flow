import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import { listExecutionEvents, logEvent } from './executionLog';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`log-${crypto.randomUUID()}`);
  await database.open();
});

describe('logEvent', () => {
  it('assigns an id and the current time, and stores the event as given', async () => {
    const before = Date.now();
    const event = await logEvent({ experimentId: 'exp-1', type: 'step_start', stepId: 's1' }, database);
    expect(event.id).toBeTruthy();
    expect(event.at).toBeGreaterThanOrEqual(before);
    expect(await database.executionEvents.get(event.id)).toEqual(event);
  });

  it('keeps an explicit time and deviation', async () => {
    const event = await logEvent(
      {
        experimentId: 'exp-1',
        type: 'timer_stop',
        stepId: 's1',
        planned: 60,
        actual: 30,
        unit: 's',
        at: 1_000,
        deviation: { kind: 'timer', delta: -30, tolerance: 0.1 },
      },
      database,
    );
    expect(event.at).toBe(1_000);
    expect(event.deviation).toEqual({ kind: 'timer', delta: -30, tolerance: 0.1 });
  });

  it('only appends: two calls make two rows, and listing returns them oldest first', async () => {
    await logEvent({ experimentId: 'exp-1', type: 'note', note: 'second', at: 500 }, database);
    await logEvent({ experimentId: 'exp-1', type: 'note', note: 'first', at: 100 }, database);
    await logEvent({ experimentId: 'exp-2', type: 'note', note: 'other run', at: 50 }, database);

    const events = await listExecutionEvents('exp-1', database);
    expect(events.map((e) => e.note)).toEqual(['first', 'second']);
    expect(await database.executionEvents.count()).toBe(3);
  });
});
