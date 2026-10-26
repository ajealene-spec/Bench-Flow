import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Animal, Experiment } from '../types';
import { LabCompanionDB } from './index';
import { deleteAnimal, listExperimentsForAnimal, putAnimal } from './animals';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`animals-${crypto.randomUUID()}`);
  await database.open();
});

const animal = (id: string): Animal => ({
  id,
  label: `M-${id}`,
  species: 'Mouse',
  strain: 'C57BL/6J',
  genotype: 'WT',
  sex: 'female',
  dob: '2026-01-01',
  events: [],
  createdAt: 1,
  updatedAt: 1,
});

const experiment = (id: string, createdAt: number, animalIds?: string[]): Experiment => ({
  id,
  name: `Run ${id}`,
  status: 'done',
  folderId: null,
  animalIds,
  createdAt,
  updatedAt: createdAt,
});

describe('animal and experiment links', () => {
  it('lists the experiments that used an animal, newest first', async () => {
    await database.experiments.bulkAdd([
      experiment('old', 1, ['a1']),
      experiment('new', 5, ['a1', 'a2']),
      experiment('other', 3, ['a2']),
      experiment('none', 4),
    ]);
    const linked = await listExperimentsForAnimal('a1', database);
    expect(linked.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('deleting an animal unlinks it from experiments and keeps the other animals', async () => {
    await putAnimal(animal('a1'), database);
    await database.experiments.add(experiment('run', 1, ['a1', 'a2']));

    await deleteAnimal('a1', database);

    expect(await database.animals.get('a1')).toBeUndefined();
    expect((await database.experiments.get('run'))?.animalIds).toEqual(['a2']);
  });
});
