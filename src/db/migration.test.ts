import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import { getProcedureForExperiment, getRunState, listExperiments } from './helpers';

/** Builds a database exactly as the version 1 app left it, with real lab data. */
async function openV1(name: string) {
  const v1 = new Dexie(name);
  v1.version(1).stores({
    labs: 'id, status, updatedAt',
    procedures: 'id, labId',
    runStates: 'labId, updatedAt',
    timers: 'id, stepId, status',
  });
  await v1.open();
  await v1.table('labs').bulkAdd([
    { id: 'lab-a', name: 'Untitled lab', status: 'draft', createdAt: 1, updatedAt: 1 },
    { id: 'lab-b', name: 'Blot', status: 'done', procedureId: 'proc-b', createdAt: 2, updatedAt: 5, lastOpenedAt: 4 },
  ]);
  await v1.table('procedures').add({
    id: 'proc-b',
    labId: 'lab-b',
    title: 'Western blot',
    steps: [{ id: 's1', title: 'Lyse', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] }],
    createdAt: 2,
    updatedAt: 2,
  });
  await v1.table('runStates').add({ labId: 'lab-b', currentStepIndex: 0, completedStepIds: ['s1'], updatedAt: 6 });
  v1.close();
}

describe('version 1 to version 2 migration', () => {
  it('copies labs to experiments and keeps procedures and run state linked', async () => {
    const name = `migrate-${crypto.randomUUID()}`;
    await openV1(name);

    const db = new LabCompanionDB(name);
    await db.open();

    const experiments = await listExperiments(db);
    expect(experiments.map((e) => e.id).sort()).toEqual(['lab-a', 'lab-b']);
    const blot = experiments.find((e) => e.id === 'lab-b');
    expect(blot).toMatchObject({ name: 'Blot', status: 'done', procedureId: 'proc-b', folderId: null, updatedAt: 5 });
    expect(blot?.endedAt).toBeUndefined();

    expect((await getProcedureForExperiment('lab-b', db))?.title).toBe('Western blot');
    expect(await getRunState('lab-b', db)).toMatchObject({ experimentId: 'lab-b', completedStepIds: ['s1'] });

    expect(db.tables.map((t) => t.name)).not.toContain('labs');
    expect(db.tables.map((t) => t.name)).not.toContain('runStates');
    db.close();
  });

  it('opens an empty version 1 database without error', async () => {
    const name = `migrate-empty-${crypto.randomUUID()}`;
    const v1 = new Dexie(name);
    v1.version(1).stores({ labs: 'id, status, updatedAt', procedures: 'id, labId', runStates: 'labId, updatedAt', timers: 'id, stepId, status' });
    await v1.open();
    v1.close();

    const db = new LabCompanionDB(name);
    await db.open();
    expect(await listExperiments(db)).toEqual([]);
    db.close();
  });
});
