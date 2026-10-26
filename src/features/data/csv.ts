/** Minimal CSV writer shared by the data-capture exports. Quotes any cell with a comma, quote or line break. */

export type CsvValue = string | number | boolean | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value === undefined || value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows joined with CRLF, which spreadsheet apps read cleanly. */
export function toCsv(rows: CsvValue[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
