import type { SampleFormat, SampleWell } from '../../types';
import { toCsv } from '../data/csv';

/** Well geometry and sample-sheet helpers for 96- and 24-well plates. Wells are named like "A1" (row letter, column number). */

export type PlateFormat = Extract<SampleFormat, '96' | '24'>;

export const PLATE_SHAPE: Record<PlateFormat, { rows: number; cols: number }> = {
  '96': { rows: 8, cols: 12 },
  '24': { rows: 4, cols: 6 },
};

const ROW_LETTERS = 'ABCDEFGH';

/** Well ids in reading order: A1..A12, B1..B12, and so on. */
export function wellIds(format: PlateFormat): string[] {
  const { rows, cols } = PLATE_SHAPE[format];
  const ids: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 1; c <= cols; c++) ids.push(`${ROW_LETTERS[r]}${c}`);
  }
  return ids;
}

/** Zero-based row and one-based column for a well id, or undefined when the id is not a well. */
export function wellPosition(id: string): { row: number; col: number } | undefined {
  const match = /^([A-H])(\d{1,2})$/.exec(id.trim().toUpperCase());
  if (!match) return undefined;
  return { row: ROW_LETTERS.indexOf(match[1]), col: Number(match[2]) };
}

export function isWellInFormat(id: string, format: PlateFormat): boolean {
  const pos = wellPosition(id);
  if (!pos) return false;
  const { rows, cols } = PLATE_SHAPE[format];
  return pos.row < rows && pos.col >= 1 && pos.col <= cols;
}

/** Every well in the rectangle with corners `from` and `to`, in either drag direction. */
export function wellsInRect(format: PlateFormat, from: string, to: string): string[] {
  const a = wellPosition(from);
  const b = wellPosition(to);
  if (!a || !b) return [];
  const r0 = Math.min(a.row, b.row);
  const r1 = Math.max(a.row, b.row);
  const c0 = Math.min(a.col, b.col);
  const c1 = Math.max(a.col, b.col);
  return wellIds(format).filter((id) => {
    const p = wellPosition(id);
    return p !== undefined && p.row >= r0 && p.row <= r1 && p.col >= c0 && p.col <= c1;
  });
}

/** Neutral greys with the Tulane Green accent first. Groups take colors in the order they first appear. */
export const GROUP_PALETTE = ['#006747', '#475569', '#94a3b8', '#e2e8f0', '#1e293b', '#64748b', '#cbd5e1', '#334155'];

/** Distinct non-empty group names, in order of first appearance across the wells in reading order. */
export function groupNames(format: PlateFormat, wells: Record<string, SampleWell>): string[] {
  const seen: string[] = [];
  for (const id of wellIds(format)) {
    const group = wells[id]?.group.trim();
    if (group && !seen.includes(group)) seen.push(group);
  }
  return seen;
}

/** Fill color for a group. Blank group or no wells gets the plain background. */
export function groupColor(groups: string[], group: string): string {
  const index = groups.indexOf(group.trim());
  if (index < 0) return 'transparent';
  return GROUP_PALETTE[index % GROUP_PALETTE.length];
}

/**
 * Sets label and group on the given wells. A blank label and blank group clears those wells.
 * Wells outside the plate format are ignored.
 */
export function assignWells(
  format: PlateFormat,
  wells: Record<string, SampleWell>,
  ids: string[],
  patch: { label: string; group: string },
): Record<string, SampleWell> {
  const next = { ...wells };
  const label = patch.label.trim();
  const group = patch.group.trim();
  for (const id of ids) {
    if (!isWellInFormat(id, format)) continue;
    if (label === '' && group === '') {
      delete next[id];
    } else {
      next[id] = { sampleId: label || id, label, group };
    }
  }
  return next;
}

/** Drops wells outside the format, for when the plate is switched from 96 to 24. */
export function fitWellsToFormat(format: PlateFormat, wells: Record<string, SampleWell>): Record<string, SampleWell> {
  return Object.fromEntries(Object.entries(wells).filter(([id]) => isWellInFormat(id, format)));
}

/** Splits pasted spreadsheet text into rows of cells. Tabs (from Excel or Sheets) win over commas. */
export function parseGrid(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.map((line) => (line.includes('\t') ? line.split('\t') : line.split(',')).map((cell) => cell.trim()));
}

/**
 * Places a pasted grid starting at `origin`: row i and column j of the paste go to the well i rows down and
 * j columns across. Empty cells leave that well unchanged. Cells that fall off the plate are dropped.
 */
export function applyGrid(
  format: PlateFormat,
  wells: Record<string, SampleWell>,
  origin: string,
  grid: string[][],
): Record<string, SampleWell> {
  const start = wellPosition(origin);
  if (!start) return wells;
  const next = { ...wells };
  grid.forEach((row, i) => {
    row.forEach((cell, j) => {
      const id = `${ROW_LETTERS[start.row + i] ?? ''}${start.col + j}`;
      if (cell === '' || !isWellInFormat(id, format)) return;
      const group = next[id]?.group ?? '';
      next[id] = { sampleId: cell, label: cell, group };
    });
  });
  return next;
}

/** One row per filled well, in reading order: well, sample id, label, group. */
export function plateCsv(format: PlateFormat, wells: Record<string, SampleWell>): string {
  const rows = wellIds(format)
    .filter((id) => wells[id] !== undefined)
    .map((id) => {
      const w = wells[id];
      return [id, w.sampleId, w.label, w.group];
    });
  return toCsv([['well', 'sample_id', 'label', 'group'], ...rows]);
}
