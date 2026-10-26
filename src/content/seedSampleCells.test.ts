import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../db';
import { seedStarterContent, DEMO_EXPERIMENT_NAME } from './seed';
import { GENOTYPES, SAMPLE_CELLS, SAMPLE_CONDITIONS, sampleCellLabel } from '../features/tour/sampleData';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`seed-cells-${crypto.randomUUID()}`);
  await database.open();
});

async function demoRecords() {
  const demo = await database.experiments.filter((e) => e.name === DEMO_EXPERIMENT_NAME).first();
  return database.stepRecords.where('experimentId').equals(demo!.id).toArray();
}

describe('demo sample cells', () => {
  it('stores peak and AUC for every ROI of every genotype and condition', async () => {
    await seedStarterContent(database);
    const cells = (await demoRecords()).filter((r) => r.label.startsWith('Sample data:'));
    expect(cells).toHaveLength(2 * GENOTYPES.length * SAMPLE_CONDITIONS.length * 30);
    for (const genotype of GENOTYPES) {
      for (const condition of SAMPLE_CONDITIONS) {
        SAMPLE_CELLS[genotype][condition.id].peak.forEach((value, i) => {
          const coverslip = Math.floor(i / 10) + 1;
          const roi = (i % 10) + 1;
          const row = cells.find((r) => r.label === sampleCellLabel('peak', genotype, condition.id, coverslip, roi));
          expect(row?.value).toBe(value);
          expect(row?.unit).toBe('ΔF/F0');
        });
      }
    }
  });

  it('adds the cells once, even when the seed runs again', async () => {
    await seedStarterContent(database);
    const before = (await demoRecords()).length;
    await seedStarterContent(database);
    expect((await demoRecords()).length).toBe(before);
  });

  it('adds the missing cells to a demo that lost some of them', async () => {
    await seedStarterContent(database);
    const cells = (await demoRecords()).filter((r) => r.label.startsWith('Sample data:'));
    await database.stepRecords.bulkDelete(cells.slice(0, 5).map((r) => r.id));
    await seedStarterContent(database);
    expect((await demoRecords()).filter((r) => r.label.startsWith('Sample data:'))).toHaveLength(cells.length);
  });
});
