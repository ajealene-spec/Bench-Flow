import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import { getSettings } from './settings';
import { LEGACY_AUTHOR_KEY, splitRridFromNotes } from './migrationV8';

/** Every table exactly as the version 7 app left it. */
const SCHEMA_V7 = {
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

/** Builds a database exactly as the version 7 app left it. */
async function openV7(name: string) {
  const v7 = new Dexie(name);
  v7.version(7).stores(SCHEMA_V7);
  await v7.open();
  await v7.table('experiments').add({ id: 'exp-1', name: 'Blot 1', status: 'in_progress', folderId: null, createdAt: 1, updatedAt: 1 });
  await v7.table('inventory').bulkAdd([
    { id: 'ab-1', name: 'Anti-GFAP', kind: 'antibody', notes: 'RRID: RRID:AB_2298772\nBought in May', createdAt: 1, updatedAt: 1 },
    { id: 'ab-2', name: 'Anti-NeuN', kind: 'antibody', notes: 'RRID:AB_2313673', createdAt: 1, updatedAt: 1 },
    { id: 'buf-1', name: 'TBST', kind: 'buffer', notes: 'Keep at 4 C', createdAt: 1, updatedAt: 1 },
  ]);
  v7.close();
}

beforeEach(() => {
  window.localStorage.setItem(LEGACY_AUTHOR_KEY, 'Ana Lee');
});

afterEach(() => {
  window.localStorage.removeItem(LEGACY_AUTHOR_KEY);
});

describe('version 7 to version 8 migration', () => {
  it('moves RRID lines out of notes into the rrid field', async () => {
    const name = `migrate-v8-${crypto.randomUUID()}`;
    await openV7(name);

    const db = new LabCompanionDB(name);
    await db.open();

    expect(await db.inventory.get('ab-1')).toMatchObject({ rrid: 'RRID:AB_2298772', notes: 'Bought in May' });
    expect(await db.inventory.get('ab-2')).toMatchObject({ rrid: 'RRID:AB_2313673' });
    expect((await db.inventory.get('ab-2'))?.notes).toBeUndefined();
    // Items without an RRID line are unchanged.
    expect(await db.inventory.get('buf-1')).toMatchObject({ notes: 'Keep at 4 C' });
    expect((await db.inventory.get('buf-1'))?.rrid).toBeUndefined();
    db.close();
  });

  it('moves the comment author name from localStorage into settings and keeps existing data', async () => {
    const name = `migrate-v8-name-${crypto.randomUUID()}`;
    await openV7(name);

    const db = new LabCompanionDB(name);
    await db.open();

    expect((await getSettings(db)).userName).toBe('Ana Lee');
    expect(await db.experiments.get('exp-1')).toMatchObject({ name: 'Blot 1', status: 'in_progress' });
    db.close();
  });

  it('leaves settings alone when there is no stored name', async () => {
    const name = `migrate-v8-noname-${crypto.randomUUID()}`;
    window.localStorage.removeItem(LEGACY_AUTHOR_KEY);
    await openV7(name);

    const db = new LabCompanionDB(name);
    await db.open();
    expect((await getSettings(db)).userName).toBeUndefined();
    db.close();
  });
});

describe('splitRridFromNotes', () => {
  it('returns undefined when there is no RRID line', () => {
    expect(splitRridFromNotes(undefined)).toBeUndefined();
    expect(splitRridFromNotes('Keep cold')).toBeUndefined();
  });

  it('accepts both the saved form and a bare identifier, and keeps the other lines', () => {
    expect(splitRridFromNotes('Lot check\nRRID: RRID:SCR_002285\nSee bench')).toEqual({
      rrid: 'RRID:SCR_002285',
      notes: 'Lot check\nSee bench',
    });
    expect(splitRridFromNotes('RRID: IMSR_JAX:000664')).toEqual({ rrid: 'RRID:IMSR_JAX:000664', notes: undefined });
  });
});
