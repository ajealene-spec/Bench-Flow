import { db as defaultDb, type LabCompanionDB } from './index';
import type { StereotaxTarget } from '../types';

/** Stereotaxic targets sorted by name. */
export async function listStereotaxTargets(database: LabCompanionDB = defaultDb): Promise<StereotaxTarget[]> {
  const targets = await database.stereotaxTargets.toArray();
  return targets.sort((a, b) => a.name.localeCompare(b.name));
}

export function getStereotaxTarget(id: string, database: LabCompanionDB = defaultDb): Promise<StereotaxTarget | undefined> {
  return database.stereotaxTargets.get(id);
}

export async function putStereotaxTarget(target: StereotaxTarget, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.stereotaxTargets.put(target);
}

export async function deleteStereotaxTarget(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.stereotaxTargets.delete(id);
}
