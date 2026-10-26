import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import { getProcedureForExperiment } from './helpers';

/** Builds a database exactly as the version 4 app left it, with one template and one run. */
async function openV4(name: string) {
  const v4 = new Dexie(name);
  v4.version(4).stores({
    experiments: 'id, status, updatedAt, folderId, templateId',
    folders: 'id, createdAt',
    procedures: 'id, experimentId',
    experimentRunStates: 'experimentId, updatedAt',
    stepRecords: 'id, experimentId, stepId, [experimentId+stepId]',
    timers: 'id, stepId, status',
    templates: 'id, category, updatedAt',
    inventory: 'id, kind, name, expiresOn',
    inventoryUsage: '[experimentId+inventoryItemId+stepId], experimentId, inventoryItemId',
  });
  await v4.open();
  await v4.table('templates').add({
    id: 'tpl-1',
    title: 'Western blot',
    category: 'Blots',
    steps: [{ id: 's1', title: 'Lyse', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] }],
    hazards: [],
    createdAt: 1,
    updatedAt: 1,
  });
  await v4.table('experiments').add({
    id: 'exp-1',
    name: 'Blot 1',
    status: 'draft',
    folderId: null,
    templateId: 'tpl-1',
    procedureId: 'proc-1',
    createdAt: 1,
    updatedAt: 1,
  });
  await v4.table('procedures').add({
    id: 'proc-1',
    experimentId: 'exp-1',
    title: 'Western blot',
    steps: [{ id: 's1', title: 'Lyse', instructions: '', timers: [], reagents: [], dataFields: [], cautions: [] }],
    createdAt: 1,
    updatedAt: 1,
  });
  v4.close();
}

describe('version 4 to version 5 migration', () => {
  it('fills empty overview-free phase and material lists on existing templates and runs', async () => {
    const name = `migrate-v5-${crypto.randomUUID()}`;
    await openV4(name);

    const db = new LabCompanionDB(name);
    await db.open();

    const template = await db.templates.get('tpl-1');
    expect(template).toMatchObject({ title: 'Western blot', phases: [], materials: [] });
    expect(template?.overview).toBeUndefined();

    const procedure = await getProcedureForExperiment('exp-1', db);
    expect(procedure).toMatchObject({ title: 'Western blot', phases: [], materials: [] });
    expect(procedure?.steps[0].id).toBe('s1');

    // Existing experiments keep working without a materials checklist.
    expect((await db.experiments.get('exp-1'))?.materialsChecked).toBeUndefined();
    db.close();
  });
});
