import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import { DEFAULT_SETTINGS, SETTINGS_ID, getSettings, putSettings } from './settings';

/** Every table exactly as the version 6 app left it. Version 7 only adds tables. */
const SCHEMA_V6 = {
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
};

const NEW_TABLES = [
  'settings',
  'explanations',
  'glossary',
  'animals',
  'cages',
  'ephysRecords',
  'imagingRecords',
  'photos',
  'samples',
  'protocolVersions',
  'comments',
  'stereotaxTargets',
];

/** Builds a database exactly as the version 6 app left it, with a run, a template and a timer. */
async function openV6(name: string) {
  const v6 = new Dexie(name);
  v6.version(6).stores(SCHEMA_V6);
  await v6.open();
  await v6.table('experiments').add({ id: 'exp-1', name: 'Blot 1', status: 'in_progress', folderId: null, createdAt: 1, updatedAt: 1 });
  await v6.table('templates').add({ id: 'tpl-1', title: 'Western blot', category: 'Western Blot', steps: [], hazards: [], createdAt: 1, updatedAt: 1 });
  await v6.table('timers').add({ id: 't-1', stepId: 's1', label: 'Incubate', durationSec: 60, status: 'paused', pausedRemainingSec: 20, experimentId: 'exp-1' });
  v6.close();
}

describe('version 6 to version 7 migration', () => {
  it('adds the notebook tables without changing existing rows', async () => {
    const name = `migrate-v7-${crypto.randomUUID()}`;
    await openV6(name);

    const db = new LabCompanionDB(name);
    await db.open();

    expect(db.tables.map((t) => t.name)).toEqual(expect.arrayContaining(NEW_TABLES));
    for (const table of NEW_TABLES) {
      expect(await db.table(table).count()).toBe(0);
    }

    // Existing data survives unchanged.
    expect(await db.experiments.get('exp-1')).toMatchObject({ name: 'Blot 1', status: 'in_progress' });
    expect(await db.templates.get('tpl-1')).toMatchObject({ title: 'Western blot', category: 'Western Blot' });
    expect(await db.timers.get('t-1')).toMatchObject({ label: 'Incubate', pausedRemainingSec: 20 });
    db.close();
  });

  it('returns default settings before anything is saved, then merges changes', async () => {
    const name = `migrate-v7-settings-${crypto.randomUUID()}`;
    await openV6(name);
    const db = new LabCompanionDB(name);
    await db.open();

    expect(await getSettings(db)).toEqual({ ...DEFAULT_SETTINGS, id: SETTINGS_ID });

    await putSettings({ field: 'neuroscience', mode: 'advanced', techniques: ['Patch clamp'] }, db);
    await putSettings({ theme: 'dark' }, db);
    expect(await getSettings(db)).toMatchObject({
      field: 'neuroscience',
      mode: 'advanced',
      techniques: ['Patch clamp'],
      theme: 'dark',
      dyslexiaFont: false,
    });
    expect(await db.settings.count()).toBe(1);
    db.close();
  });

  it('keeps the compound indexes usable for run-scoped and target-scoped lookups', async () => {
    const name = `migrate-v7-index-${crypto.randomUUID()}`;
    await openV6(name);
    const db = new LabCompanionDB(name);
    await db.open();

    await db.protocolVersions.bulkAdd([
      { id: 'v2', templateId: 'tpl-1', version: 2, snapshot: { id: 'tpl-1', title: 'B', category: 'W', steps: [], hazards: [], createdAt: 2, updatedAt: 2 }, createdAt: 2 },
      { id: 'v1', templateId: 'tpl-1', version: 1, snapshot: { id: 'tpl-1', title: 'A', category: 'W', steps: [], hazards: [], createdAt: 1, updatedAt: 1 }, createdAt: 1 },
    ]);
    const versions = await db.protocolVersions.where('[templateId+version]').between(['tpl-1', -Infinity], ['tpl-1', Infinity]).toArray();
    expect(versions.map((v) => v.id)).toEqual(['v1', 'v2']);

    await db.explanations.put({ templateStepId: 'step-9', why: 'Keeps the gel even', mistakes: [], links: [] });
    expect(await db.explanations.get('step-9')).toMatchObject({ why: 'Keeps the gel even' });
    db.close();
  });
});
