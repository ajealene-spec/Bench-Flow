import { db as defaultDb, type LabCompanionDB } from '../../db';
import { listExecutionEvents } from '../../db/executionLog';
import { getProcedureForExperiment, listStepRecords } from '../../db/helpers';
import { buildInsightsRun, type InsightsRun } from './insightsData';
import { loadReproducibilityInput } from './loadReproducibility';
import { scoreReproducibility } from './reproducibility';

/** Loads every run as chart rows. Reads only; nothing is written. */
export async function loadInsightsRuns(database: LabCompanionDB = defaultDb): Promise<InsightsRun[]> {
  const experiments = await database.experiments.toArray();
  const runs: InsightsRun[] = [];
  for (const experiment of experiments) {
    const [procedure, records, events, ephys, input] = await Promise.all([
      getProcedureForExperiment(experiment.id, database),
      listStepRecords(experiment.id, database),
      listExecutionEvents(experiment.id, database),
      database.ephysRecords.where('experimentId').equals(experiment.id).toArray(),
      loadReproducibilityInput(experiment.id, database),
    ]);
    const score = input ? scoreReproducibility(input).score : null;
    runs.push(buildInsightsRun({ experiment, procedure, records, events, ephys, score }));
  }
  return runs;
}
