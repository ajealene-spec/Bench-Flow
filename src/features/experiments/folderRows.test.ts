import { describe, expect, it } from 'vitest';
import type { Folder } from '../../types';
import { buildFolderRows, folderPredicate, moveTargets } from './folderRows';

const folders: Folder[] = [
  { id: 'root-b', name: 'Beta', createdAt: 1 },
  { id: 'root-a', name: 'alpha', createdAt: 2 },
  { id: 'a-child', name: 'Child', createdAt: 3, parentId: 'root-a' },
  { id: 'a-grand', name: 'Grand', createdAt: 4, parentId: 'a-child' },
  { id: 'orphan', name: 'Orphan', createdAt: 5, parentId: 'missing' },
];

describe('buildFolderRows', () => {
  it('lists folders depth first, siblings by name, orphans after the top-level folders', () => {
    const rows = buildFolderRows(folders).map((r) => [r.folder.id, r.depth]);
    expect(rows).toEqual([
      ['root-a', 0],
      ['a-child', 1],
      ['a-grand', 2],
      ['root-b', 0],
      ['orphan', 0],
    ]);
  });

  it('lists every folder once even when stored data has a cycle', () => {
    const cyclic: Folder[] = [
      { id: 'x', name: 'X', createdAt: 1, parentId: 'y' },
      { id: 'y', name: 'Y', createdAt: 2, parentId: 'x' },
    ];
    const ids = buildFolderRows(cyclic).map((r) => r.folder.id);
    expect(ids.sort()).toEqual(['x', 'y']);
  });
});

describe('folderPredicate', () => {
  it('shows everything for all and only unfiled for unfiled', () => {
    expect(folderPredicate('all', folders)(null)).toBe(true);
    expect(folderPredicate('all', folders)('root-a')).toBe(true);
    expect(folderPredicate('unfiled', folders)(null)).toBe(true);
    expect(folderPredicate('unfiled', folders)('root-a')).toBe(false);
  });

  it('includes subfolders of the selected folder but not siblings or unfiled', () => {
    const inFolder = folderPredicate('root-a', folders);
    expect(inFolder('root-a')).toBe(true);
    expect(inFolder('a-grand')).toBe(true);
    expect(inFolder('root-b')).toBe(false);
    expect(inFolder(null)).toBe(false);
  });
});

describe('moveTargets', () => {
  it('excludes the folder itself and its subfolders', () => {
    const ids = moveTargets(folders, 'root-a').map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['root-b', 'orphan']));
    expect(ids).not.toContain('root-a');
    expect(ids).not.toContain('a-child');
    expect(ids).not.toContain('a-grand');
  });
});
