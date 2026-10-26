import { db as defaultDb, type LabCompanionDB } from '../../db';
import { listExecutionEvents } from '../../db/executionLog';
import { getExperiment, getProcedureForExperiment, getRunState, listStepRecords } from '../../db/helpers';
import { getInventoryItem, listInventoryUsageForExperiment } from '../../db/inventory';
import { buildExecutionLog, type ReagentLot } from '../report/buildExecutionLog';
import { buildReport } from '../report/buildReport';
import type { ReportData } from '../report/reportData';
import type { RunValue } from '../../types';

/**
 * Loads the data the research package needs for one run. Mirrors what the report page loads, without photos or
 * comments, which the tour does not show.
 */
export async function loadDemoReportData(experimentId: string, database: LabCompanionDB = defaultDb): Promise<ReportData | null> {
  const experiment = await getExperiment(experimentId, database);
  if (!experiment) return null;
  const [procedure, runState, records, events, runValues, usages] = await Promise.all([
    getProcedureForExperiment(experimentId, database),
    getRunState(experimentId, database),
    listStepRecords(experimentId, database),
    listExecutionEvents(experimentId, database),
    database.runValues.filter((rv: RunValue) => rv.experimentId === experimentId).toArray(),
    listInventoryUsageForExperiment(experimentId, database),
  ]);
  const lots: ReagentLot[] = [];
  for (const usage of usages) {
    const item = await getInventoryItem(usage.inventoryItemId, database);
    if (!item) continue;
    lots.push({ stepId: usage.stepId, name: item.name, lotNumber: item.lotNumber, vendor: item.vendor, catalogNumber: item.catalogNumber });
  }
  const report = buildReport({ experiment, procedure, template: null, runState, records, generatedAt: Date.now() });
  const executionLog = buildExecutionLog(experiment, procedure?.steps ?? [], events, runValues, lots);
  return { report, procedure, records, events, executionLog, photos: [] };
}
