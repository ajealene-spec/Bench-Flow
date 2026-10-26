import { db as defaultDb, type LabCompanionDB } from '../../db';
import { DEMO_EXPERIMENT_NAME, seedStarterContent } from '../../content/seed';

/** Makes sure the demo experiment exists and returns its id. Null only if it cannot be created. */
export async function ensureDemoExperimentId(database: LabCompanionDB = defaultDb): Promise<string | null> {
  await seedStarterContent(database);
  const demo = await database.experiments.filter((e) => e.name === DEMO_EXPERIMENT_NAME).first();
  return demo?.id ?? null;
}
