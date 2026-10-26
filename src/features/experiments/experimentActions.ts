import { db as defaultDb, type LabCompanionDB } from '../../db';
import { deleteExperiment, newId, setExperimentFolder } from '../../db/helpers';
import { moveFolder } from '../../db/folderTree';
import type { Folder } from '../../types';

/** Moves several experiments to one folder (or to Unfiled with null) in one transaction. */
export async function moveExperiments(
  ids: string[],
  folderId: string | null,
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  if (ids.length === 0) return;
  await database.transaction('rw', database.experiments, database.folders, async () => {
    if (folderId !== null) {
      const folder = await database.folders.get(folderId);
      if (!folder) throw new Error('That folder no longer exists.');
    }
    for (const id of ids) await setExperimentFolder(id, folderId, database);
  });
}

/** Replaces an experiment's tags. Tags are normalized and de-duplicated, and blanks are dropped. */
export async function setExperimentTags(id: string, tags: string[], database: LabCompanionDB = defaultDb): Promise<void> {
  const cleaned = [...new Set(tags.map((t) => t.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 40)).filter(Boolean))];
  await database.experiments.update(id, { tags: cleaned, updatedAt: Date.now() });
}

/** Adds the given tags to several experiments, keeping the tags they already have. */
export async function addTagsToExperiments(
  ids: string[],
  tags: string[],
  database: LabCompanionDB = defaultDb,
): Promise<void> {
  await database.transaction('rw', database.experiments, async () => {
    for (const id of ids) {
      const experiment = await database.experiments.get(id);
      if (!experiment) continue;
      await setExperimentTags(id, [...(experiment.tags ?? []), ...tags], database);
    }
  });
}

/** Deletes several experiments, each with its steps, timers and records. Templates are kept. */
export async function deleteExperiments(ids: string[], database: LabCompanionDB = defaultDb): Promise<void> {
  for (const id of ids) await deleteExperiment(id, database);
}

/** Creates a folder under a parent folder, or at the top level with null. */
export async function createSubfolder(
  name: string,
  parentId: string | null,
  database: LabCompanionDB = defaultDb,
): Promise<Folder> {
  const folder: Folder = {
    id: newId(),
    name: name.trim() || 'New folder',
    createdAt: Date.now(),
    ...(parentId ? { parentId } : {}),
  };
  await database.folders.add(folder);
  return folder;
}

/**
 * Deletes a folder. Its subfolders move up to the deleted folder's parent (or the top level), and its
 * experiments move to Unfiled. Nothing else is deleted.
 */
export async function deleteFolderReparent(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.transaction('rw', database.folders, database.experiments, async () => {
    const folder = await database.folders.get(id);
    if (!folder) return;
    const parent = folder.parentId;
    const children = await database.folders.where('parentId').equals(id).toArray();
    for (const child of children) {
      const { parentId: _old, ...rest } = child;
      await database.folders.put(parent ? { ...rest, parentId: parent } : rest);
    }
    await database.experiments.where('folderId').equals(id).modify({ folderId: null, updatedAt: Date.now() });
    await database.folders.delete(id);
  });
}

/** Moves a folder under another folder (or to the top level). Refuses cycles; see folderTree.ts. */
export function moveFolderTo(folderId: string, newParentId: string | null, database: LabCompanionDB = defaultDb): Promise<void> {
  return moveFolder(folderId, newParentId, database);
}
