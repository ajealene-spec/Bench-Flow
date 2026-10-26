/*
 * Parses pasted measurements, e.g. copied from Excel, an instrument printout or a notes file.
 *
 * Accepted layouts, one measurement per line:
 *   12.5                      value only
 *   12.5 µg/µL                value and unit
 *   0.85 OD                   value and unit
 *   Absorbance: 0.85 OD       label, value and unit
 *   Sample A<TAB>0.85<TAB>OD  label, value and unit (tab-separated, as Excel copies)
 *   Sample A,0.85,OD          comma-separated columns (see isColumnComma)
 *   1.2<TAB>3.4               several numbers on one row: one measurement each
 *
 * Lines without any number (headers such as "Sample<TAB>Abs") are skipped and counted.
 */

export interface PastedValue {
  label: string;
  value: number;
  unit: string;
}

export interface ParseResult {
  values: PastedValue[];
  skippedLines: number;
}

const NUMBER_START = /^[-+−]?\d/;
const PURE_NUMBER = /^[-+−]?(\d{1,3}(,\d{3})+(\.\d+)?|\d+([.,]\d+)?|\.\d+)(e[-+−]?\d+)?$/i;
const LEADING_NUMBER = /^([-+−]?\d+(?:[.,]\d+)?(?:e[-+−]?\d+)?)(?=\s|$|[^\d.,])\s*(.*)$/i;

/** Converts "12,5", "1.2e-3", "−4" (unicode minus) to a number. Returns undefined if not numeric. */
export function parseNumber(text: string): number | undefined {
  let t = text.trim().replace(/−/g, '-');
  if (!PURE_NUMBER.test(text.trim().replace(/−/g, '-'))) return undefined;
  if (/^[-+]?\d+,\d+$/.test(t)) t = t.replace(',', '.'); // decimal comma, e.g. 12,5
  else if (t.includes(',') && t.includes('.')) t = t.replace(/,/g, ''); // 1,234.5
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * A comma splits columns only when it cannot be a decimal comma: followed by a space,
 * a letter or other non-digit text, or when the line has more than one comma.
 * "12,5" is one value; "Sample A, 0.85, OD" is three columns.
 */
export function isColumnComma(line: string): boolean {
  if (/,\s*(?!\d)/.test(line)) return true;
  if (/,\s/.test(line)) return true;
  return (line.match(/,/g) ?? []).length > 1;
}

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
  if (isColumnComma(line)) return line.split(',').map((c) => c.trim());
  return [line.trim()];
}

/** Splits one cell into value and unit when it starts with a number, e.g. "12.5 µg/µL". */
function valueFromCell(cell: string): { value: number; unit: string } | undefined {
  const match = LEADING_NUMBER.exec(cell.trim().replace(/−/g, '-'));
  if (!match) return undefined;
  const value = parseNumber(match[1]);
  if (value === undefined) return undefined;
  return { value, unit: match[2].trim() };
}

function parseLine(line: string): PastedValue[] | undefined {
  const cells = splitCells(line).filter((c) => c !== '');
  if (cells.length === 0) return undefined;

  if (cells.length === 1) {
    // "Absorbance: 0.85 OD" or "12.5 µg/µL": optional label, then the number, then the unit.
    const text = cells[0];
    const labelled = /^(.*?)[:=]\s*(.+)$/.exec(text);
    if (labelled && !NUMBER_START.test(text) && valueFromCell(labelled[2])) {
      const v = valueFromCell(labelled[2])!;
      return [{ label: labelled[1].trim(), value: v.value, unit: v.unit }];
    }
    const direct = valueFromCell(text);
    if (direct) return [{ label: '', value: direct.value, unit: direct.unit }];
    const trailing = /^(.*?)\s+([-+−]?\d+(?:[.,]\d+)?(?:e[-+−]?\d+)?)\s*(.*)$/i.exec(text);
    if (trailing) {
      const value = parseNumber(trailing[2]);
      if (value !== undefined) return [{ label: trailing[1].trim(), value, unit: trailing[3].trim() }];
    }
    return undefined;
  }

  // Several cells. Numeric cells that are only numbers on a row of numbers give one value each.
  const allNumeric = cells.every((c) => PURE_NUMBER.test(c.replace(/−/g, '-')));
  if (allNumeric) {
    return cells.map((c) => ({ label: '', value: parseNumber(c)!, unit: '' }));
  }

  const valueIndex = cells.findIndex((c) => NUMBER_START.test(c.replace(/−/g, '-')) && valueFromCell(c));
  if (valueIndex === -1) return undefined;
  const first = valueFromCell(cells[valueIndex])!;
  const before = cells.slice(0, valueIndex).filter(Boolean).join(' ');
  const after = cells.slice(valueIndex + 1).filter(Boolean);
  const unit = first.unit || after[0] || '';
  return [{ label: before, value: first.value, unit }];
}

/** Parses pasted text into measurements. Never throws; unparseable lines are counted in skippedLines. */
export function parsePastedValues(text: string): ParseResult {
  const values: PastedValue[] = [];
  let skippedLines = 0;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    if (raw.trim() === '') continue;
    const parsed = parseLine(raw);
    if (parsed) values.push(...parsed);
    else skippedLines += 1;
  }
  return { values, skippedLines };
}

/**
 * Fills blank labels. Rows without a label take the field label at the same position
 * (from the step's data fields) when there is one, otherwise the fallback label.
 */
export function fillLabels(values: PastedValue[], fieldLabels: string[], fallback = ''): PastedValue[] {
  return values.map((v, i) => ({
    ...v,
    label: v.label || fieldLabels[i] || fallback,
  }));
}
