import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../db';
import { demoReportPath } from './seed';

let database: LabCompanionDB;

beforeEach(async () => {
  database = new LabCompanionDB(`demo-path-${crypto.randomUUID()}`);
  await database.open();
});

describe('demoReportPath', () => {
  it('seeds the starter content when the demo is missing and returns its report route', async () => {
    const path = await demoReportPath(database);
    const demo = await database.experiments.toArray();
    expect(demo).toHaveLength(1);
    expect(path).toBe(`/experiment/${demo[0].id}/report`);
  });

  it('returns the same route without adding a second demo', async () => {
    const first = await demoReportPath(database);
    const second = await demoReportPath(database);
    expect(second).toBe(first);
    expect(await database.experiments.count()).toBe(1);
  });
});
