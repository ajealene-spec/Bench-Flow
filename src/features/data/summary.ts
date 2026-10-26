import type { Procedure, StepRecord } from '../../types';
import { formatElapsed, formatTimestamp } from './time';

export interface StepGroup {
  stepId: string;
  stepTitle: string;
  /** 1-based position in the procedure; undefined for records whose step no longer exists. */
  stepNumber?: number;
  records: StepRecord[];
}

export const SUMMARY_HEADERS = [
  'Step number',
  'Step',
  'Type',
  'Label',
  'Value',
  'Unit',
  'Elapsed',
  'Elapsed (s)',
  'Recorded at',
  'Started',
  'Stopped',
  'Note',
];

/**
 * Groups records by step in procedure order. Steps with no records are left out.
 * Records for a step no longer in the procedure go last, so no data is hidden.
 */
export function groupRecordsByStep(procedure: Procedure | undefined, records: StepRecord[]): StepGroup[] {
  const groups: StepGroup[] = [];
  const byStep = new Map<string, StepRecord[]>();
  for (const record of records) {
    const list = byStep.get(record.stepId) ?? [];
    list.push(record);
    byStep.set(record.stepId, list);
  }

  procedure?.steps.forEach((step, index) => {
    const list = byStep.get(step.id);
    if (!list) return;
    groups.push({
      stepId: step.id,
      stepTitle: step.title,
      stepNumber: index + 1,
      records: [...list].sort((a, b) => a.createdAt - b.createdAt),
    });
    byStep.delete(step.id);
  });

  for (const [stepId, list] of byStep) {
    groups.push({
      stepId,
      stepTitle: 'Removed step',
      records: [...list].sort((a, b) => a.createdAt - b.createdAt),
    });
  }
  return groups;
}

/** One row of cells per record, in summary order. Values are strings, ready for TSV or CSV. */
export function summaryRows(groups: StepGroup[]): string[][] {
  const rows: string[][] = [];
  for (const group of groups) {
    for (const r of group.records) {
      const isTimer = r.kind === 'timer';
      rows.push([
        group.stepNumber !== undefined ? String(group.stepNumber) : '',
        group.stepTitle,
        isTimer ? 'Time' : 'Number',
        r.label,
        isTimer ? '' : r.value !== undefined ? String(r.value) : '',
        isTimer ? '' : (r.unit ?? ''),
        isTimer ? formatElapsed(r.elapsedSec) : '',
        isTimer && r.elapsedSec !== undefined ? String(r.elapsedSec) : '',
        formatTimestamp(r.createdAt),
        formatTimestamp(r.startedAt),
        formatTimestamp(r.stoppedAt),
        r.note ?? '',
      ]);
    }
  }
  return rows;
}

/** Tab-separated text with a header row. Tabs and line breaks inside cells become spaces, so Excel keeps one cell per field. */
export function toTSV(headers: string[], rows: string[][]): string {
  const clean = (cell: string) => cell.replace(/[\t\r\n]+/g, ' ');
  return [headers, ...rows].map((row) => row.map(clean).join('\t')).join('\n');
}

/** RFC 4180 CSV with a header row. Cells with commas, quotes or line breaks are quoted. */
export function toCSV(headers: string[], rows: string[][]): string {
  const escape = (cell: string) => (/[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
}
