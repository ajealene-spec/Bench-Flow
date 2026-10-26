import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../db';
import { seedStarterContent, DEMO_EXPERIMENT_NAME } from './seed';
import { STARTER_TEMPLATES } from './protocols';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`seed-${crypto.randomUUID()}`);
  await database.open();
});

describe('seedStarterContent', () => {
  it('adds every starter and one finished demo experiment on the first run', async () => {
    const result = await seedStarterContent(database);
    expect(result).toEqual({ templatesAdded: 15, demoAdded: true });
    expect(await database.templates.count()).toBe(15);
    expect(await database.experiments.count()).toBe(1);
  });

  it('is idempotent: a second run adds nothing and keeps the same rows', async () => {
    await seedStarterContent(database);
    const templateIds = (await database.templates.toArray()).map((t) => t.id).sort();
    const eventCount = await database.executionEvents.count();
    const recordCount = await database.stepRecords.count();

    const again = await seedStarterContent(database);
    expect(again).toEqual({ templatesAdded: 0, demoAdded: false });
    expect((await database.templates.toArray()).map((t) => t.id).sort()).toEqual(templateIds);
    expect(await database.experiments.count()).toBe(1);
    expect(await database.executionEvents.count()).toBe(eventCount);
    expect(await database.stepRecords.count()).toBe(recordCount);
  });

  it('skips a starter that already exists by title, even if the user edited it', async () => {
    const [first] = STARTER_TEMPLATES;
    await database.templates.add({ ...structuredClone(first), id: 'user-copy', steps: [] });
    const result = await seedStarterContent(database);
    expect(result.templatesAdded).toBe(14);
    const matches = await database.templates.filter((t) => t.title === first.title).toArray();
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('user-copy');
  });

  it('builds the demo as a done run with deviations, data, reagent lots and notes', async () => {
    await seedStarterContent(database);
    const experiment = await database.experiments.filter((e) => e.name === DEMO_EXPERIMENT_NAME).first();
    expect(experiment).toBeDefined();
    expect(experiment!.status).toBe('done');
    expect(experiment!.startedAt).toBeLessThan(experiment!.endedAt!);
    expect(experiment!.notes).toMatch(/block/i);

    const events = await database.executionEvents.where('experimentId').equals(experiment!.id).toArray();
    const timerOver = events.find((e) => e.type === 'timer_stop');
    expect(timerOver?.deviation).toEqual({ kind: 'timer', delta: 420, tolerance: 60 });
    const valueEdit = events.find((e) => e.type === 'value_change');
    expect(valueEdit?.planned).toBe(4);
    expect(valueEdit?.actual).toBe(5);
    expect(events.filter((e) => e.deviation).length).toBe(2);

    const records = await database.stepRecords.where('experimentId').equals(experiment!.id).toArray();
    expect(records.length).toBeGreaterThanOrEqual(3);

    const usage = await database.inventoryUsage.where('experimentId').equals(experiment!.id).toArray();
    expect(usage.length).toBeGreaterThanOrEqual(4);
    const lots = await database.inventory.toArray();
    expect(lots.some((item) => item.lotNumber)).toBe(true);

    const values = await database.runValues.filter((v) => v.experimentId === experiment!.id).toArray();
    expect(values.map((v) => v.value)).toContain(5);
  });

  it('runs concurrent calls one at a time, so a double tap adds nothing twice', async () => {
    const [a, b] = await Promise.all([seedStarterContent(database), seedStarterContent(database)]);
    expect(a.templatesAdded + b.templatesAdded).toBe(15);
    expect(a.demoAdded !== b.demoAdded).toBe(true);
    expect(await database.templates.count()).toBe(15);
    expect(await database.experiments.count()).toBe(1);
  });
});

describe('seedStarterContent with a title list', () => {
  it('adds only the listed starters, in the listed order', async () => {
    const titles = [STARTER_TEMPLATES[4].title, STARTER_TEMPLATES[0].title];
    const result = await seedStarterContent(database, { titles });
    expect(result.templatesAdded).toBe(2);
    const rows = await database.templates.orderBy('id').toArray();
    expect(rows.map((t) => t.title).sort()).toEqual([...titles].sort());
  });

  it('ignores unknown titles', async () => {
    const result = await seedStarterContent(database, { titles: ['Not a starter', STARTER_TEMPLATES[1].title] });
    expect(result.templatesAdded).toBe(1);
    expect(await database.templates.count()).toBe(1);
  });
});
