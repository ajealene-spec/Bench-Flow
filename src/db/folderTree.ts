import { db as defaultDb, type LabCompanionDB } from './index';
import type { Folder } from '../types';

/**
 * True when putting `folderId` under `newParentId` would create a cycle: the new parent is the folder
 * itself or one of its descendants. Walks up from the new parent with a visited set, so a cycle that
 * already exists in stored data cannot hang the walk.
 */
export function wouldCreateCycle(folders: Folder[], folderId: string, newParentId: string | null): boolean {
  if (newParentId === null) return false;
  if (newParentId === folderId) return true;
  const byId = new Map(folders.map((f) => [f.id, f]));
  const seen = new Set<string>();
  let cursor: string | undefined = newParentId;
  while (cursor !== undefined && !seen.has(cursor)) {
    if (cursor === folderId) return true;
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentId;
  }
  return false;
}

/** Ids of every folder below `folderId` (not including it). */
export function descendantIds(folders: Folder[], folderId: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>([folderId]);
  const queue = [folderId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const folder of folders) {
      if (folder.parentId === current && !seen.has(folder.id)) {
        seen.add(folder.id);
        result.push(folder.id);
        queue.push(folder.id);
      }
    }
  }
  return result;
}

/** Top-level folders, plus folders whose parent no longer exists (treated as top level). */
export function rootFolders(folders: Folder[]): Folder[] {
  const ids = new Set(folders.map((f) => f.id));
  return folders.filter((f) => !f.parentId || !ids.has(f.parentId));
}

/**
 * Moves a folder under another folder, or to the top level with null. Throws when the move would put a
 * folder inside itself or inside one of its own subfolders, or when the target does not exist.
 */
export async function moveFolder(
  folderId: string,
  newParentId: string | null,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.folders, async () => {
    const folders = await database.folders.toArray();
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) throw new Error(`Folder ${folderId} not found`);
    if (newParentId !== null && !folders.some((f) => f.id === newParentId)) {
      throw new Error(`Folder ${newParentId} not found`);
    }
    if (wouldCreateCycle(folders, folderId, newParentId)) {
      throw new Error('A folder cannot be moved into itself or one of its subfolders');
    }
    const { parentId: _old, ...rest } = folder;
    await database.folders.put(newParentId === null ? rest : { ...rest, parentId: newParentId });
  });
}
