/** Pure statistics for the tour's sample results. No DOM or database access. */

export interface Summary {
  n: number;
  mean: number;
  /** Sample standard deviation (n - 1). Zero when there is one value or none. */
  sd: number;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Sample standard deviation with Bessel's correction (divides by n - 1). */
export function sampleSd(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const squares = values.reduce((sum, v) => sum + (v - m) ** 2, 0);
  return Math.sqrt(squares / (values.length - 1));
}

export function summarize(values: readonly number[]): Summary {
  return { n: values.length, mean: mean(values), sd: sampleSd(values) };
}

/** Mean ± SD as text, rounded to whole numbers, for example "184 ± 13". */
export function formatMeanSd(summary: Summary, digits = 0): string {
  if (summary.n === 0) return '—';
  return `${summary.mean.toFixed(digits)} ± ${summary.sd.toFixed(digits)}`;
}

/** Minutes and seconds for a count of seconds, for example 4020 becomes "67:00". */
export function formatMinSec(totalSec: number): string {
  const sign = totalSec < 0 ? '-' : '';
  const abs = Math.round(Math.abs(totalSec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}
