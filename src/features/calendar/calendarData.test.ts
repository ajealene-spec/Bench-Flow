import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import { createTask } from '../../db/tasks';
import type { Experiment, ExecutionEvent, Procedure, Step } from '../../types';
import { listCalendarItems } from './calendarData';
import { moveExperimentToDay, setPlannedStart } from './experimentSchedule';

let db: LabCompanionDB;

beforeEach(async () => {
  db = new LabCompanionDB(`calendar-${crypto.randomUUID()}`);
  await db.open();
});

afterEach(() => {
  db.close();
});

const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();

function step(id: string, hours: number, phaseId: string): Step {
  return { id, title: id, instructions: '', durationSec: hours * 3600, timers: [], reagents: [], dataFields: [], cautions: [], phaseId };
}

async function seedRun(plannedStart: number | undefined, startedAt?: number, events: ExecutionEvent[] = []) {
  const experiment: Experiment = {
    id: 'exp-1',
    name: 'Run 1',
    status: 'in_progress',
    folderId: null,
    plannedStart,
    startedAt,
    createdAt: 0,
    updatedAt: 0,
  } as Experiment;
  const procedure: Procedure = {
    id: 'proc-1',
    experimentId: 'exp-1',
    title: 'Western Blot',
    steps: [step('lysis', 2, 'prep'), step('primary', 3, 'ab')],
    phases: [
      { id: 'prep', name: 'Prep' },
      { id: 'ab', name: 'Antibody' },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
  await db.experiments.put(experiment);
  await db.procedures.put(procedure);
  await db.executionEvents.bulkPut(events);
}

describe('listCalendarItems', () => {
  it('expands a scheduled run and general tasks from the database', async () => {
    await seedRun(at(5, 9));
    await createTask({ title: 'Order antibody', date: '2026-10-05', time: '08:00', done: false }, db);

    const items = await listCalendarItems('2026-10-05', '2026-10-06', db, at(1, 0));
    expect(items.tasks.map((t) => t.task.title)).toEqual(['Order antibody']);
    expect(items.blocks.map((b) => b.label)).toEqual([
      'Western Blot — Day 1: Prep',
      'Western Blot — Day 1: Antibody',
    ]);
  });

  it('skips runs with no start time and returns nothing outside the range', async () => {
    await seedRun(undefined);
    await createTask({ title: 'Later', date: '2026-11-01', done: false }, db);
    const items = await listCalendarItems('2026-10-05', '2026-10-06', db, at(1, 0));
    expect(items).toEqual({ tasks: [], blocks: [] });
  });

  it('rolls a multi-day run into the next day and shifts remaining phases after a pause', async () => {
    const events: ExecutionEvent[] = [
      { id: 'e1', experimentId: 'exp-1', at: at(5, 11), type: 'step_complete', stepId: 'lysis' },
      { id: 'e2', experimentId: 'exp-1', at: at(5, 11), type: 'phase_pause', phaseId: 'prep' },
      { id: 'e3', experimentId: 'exp-1', at: at(5, 14), type: 'phase_resume', phaseId: 'prep' },
    ];
    await seedRun(at(5, 9), at(5, 9), events);
    const items = await listCalendarItems('2026-10-05', '2026-10-06', db, at(5, 12));
    const primary = items.blocks.find((b) => b.phaseId === 'ab');
    expect(primary).toMatchObject({ date: '2026-10-05', startMin: 14 * 60, endMin: 17 * 60 });
  });
});

describe('scheduling writes', () => {
  it('setPlannedStart writes the start and clearing removes it', async () => {
    await seedRun(undefined);
    await setPlannedStart('exp-1', at(7, 10), db);
    expect((await db.experiments.get('exp-1'))?.plannedStart).toBe(at(7, 10));
    await setPlannedStart('exp-1', undefined, db);
    expect((await db.experiments.get('exp-1'))?.plannedStart).toBeUndefined();
  });

  it('moveExperimentToDay moves an unstarted run and leaves a started one alone', async () => {
    await seedRun(at(5, 9));
    await moveExperimentToDay('exp-1', '2026-10-05', '2026-10-08', db);
    expect((await db.experiments.get('exp-1'))?.plannedStart).toBe(at(8, 9));

    await db.experiments.update('exp-1', { startedAt: at(8, 9) });
    await moveExperimentToDay('exp-1', '2026-10-08', '2026-10-12', db);
    expect((await db.experiments.get('exp-1'))?.plannedStart).toBe(at(8, 9));
  });
});
