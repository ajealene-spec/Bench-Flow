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

// --- Welch's t-test ----------------------------------------------------------

export interface WelchResult {
  /** Mean of a minus mean of b. */
  meanDiff: number;
  t: number;
  /** Welch-Satterthwaite degrees of freedom. */
  df: number;
  /** Two-sided p-value from the t distribution. */
  p: number;
}

/** Natural log of the gamma function (Lanczos approximation, g = 7). */
function lnGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61503916999385,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  const z = x - 1;
  let a = c[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (modified Lentz method). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta function I_x(a, b). */
function regularizedBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(a, b, x)) / a;
  return 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-sided p-value for a t statistic with df degrees of freedom. Approximate to about 1e-10. */
export function twoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t)) return 0;
  return regularizedBeta(df / 2, 0.5, df / (df + t * t));
}

/**
 * Welch's two-sample t-test (unequal variances). Returns null when either group has fewer than two
 * values, or when both groups have no spread and the means are equal.
 */
export function welchTTest(a: readonly number[], b: readonly number[]): WelchResult | null {
  if (a.length < 2 || b.length < 2) return null;
  const va = sampleSd(a) ** 2;
  const vb = sampleSd(b) ** 2;
  const qa = va / a.length;
  const qb = vb / b.length;
  const se2 = qa + qb;
  const meanDiff = mean(a) - mean(b);
  if (se2 === 0) {
    return meanDiff === 0 ? { meanDiff, t: 0, df: a.length + b.length - 2, p: 1 } : null;
  }
  const t = meanDiff / Math.sqrt(se2);
  const df = se2 ** 2 / (qa ** 2 / (a.length - 1) + qb ** 2 / (b.length - 1));
  return { meanDiff, t, df, p: twoSidedP(t, df) };
}

/** A p-value for display: "< 0.001" for very small values, otherwise three decimals. */
export function formatP(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.001) return '< 0.001';
  return p.toFixed(3);
}
