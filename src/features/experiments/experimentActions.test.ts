import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../../db';
import type { Experiment, Folder } from '../../types';
import {
  addTagsToExperiments,
  createSubfolder,
  deleteExperiments,
  deleteFolderReparent,
  moveExperiments,
  moveFolderTo,
  setExperimentTags,
} from './experimentActions';

let db: LabCompanionDB;

function run(id: string, patch: Partial<Experiment> = {}): Experiment {
  return { id, name: id, status: 'draft', folderId: null, createdAt: 1, updatedAt: 1, ...patch };
}

beforeEach(async () => {
  db = new LabCompanionDB(`exp-actions-${crypto.randomUUID()}`);
  await db.open();
  const folders: Folder[] = [
    { id: 'top', name: 'Top', createdAt: 1 },
    { id: 'mid', name: 'Mid', createdAt: 2, parentId: 'top' },
    { id: 'leaf', name: 'Leaf', createdAt: 3, parentId: 'mid' },
    { id: 'other', name: 'Other', createdAt: 4 },
  ];
  await db.folders.bulkAdd(folders);
  await db.experiments.bulkAdd([
    run('e1', { folderId: 'mid', tags: ['a'] }),
    run('e2', { folderId: 'leaf' }),
    run('e3', { folderId: 'other', tags: ['b'] }),
  ]);
});

describe('moveExperiments', () => {
  it('moves several experiments and unfiles them with null', async () => {
    await moveExperiments(['e1', 'e2'], 'other', db);
    expect((await db.experiments.get('e1'))?.folderId).toBe('other');
    expect((await db.experiments.get('e2'))?.folderId).toBe('other');

    await moveExperiments(['e3'], null, db);
    expect((await db.experiments.get('e3'))?.folderId).toBeNull();
  });

  it('refuses a folder that does not exist and changes nothing', async () => {
    await expect(moveExperiments(['e1'], 'ghost', db)).rejects.toThrow();
    expect((await db.experiments.get('e1'))?.folderId).toBe('mid');
  });
});

describe('tags', () => {
  it('replaces tags with normalized, unique values', async () => {
    await setExperimentTags('e1', ['  Mouse ', 'mouse', '', 'Two   Photon'], db);
    expect((await db.experiments.get('e1'))?.tags).toEqual(['mouse', 'two photon']);
  });

  it('adds tags to many experiments without losing existing ones', async () => {
    await addTagsToExperiments(['e1', 'e3'], ['shared'], db);
    expect((await db.experiments.get('e1'))?.tags).toEqual(['a', 'shared']);
    expect((await db.experiments.get('e3'))?.tags).toEqual(['b', 'shared']);
    expect((await db.experiments.where('tags').equals('shared').toArray()).length).toBe(2);
  });
});

describe('deleteExperiments', () => {
  it('deletes the chosen experiments only', async () => {
    await deleteExperiments(['e1', 'e2'], db);
    expect(await db.experiments.toArray()).toHaveLength(1);
    expect((await db.experiments.get('e3'))?.id).toBe('e3');
  });
});

describe('createSubfolder', () => {
  it('creates a child folder and a top-level folder', async () => {
    const child = await createSubfolder('Sub', 'top', db);
    expect((await db.folders.get(child.id))?.parentId).toBe('top');
    const root = await createSubfolder('Root', null, db);
    expect((await db.folders.get(root.id))?.parentId).toBeUndefined();
  });
});

describe('deleteFolderReparent', () => {
  it('moves children to the deleted folder parent and experiments to Unfiled', async () => {
    await deleteFolderReparent('mid', db);
    expect(await db.folders.get('mid')).toBeUndefined();
    expect((await db.folders.get('leaf'))?.parentId).toBe('top');
    expect((await db.experiments.get('e1'))?.folderId).toBeNull();
    // Experiments in a child folder are not touched.
    expect((await db.experiments.get('e2'))?.folderId).toBe('leaf');
  });

  it('makes children top level when the deleted folder was top level', async () => {
    await deleteFolderReparent('top', db);
    const mid = await db.folders.get('mid');
    expect(mid).toBeDefined();
    expect(mid?.parentId).toBeUndefined();
  });
});

describe('moveFolderTo', () => {
  it('moves a folder and refuses to move it into its own subfolder', async () => {
    await moveFolderTo('other', 'leaf', db);
    expect((await db.folders.get('other'))?.parentId).toBe('leaf');
    await expect(moveFolderTo('top', 'leaf', db)).rejects.toThrow();
    expect((await db.folders.get('top'))?.parentId).toBeUndefined();
  });
});
