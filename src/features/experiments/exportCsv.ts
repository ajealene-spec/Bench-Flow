import { groupRecordsByStep, SUMMARY_HEADERS, summaryRows, toCSV } from '../data/summary';
import type { Experiment, Procedure, StepRecord } from '../../types';

export const EXPORT_HEADERS = ['Experiment', 'Protocol', 'Status', ...SUMMARY_HEADERS];

export interface ExportInput {
  experiment: Experiment;
  protocolTitle: string;
  procedure: Procedure | undefined;
  records: StepRecord[];
}

/**
 * One CSV for many experiments, using the same columns as the single-run "Download CSV" on the run page.
 * An experiment with no records still gets one row so it is not lost from the export. No BOM is added;
 * the caller adds it for Excel.
 */
export function buildExperimentsCsv(inputs: ExportInput[]): string {
  const rows: string[][] = [];
  for (const input of inputs) {
    const prefix = [input.experiment.name, input.protocolTitle, input.experiment.status];
    const body = summaryRows(groupRecordsByStep(input.procedure, input.records));
    if (body.length === 0) {
      rows.push([...prefix, ...SUMMARY_HEADERS.map(() => '')]);
      continue;
    }
    for (const row of body) rows.push([...prefix, ...row]);
  }
  return toCSV(EXPORT_HEADERS, rows);
}
