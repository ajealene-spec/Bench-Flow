import type { EphysRecord } from '../../types';
import { toCsv } from './csv';

/** Access resistance above this (MOhm) is flagged. */
export const RA_LIMIT_MOHM = 25;
/** A change in Ra of more than this fraction from the previous record of the same cell is flagged. */
export const RA_CHANGE_LIMIT = 0.2;

export interface EphysFlag {
  kind: 'ra_high' | 'ra_change';
  message: string;
}

/**
 * Quality flags for each record. Ra is compared with the previous record from the same cell, in time order.
 * Returns a map from record id to its flags. Records with no flags are left out of the map.
 */
export function flagEphysRecords(records: EphysRecord[]): Map<string, EphysFlag[]> {
  const flags = new Map<string, EphysFlag[]>();
  const sorted = [...records].sort((a, b) => a.cellId.localeCompare(b.cellId) || a.at - b.at);
  let previous: EphysRecord | undefined;

  for (const record of sorted) {
    const own: EphysFlag[] = [];
    if (record.Ra > RA_LIMIT_MOHM) {
      own.push({ kind: 'ra_high', message: `Ra ${record.Ra} MΩ is above ${RA_LIMIT_MOHM} MΩ` });
    }
    if (previous && previous.cellId === record.cellId && previous.Ra > 0) {
      const change = (record.Ra - previous.Ra) / previous.Ra;
      if (Math.abs(change) > RA_CHANGE_LIMIT) {
        const percent = Math.round(change * 100);
        own.push({ kind: 'ra_change', message: `Ra changed ${percent > 0 ? '+' : ''}${percent}% from ${previous.Ra} MΩ` });
      }
    }
    if (own.length > 0) flags.set(record.id, own);
    previous = record;
  }
  return flags;
}

/** CSV of the records in time order, with the quality flags as the last column. */
export function ephysCsv(records: EphysRecord[]): string {
  const flags = flagEphysRecords(records);
  const ordered = [...records].sort((a, b) => a.at - b.at);
  const rows = ordered.map((r) => [
    r.cellId,
    new Date(r.at).toISOString(),
    r.stepId ?? '',
    r.Rm,
    r.Ra,
    r.Cm,
    r.holding,
    r.notes ?? '',
    (flags.get(r.id) ?? []).map((f) => f.message).join('; '),
  ]);
  return toCsv([['cell_id', 'recorded_at', 'step_id', 'Rm_MOhm', 'Ra_MOhm', 'Cm_pF', 'holding_mV', 'notes', 'flags'], ...rows]);
}
