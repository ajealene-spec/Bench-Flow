import { db as defaultDb, type LabCompanionDB } from './index';
import type { Cage } from '../types';

/** Cages sorted by room, then label. */
export async function listCages(database: LabCompanionDB = defaultDb): Promise<Cage[]> {
  const cages = await database.cages.toArray();
  return cages.sort((a, b) => a.room.localeCompare(b.room) || a.label.localeCompare(b.label));
}

export function getCage(id: string, database: LabCompanionDB = defaultDb): Promise<Cage | undefined> {
  return database.cages.get(id);
}

export async function putCage(cage: Cage, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.cages.put(cage);
}

export async function deleteCage(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.cages.delete(id);
}
