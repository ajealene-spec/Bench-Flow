/** Linear scales and tick helpers for the hand-drawn SVG charts. Pure. */

export interface LinearScale {
  (value: number): number;
  domain: [number, number];
  range: [number, number];
}

/** Maps a numeric domain onto a pixel range. A zero-width domain maps to the middle of the range. */
export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const fn = ((value: number) => {
    if (d1 === d0) return (r0 + r1) / 2;
    return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
  }) as LinearScale;
  fn.domain = domain;
  fn.range = range;
  return fn;
}

/** Expands a [min, max] pair to round tick boundaries and returns the ticks. */
export function niceTicks(min: number, max: number, count = 5): { domain: [number, number]; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 1], ticks: [0, 1] };
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (lo === hi) {
    const pad = lo === 0 ? 1 : Math.abs(lo) * 0.1;
    lo -= pad;
    hi += pad;
  }
  const rawStep = (hi - lo) / Math.max(1, count);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const niceStep = (residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1) * magnitude;
  const start = Math.floor(lo / niceStep) * niceStep;
  const end = Math.ceil(hi / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let t = start; t <= end + niceStep / 2; t += niceStep) {
    ticks.push(Number(t.toFixed(10)));
  }
  return { domain: [start, end], ticks };
}

/** Formats a tick value compactly: integers as-is, otherwise up to 3 significant decimals. */
export function formatTick(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return Number(value.toPrecision(3)).toString();
}
