import { descendantIds, rootFolders, wouldCreateCycle } from '../../db/folderTree';
import type { Folder } from '../../types';

/** Which folder the list shows: every experiment, only unfiled ones, or one folder and its subfolders. */
export type FolderSelection = 'all' | 'unfiled' | string;

export interface FolderRow {
  folder: Folder;
  depth: number;
}

/** Folders in tree order: each folder followed by its subfolders, siblings by name. */
export function buildFolderRows(folders: Folder[]): FolderRow[] {
  const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const rows: FolderRow[] = [];
  const visited = new Set<string>();

  const walk = (siblings: Folder[], depth: number) => {
    for (const folder of [...siblings].sort(byName)) {
      if (visited.has(folder.id)) continue;
      visited.add(folder.id);
      rows.push({ folder, depth });
      walk(folders.filter((f) => f.parentId === folder.id), depth + 1);
    }
  };
  walk(rootFolders(folders), 0);
  // Folders caught in a stored cycle are never reached from the roots; list them at the top level so nothing disappears.
  for (const folder of folders) {
    if (!visited.has(folder.id)) {
      visited.add(folder.id);
      rows.push({ folder, depth: 0 });
    }
  }
  return rows;
}

/** Folder ids that a selection includes. A folder includes its subfolders. */
export function folderPredicate(selection: FolderSelection, folders: Folder[]): (folderId: string | null) => boolean {
  if (selection === 'all') return () => true;
  if (selection === 'unfiled') return (folderId) => folderId === null;
  const ids = new Set([selection, ...descendantIds(folders, selection)]);
  return (folderId) => folderId !== null && ids.has(folderId);
}

/** Folders a folder can be moved under: everything except itself and its own subfolders. Top level is offered separately. */
export function moveTargets(folders: Folder[], folderId: string): Folder[] {
  return folders.filter((f) => !wouldCreateCycle(folders, folderId, f.id));
}
