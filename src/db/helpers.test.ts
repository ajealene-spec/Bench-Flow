import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import {
  createLab,
  deleteTimer,
  getLab,
  getTimer,
  listActiveTimers,
  getProcedureForLab,
  getRunState,
  listLabSummaries,
  listLabs,
  saveProcedure,
  saveRunState,
  setLabStatus,
} from './helpers';
import type { Procedure, Timer } from '../types';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`test-${crypto.randomUUID()}`);
  await database.open();
});

describe('lab helpers', () => {
  it('creates a draft lab with a default name when none is given', async () => {
    const lab = await createLab('   ', database);
    expect(lab.status).toBe('draft');
    expect(lab.name).toBe('Untitled lab');
    expect(await getLab(lab.id, database)).toEqual(lab);
  });

  it('updates status and lists labs newest first', async () => {
    const first = await createLab('First', database);
    await new Promise((r) => setTimeout(r, 5));
    const second = await createLab('Second', database);
    await setLabStatus(first.id, 'in_progress', database);

    const labs = await listLabs(database);
    expect(labs.map((l) => l.id)).toEqual([first.id, second.id]);
    expect((await getLab(first.id, database))?.status).toBe('in_progress');
  });
});

describe('procedure and run state helpers', () => {
  const procedure: Procedure = {
    id: 'proc-1',
    labId: 'lab-x',
    title: 'Western blot',
    steps: [
      { id: 's1', title: 'Lyse cells', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] },
      { id: 's2', title: 'Run gel', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] },
    ],
    createdAt: 0,
    updatedAt: 0,
  };

  it('stores a procedure per lab and returns it by labId', async () => {
    await saveProcedure(procedure, database);
    expect((await getProcedureForLab('lab-x', database))?.title).toBe('Western blot');
    expect(await getProcedureForLab('missing', database)).toBeUndefined();
  });

  it('saves run state keyed by lab', async () => {
    await saveRunState({ labId: 'lab-x', currentStepIndex: 1, completedStepIds: ['s1'] }, database);
    const state = await getRunState('lab-x', database);
    expect(state?.currentStepIndex).toBe(1);
    expect(state?.completedStepIds).toEqual(['s1']);
  });

  it('summarizes labs with the current step title', async () => {
    const lab = await createLab('Blot', database);
    await saveProcedure({ ...procedure, labId: lab.id }, database);
    await saveRunState({ labId: lab.id, currentStepIndex: 1, completedStepIds: ['s1'] }, database);

    const [summary] = await listLabSummaries(database);
    expect(summary.lab.id).toBe(lab.id);
    expect(summary.lastStepTitle).toBe('Run gel');
  });
});

describe('timer helpers', () => {
  const base = (id: string, status: Timer['status']): Timer => ({
    id,
    stepId: 's1',
    label: id,
    durationSec: 60,
    status,
  });

  it('stores, reads and deletes timer rows', async () => {
    await database.timers.put(base('t1', 'running'));
    expect((await getTimer('t1', database))?.status).toBe('running');
    await deleteTimer('t1', database);
    expect(await getTimer('t1', database)).toBeUndefined();
  });

  it('lists only running, paused and done timers', async () => {
    await database.timers.bulkPut([base('a', 'idle'), base('b', 'running'), base('c', 'paused'), base('d', 'done')]);
    const ids = (await listActiveTimers(database)).map((t) => t.id).sort();
    expect(ids).toEqual(['b', 'c', 'd']);
  });
});
