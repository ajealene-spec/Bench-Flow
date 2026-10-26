import { db as defaultDb, type LabCompanionDB } from '../../db';
import { getExperiment, getProcedureForExperiment, getRunState, listStepRecords } from '../../db/helpers';
import { getTemplate } from '../../db/templates';
import { buildReport, type Report } from '../report/buildReport';

/** Builds the same report model the report page shows, from the local database. Null when the experiment is missing. */
export async function loadRunReport(experimentId: string, database: LabCompanionDB = defaultDb): Promise<Report | null> {
  const experiment = await getExperiment(experimentId, database);
  if (!experiment) return null;
  const [procedure, runState, records, template] = await Promise.all([
    getProcedureForExperiment(experimentId, database),
    getRunState(experimentId, database),
    listStepRecords(experimentId, database),
    experiment.templateId ? getTemplate(experiment.templateId, database) : Promise.resolve(undefined),
  ]);
  return buildReport({
    experiment,
    procedure,
    template: template ?? null,
    runState,
    records,
    generatedAt: Date.now(),
  });
}
