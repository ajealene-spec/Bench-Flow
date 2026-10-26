import { db as defaultDb, type LabCompanionDB } from './index';
import type { Photo } from '../types';

/** Photos in time order. Pass an experiment id to list one run's photos. */
export async function listPhotos(experimentId?: string, database: LabCompanionDB = defaultDb): Promise<Photo[]> {
  if (experimentId === undefined) return database.photos.orderBy('at').toArray();
  return database.photos.where('[experimentId+at]').between([experimentId, -Infinity], [experimentId, Infinity]).toArray();
}

export function getPhoto(id: string, database: LabCompanionDB = defaultDb): Promise<Photo | undefined> {
  return database.photos.get(id);
}

export async function putPhoto(photo: Photo, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.photos.put(photo);
}

export async function deletePhoto(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.photos.delete(id);
}
