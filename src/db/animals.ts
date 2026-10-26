import { db as defaultDb, type LabCompanionDB } from './index';
import type { Animal, Experiment } from '../types';

/** Animals sorted by label. Pass a cage id to list only the animals housed in that cage. */
export async function listAnimals(cageId?: string, database: LabCompanionDB = defaultDb): Promise<Animal[]> {
  const animals = cageId === undefined
    ? await database.animals.toArray()
    : await database.animals.where('cageId').equals(cageId).toArray();
  return animals.sort((a, b) => a.label.localeCompare(b.label));
}

export function getAnimal(id: string, database: LabCompanionDB = defaultDb): Promise<Animal | undefined> {
  return database.animals.get(id);
}

export async function putAnimal(animal: Animal, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.animals.put(animal);
}

/** Experiments that used this animal, newest first. */
export async function listExperimentsForAnimal(animalId: string, database: LabCompanionDB = defaultDb): Promise<Experiment[]> {
  const experiments = await database.experiments.filter((e) => e.animalIds?.includes(animalId) ?? false).toArray();
  return experiments.sort((a, b) => b.createdAt - a.createdAt);
}

/** Deletes an animal and unlinks it from any experiment that used it. */
export async function deleteAnimal(id: string, database: LabCompanionDB = defaultDb): Promise<void> {
  await database.transaction('rw', [database.animals, database.experiments], async () => {
    const linked = await listExperimentsForAnimal(id, database);
    for (const experiment of linked) {
      await database.experiments.update(experiment.id, { animalIds: (experiment.animalIds ?? []).filter((a) => a !== id) });
    }
    await database.animals.delete(id);
  });
}
