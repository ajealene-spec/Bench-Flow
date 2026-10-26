/*
 * Display rounding for step variables. The stored value keeps full precision; this only decides
 * how it reads on the bench. µL at or above 1000 read as mL.
 */

/** Smallest reading step per unit. Values are rounded to it for display. */
const STEP: Record<string, number> = {
  'µL': 0.1,
  mL: 0.001,
  L: 0.001,
  'µg': 0.1,
  mg: 0.01,
  g: 0.001,
  nM: 0.001,
  'µM': 0.001,
  mM: 0.001,
  M: 0.001,
  '%': 0.01,
  x: 0.01,
  samples: 1,
};

function decimals(step: number): number {
  return String(step).split('.')[1]?.length ?? 0;
}

function trimmed(value: number, step: number): string {
  return parseFloat(value.toFixed(decimals(step))).toString();
}

/** Formats a value for display in its unit, e.g. "10 µL", "1.235 mL", "1:1000", "<0.1 µL". */
export function formatAmount(value: number, unit: string): string {
  if (!Number.isFinite(value)) return '—';
  if (unit === '1:N') return `1:${trimmed(value, 1)}`;
  let shown = value;
  let shownUnit = unit;
  if (unit === 'µL' && Math.abs(value) >= 1000) {
    shown = value / 1000;
    shownUnit = 'mL';
  }
  const step = STEP[shownUnit] ?? 0.01;
  const rounded = Math.round(shown / step) * step;
  if (shown !== 0 && rounded === 0) return `<${trimmed(step, step)} ${shownUnit}`;
  if (shownUnit === 'samples') return `${Math.round(shown)} samples`;
  const text = trimmed(rounded, step);
  return shownUnit === '%' ? `${text}%` : `${text} ${shownUnit}`;
}
