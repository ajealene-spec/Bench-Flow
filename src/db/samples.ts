import { db as defaultDb, type LabCompanionDB } from './index';
import type { SampleSheet } from '../types';

/** Sample sheets for one experiment, or all of them when no experiment id is given. */
export function listSamples(experimentId?: string, database: LabCompanionDB = defaultDb): Promise<SampleSheet[]> {
  return experimentId === undefined
    ? database.samples.toArray()
    : database.samples.where('experimentId').equals(experimentId).toArray();
}

export function getSample(id: string, database: LabCompanionDB = defaultDb): Promise<SampleSheet | undefined> {
  return database.samples.get(id);
}

export async function putSample(sheet: SampleSheet, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.samples.put(sheet);
}

export async function deleteSample(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.samples.delete(id);
}
