import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../db';
import { seedStarterContent, DEMO_EXPERIMENT_NAME } from './seed';
import { SAMPLE_ANIMALS, SAMPLE_COUNTS, SAMPLE_REGIONS, sampleCountLabel } from '../features/tour/sampleData';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`seed-counts-${crypto.randomUUID()}`);
  await database.open();
});

async function demoRecords() {
  const demo = await database.experiments.filter((e) => e.name === DEMO_EXPERIMENT_NAME).first();
  return database.stepRecords.where('experimentId').equals(demo!.id).toArray();
}

describe('demo sample counts', () => {
  it('adds one labelled count per region and animal, with the sample values', async () => {
    await seedStarterContent(database);
    const counts = (await demoRecords()).filter((r) => r.label.startsWith('Sample data: NeuN+'));
    expect(counts).toHaveLength(SAMPLE_REGIONS.length * SAMPLE_ANIMALS.length);
    for (const region of SAMPLE_REGIONS) {
      SAMPLE_ANIMALS.forEach((animal, i) => {
        const row = counts.find((r) => r.label === sampleCountLabel(region, animal));
        expect(row?.value).toBe(SAMPLE_COUNTS[region][i]);
        expect(row?.unit).toBe('cells/100 µm²');
        expect(row?.kind).toBe('number');
      });
    }
  });

  it('adds the counts once, even when the seed runs again', async () => {
    await seedStarterContent(database);
    const before = (await demoRecords()).length;
    await seedStarterContent(database);
    expect((await demoRecords()).length).toBe(before);
  });

  it('adds the missing counts to a demo that was seeded before they existed', async () => {
    await seedStarterContent(database);
    const demo = await database.experiments.filter((e) => e.name === DEMO_EXPERIMENT_NAME).first();
    const counts = (await demoRecords()).filter((r) => r.label.startsWith('Sample data: NeuN+'));
    await database.stepRecords.bulkDelete(counts.map((r) => r.id));
    expect((await database.stepRecords.where('experimentId').equals(demo!.id).toArray()).length).toBe(
      (await demoRecords()).length,
    );
    await seedStarterContent(database);
    const restored = (await demoRecords()).filter((r) => r.label.startsWith('Sample data: NeuN+'));
    expect(restored).toHaveLength(9);
  });
});
