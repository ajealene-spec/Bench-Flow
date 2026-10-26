import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';

const SCHEMA_V4 = {
  experiments: 'id, status, updatedAt, folderId, templateId',
  folders: 'id, createdAt',
  procedures: 'id, experimentId',
  experimentRunStates: 'experimentId, updatedAt',
  stepRecords: 'id, experimentId, stepId, [experimentId+stepId]',
  timers: 'id, stepId, status',
  templates: 'id, category, updatedAt',
  inventory: 'id, kind, name, expiresOn',
  inventoryUsage: '[experimentId+inventoryItemId+stepId], experimentId, inventoryItemId',
};

/** Builds a database exactly as the version 5 app left it, with one run that has a timer and a note. */
async function openV5(name: string) {
  const v5 = new Dexie(name);
  v5.version(4).stores(SCHEMA_V4);
  v5.version(5); // Version 5 changed no indexes.
  await v5.open();
  await v5.table('experiments').add({ id: 'exp-1', name: 'Blot 1', status: 'in_progress', folderId: null, createdAt: 1, updatedAt: 1 });
  await v5.table('timers').add({ id: 't-1', stepId: 's1', label: 'Incubate', durationSec: 60, status: 'paused', pausedRemainingSec: 20, experimentId: 'exp-1' });
  v5.close();
}

describe('version 5 to version 6 migration', () => {
  it('adds the execution log and run values tables without touching existing rows', async () => {
    const name = `migrate-v6-${crypto.randomUUID()}`;
    await openV5(name);

    const db = new LabCompanionDB(name);
    await db.open();

    expect(db.tables.map((t) => t.name)).toEqual(expect.arrayContaining(['executionEvents', 'runValues']));
    expect(await db.executionEvents.count()).toBe(0);
    expect(await db.runValues.count()).toBe(0);

    // Existing data survives unchanged.
    expect(await db.experiments.get('exp-1')).toMatchObject({ name: 'Blot 1', status: 'in_progress' });
    expect(await db.timers.get('t-1')).toMatchObject({ label: 'Incubate', pausedRemainingSec: 20 });

    // The new indexes work: events are found by run and ordered by time.
    await db.executionEvents.bulkAdd([
      { id: 'e2', experimentId: 'exp-1', at: 200, type: 'step_complete' },
      { id: 'e1', experimentId: 'exp-1', at: 100, type: 'step_start' },
    ]);
    const ordered = await db.executionEvents.where('[experimentId+at]').between(['exp-1', -Infinity], ['exp-1', Infinity]).toArray();
    expect(ordered.map((e) => e.id)).toEqual(['e1', 'e2']);

    // runValues is keyed by run, step and variable.
    await db.runValues.put({ experimentId: 'exp-1', stepId: 's1', varId: 'v1', value: 2, unit: 'mM', editedAt: 1 });
    expect(await db.runValues.get(['exp-1', 's1', 'v1'])).toMatchObject({ value: 2, unit: 'mM' });
    db.close();
  });
});
