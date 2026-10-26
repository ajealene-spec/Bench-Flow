import { db as defaultDb, type LabCompanionDB } from './index';
import type { ImagingRecord } from '../types';

/** Imaging records in time order. Pass an experiment id to list one run's records. */
export async function listImagingRecords(experimentId?: string, database: LabCompanionDB = defaultDb): Promise<ImagingRecord[]> {
  if (experimentId === undefined) return database.imagingRecords.orderBy('at').toArray();
  return database.imagingRecords.where('[experimentId+at]').between([experimentId, -Infinity], [experimentId, Infinity]).toArray();
}

export function getImagingRecord(id: string, database: LabCompanionDB = defaultDb): Promise<ImagingRecord | undefined> {
  return database.imagingRecords.get(id);
}

export async function putImagingRecord(record: ImagingRecord, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.imagingRecords.put(record);
}

export async function deleteImagingRecord(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.imagingRecords.delete(id);
}
