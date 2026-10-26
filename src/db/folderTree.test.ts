import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from './index';
import { descendantIds, moveFolder, rootFolders, wouldCreateCycle } from './folderTree';
import type { Folder } from '../types';

const tree: Folder[] = [
  { id: 'a', name: 'A', createdAt: 1 },
  { id: 'b', name: 'B', createdAt: 2, parentId: 'a' },
  { id: 'c', name: 'C', createdAt: 3, parentId: 'b' },
  { id: 'd', name: 'D', createdAt: 4 },
];

describe('wouldCreateCycle', () => {
  it('rejects a folder inside itself', () => {
    expect(wouldCreateCycle(tree, 'a', 'a')).toBe(true);
  });

  it('rejects a folder inside one of its descendants', () => {
    expect(wouldCreateCycle(tree, 'a', 'c')).toBe(true);
    expect(wouldCreateCycle(tree, 'a', 'b')).toBe(true);
  });

  it('allows moves to siblings, unrelated folders, and the top level', () => {
    expect(wouldCreateCycle(tree, 'c', 'a')).toBe(false);
    expect(wouldCreateCycle(tree, 'd', 'c')).toBe(false);
    expect(wouldCreateCycle(tree, 'c', null)).toBe(false);
  });

  it('terminates when stored data already contains a cycle', () => {
    const looped: Folder[] = [
      { id: 'x', name: 'X', createdAt: 1, parentId: 'y' },
      { id: 'y', name: 'Y', createdAt: 2, parentId: 'x' },
      { id: 'z', name: 'Z', createdAt: 3 },
    ];
    expect(wouldCreateCycle(looped, 'z', 'x')).toBe(false);
  });
});

describe('descendantIds and rootFolders', () => {
  it('lists every subfolder below a folder', () => {
    expect(descendantIds(tree, 'a').sort()).toEqual(['b', 'c']);
    expect(descendantIds(tree, 'd')).toEqual([]);
  });

  it('treats folders with a missing parent as top level', () => {
    const orphan: Folder[] = [{ id: 'o', name: 'O', createdAt: 1, parentId: 'gone' }, ...tree];
    expect(rootFolders(orphan).map((f) => f.id).sort()).toEqual(['a', 'd', 'o']);
  });
});

describe('moveFolder', () => {
  let db: LabCompanionDB;

  beforeEach(async () => {
    db = new LabCompanionDB(`folders-${crypto.randomUUID()}`);
    await db.open();
    await db.folders.bulkAdd(tree.map((f) => ({ ...f })));
  });

  afterEach(() => {
    db.close();
  });

  it('moves a folder under another folder', async () => {
    await moveFolder('d', 'a', db);
    expect((await db.folders.get('d'))?.parentId).toBe('a');
  });

  it('moves a folder back to the top level and removes parentId', async () => {
    await moveFolder('b', null, db);
    const moved = await db.folders.get('b');
    expect(moved).toEqual({ id: 'b', name: 'B', createdAt: 2 });
    expect('parentId' in (moved as object)).toBe(false);
  });

  it('refuses a move into itself or a subfolder and leaves the tree unchanged', async () => {
    await expect(moveFolder('a', 'c', db)).rejects.toThrow('cannot be moved');
    await expect(moveFolder('a', 'a', db)).rejects.toThrow('cannot be moved');
    expect((await db.folders.get('a'))?.parentId).toBeUndefined();
    expect((await db.folders.get('b'))?.parentId).toBe('a');
  });

  it('refuses a missing folder or target', async () => {
    await expect(moveFolder('nope', null, db)).rejects.toThrow('not found');
    await expect(moveFolder('d', 'nope', db)).rejects.toThrow('not found');
  });
});
