import { db as defaultDb, type LabCompanionDB } from './index';
import type { EphysRecord } from '../types';

/** Ephys records in time order. Pass an experiment id to list one run's records. */
export async function listEphysRecords(experimentId?: string, database: LabCompanionDB = defaultDb): Promise<EphysRecord[]> {
  if (experimentId === undefined) return database.ephysRecords.orderBy('at').toArray();
  return database.ephysRecords.where('[experimentId+at]').between([experimentId, -Infinity], [experimentId, Infinity]).toArray();
}

export function getEphysRecord(id: string, database: LabCompanionDB = defaultDb): Promise<EphysRecord | undefined> {
  return database.ephysRecords.get(id);
}

export async function putEphysRecord(record: EphysRecord, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.ephysRecords.put(record);
}

export async function deleteEphysRecord(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.ephysRecords.delete(id);
}
