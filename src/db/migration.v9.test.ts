import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import { createTask, listTasksForDate } from './tasks';
import { moveFolder } from './folderTree';

/** Every table exactly as the version 8 app left it (version 8 changed no indexes). */
const SCHEMA_V8 = {
  experiments: 'id, status, updatedAt, folderId, templateId',
  folders: 'id, createdAt',
  procedures: 'id, experimentId',
  experimentRunStates: 'experimentId, updatedAt',
  stepRecords: 'id, experimentId, stepId, [experimentId+stepId]',
  timers: 'id, stepId, status',
  templates: 'id, category, updatedAt',
  inventory: 'id, kind, name, expiresOn',
  inventoryUsage: '[experimentId+inventoryItemId+stepId], experimentId, inventoryItemId',
  executionEvents: 'id, experimentId, [experimentId+at]',
  runValues: '[experimentId+stepId+varId]',
  settings: 'id',
  explanations: 'templateStepId',
  glossary: 'id, term',
  animals: 'id, cageId, label, species',
  cages: 'id, room',
  ephysRecords: 'id, experimentId, at, [experimentId+at], [experimentId+stepId]',
  imagingRecords: 'id, experimentId, at, [experimentId+at], [experimentId+stepId]',
  photos: 'id, experimentId, at, [experimentId+at], [experimentId+stepId]',
  samples: 'id, experimentId',
  protocolVersions: 'id, templateId, [templateId+version]',
  comments: 'id, [targetType+targetId], createdAt',
  stereotaxTargets: 'id, name, atlas',
};

async function openV8(name: string) {
  const v8 = new Dexie(name);
  v8.version(8).stores(SCHEMA_V8);
  await v8.open();
  await v8.table('folders').bulkAdd([
    { id: 'f-1', name: 'Blots', createdAt: 1 },
    { id: 'f-2', name: 'PCR', createdAt: 2 },
  ]);
  await v8.table('experiments').add({
    id: 'exp-1',
    name: 'Blot 1',
    status: 'done',
    folderId: 'f-1',
    templateId: null,
    startedAt: 10,
    createdAt: 1,
    updatedAt: 5,
  });
  v8.close();
}

describe('version 8 to version 9 migration', () => {
  it('keeps existing folders and experiments unchanged and adds the new optional fields as absent', async () => {
    const name = `migrate-v9-${crypto.randomUUID()}`;
    await openV8(name);

    const db = new LabCompanionDB(name);
    await db.open();

    expect(await db.folders.get('f-1')).toEqual({ id: 'f-1', name: 'Blots', createdAt: 1 });
    expect((await db.folders.get('f-1'))?.parentId).toBeUndefined();
    expect(await db.experiments.get('exp-1')).toEqual({
      id: 'exp-1',
      name: 'Blot 1',
      status: 'done',
      folderId: 'f-1',
      templateId: null,
      startedAt: 10,
      createdAt: 1,
      updatedAt: 5,
    });
    db.close();
  });

  it('indexes experiment tags and folder parents, and supports the tasks table', async () => {
    const name = `migrate-v9-idx-${crypto.randomUUID()}`;
    await openV8(name);

    const db = new LabCompanionDB(name);
    await db.open();

    await db.experiments.update('exp-1', { tags: ['western', 'cohort-2'] });
    const tagged = await db.experiments.where('tags').equals('western').toArray();
    expect(tagged.map((e) => e.id)).toEqual(['exp-1']);

    await moveFolder('f-2', 'f-1', db);
    const children = await db.folders.where('parentId').equals('f-1').toArray();
    expect(children.map((f) => f.id)).toEqual(['f-2']);

    const task = await createTask({ title: 'Order antibody', date: '2026-11-02', done: false }, db);
    expect(await listTasksForDate('2026-11-02', db)).toEqual([task]);
    db.close();
  });
});
