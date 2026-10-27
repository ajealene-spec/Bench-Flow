import { SAMPLE_NOTICE } from './sampleNotice';
/*
 * SAMPLE data for the guided tour and the demo experiment. Every number here is generated for
 * demonstration from a fixed seed. Nothing in this file is a real measurement or a result.
 */

export const SAMPLE_LABEL = 'Sample data';
/** Caption shown on every chart of sample results. */
export const SAMPLE_CAPTION = SAMPLE_NOTICE;

export const DEMO_TEMPLATE_TITLE = 'Fluo-4 calcium imaging in APOE3 vs APOE4 astrocytes';
export const DEMO_TEMPLATE_CATEGORY = 'Calcium imaging';

/** The user's protocol, pasted in step 1. Phase headings become the Prep / Loading / Imaging / Analysis phases. */
export const SAMPLE_PROTOCOL_TEXT = `Phase 1: Prep
1. Coat wells with Matrigel and 15 µL laminin.
2. Culture iPSC-derived APOE3 and APOE4 astrocytes to 80% confluency.
Phase 2: Loading
3. Load cells with 5 µM Fluo-4 AM.
4. Incubate 1 hr at 37 °C, then 30 min at room temperature (22 °C).
Phase 3: Imaging
5. Live-cell imaging at 30 fps: record a 5 s baseline, add the treatment, record 1 min after.
6. Treatments: Tris-HCl (negative control), 5 µM glutamate (positive control), alpha-synuclein at 100 nM and 500 nM.
Phase 4: Analysis
7. Analysis in ImageJ/FIJI: somatic ROIs around individual cells; peak ΔF/F0 and AUC; compare groups with t-tests.`;

export const GENOTYPES = ['APOE3', 'APOE4'] as const;
export type Genotype = (typeof GENOTYPES)[number];

export interface SampleCondition {
  id: 'tris' | 'glutamate' | 'syn100' | 'syn500';
  label: string;
  /** Short label for narrow charts. */
  short: string;
}

export const SAMPLE_CONDITIONS: SampleCondition[] = [
  { id: 'tris', label: 'Tris-HCl (negative)', short: 'Tris' },
  { id: 'glutamate', label: 'Glutamate 5 µM (positive)', short: 'Glu' },
  { id: 'syn100', label: 'α-syn 100 nM', short: 'α-syn 100' },
  { id: 'syn500', label: 'α-syn 500 nM', short: 'α-syn 500' },
];

/** Coverslips and ROIs per group. 3 coverslips × 10 ROIs = 30 cells per genotype and condition. */
export const SAMPLE_COVERSLIPS = 3;
export const ROIS_PER_COVERSLIP = 10;
export const CELLS_PER_GROUP = SAMPLE_COVERSLIPS * ROIS_PER_COVERSLIP;

/** Fluo-4 AM stock and loading targets. */
export const FLUO4_STOCK_MM = 1;
export const FLUO4_PLANNED_UM = 5;
/** The loading concentration the sample run actually used. */
export const FLUO4_ACTUAL_UM = 4.17;
export const SAMPLE_LOADING_VOLUME_ML = 2;

/** Incubation after loading: 1 hour at 37 °C, then 30 minutes at room temperature. */
export const INCUBATION_37_SEC = 60 * 60;
export const INCUBATION_RT_SEC = 30 * 60;

// --- Deterministic generator --------------------------------------------------

/** Small seeded PRNG (mulberry32). The same seed always gives the same sequence. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal sample from two uniforms (Box-Muller). */
function normal(rand: () => number, mean: number, sd: number): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface GroupSpec {
  peak: number;
  peakSd: number;
  /** Area under the curve per unit peak, in ΔF/F0 · s. */
  aucPerPeak: number;
}

/**
 * Sample means. The APOE3 and APOE4 values differ only modestly, and the file deliberately
 * does not say which genotype responds more. These are illustrative numbers.
 */
const SPEC: Record<Genotype, Record<SampleCondition['id'], GroupSpec>> = {
  APOE3: {
    tris: { peak: 0.1, peakSd: 0.03, aucPerPeak: 22 },
    glutamate: { peak: 1.6, peakSd: 0.22, aucPerPeak: 24 },
    syn100: { peak: 0.26, peakSd: 0.07, aucPerPeak: 23 },
    syn500: { peak: 0.41, peakSd: 0.09, aucPerPeak: 23 },
  },
  APOE4: {
    tris: { peak: 0.12, peakSd: 0.03, aucPerPeak: 22 },
    glutamate: { peak: 1.45, peakSd: 0.25, aucPerPeak: 24 },
    syn100: { peak: 0.31, peakSd: 0.08, aucPerPeak: 23 },
    syn500: { peak: 0.48, peakSd: 0.1, aucPerPeak: 23 },
  },
};

export interface SampleCells {
  peak: number[];
  auc: number[];
}

/** Builds every sample cell value. Pure and deterministic: seed 20261026. */
export function buildSampleCells(seed = 20261026): Record<Genotype, Record<SampleCondition['id'], SampleCells>> {
  const rand = seededRandom(seed);
  const out = {} as Record<Genotype, Record<SampleCondition['id'], SampleCells>>;
  for (const g of GENOTYPES) {
    out[g] = {} as Record<SampleCondition['id'], SampleCells>;
    for (const c of SAMPLE_CONDITIONS) {
      const spec = SPEC[g][c.id];
      const peak: number[] = [];
      const auc: number[] = [];
      for (let i = 0; i < CELLS_PER_GROUP; i++) {
        const p = Math.max(0.01, normal(rand, spec.peak, spec.peakSd));
        peak.push(round(p, 3));
        auc.push(round(Math.max(0.5, p * spec.aucPerPeak * (1 + normal(rand, 0, 0.08))), 2));
      }
      out[g][c.id] = { peak, auc };
    }
  }
  return out;
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** The sample cells, built once. */
export const SAMPLE_CELLS = buildSampleCells();

/**
 * One example ΔF/F0 trace, sampled every 0.5 s: 5 s baseline, treatment at 5 s, 1 min response.
 * Sample data for demonstration.
 */
export function buildSampleTrace(seed = 4242): Array<{ t: number; f: number }> {
  const rand = seededRandom(seed);
  const points: Array<{ t: number; f: number }> = [];
  for (let t = 0; t <= 65; t += 0.5) {
    let f = 0;
    if (t >= 5) {
      const x = t - 5;
      // Fast rise, then a slow decay toward baseline.
      f = 1.5 * (1 - Math.exp(-x / 1.2)) * Math.exp(-x / 22);
    }
    f += normal(rand, 0, 0.012);
    points.push({ t, f: round(f, 4) });
  }
  return points;
}

export const SAMPLE_TRACE = buildSampleTrace();

/** Methods note on the calculators and loading values, in plain text. */
export const SAMPLE_DEMO_NOTE =
  'Sample data for demonstration. Made-up numbers, not real results. Fluo-4 AM was loaded at 4.17 µM instead of the planned 5 µM.';

/** Trace timing: 5 s baseline, treatment at 5 s, 1 min of response after it. */
export const TRACE_BASELINE_SEC = 5;
export const TRACE_TOTAL_SEC = 65;

export type CellMetric = 'peak' | 'auc';
export const CELL_METRIC_LABEL: Record<CellMetric, string> = { peak: 'Peak ΔF/F0', auc: 'AUC' };
export const CELL_METRIC_UNIT: Record<CellMetric, string> = { peak: 'ΔF/F0', auc: 'ΔF/F0·s' };

/** Values for one group (genotype and condition) of sample cells. */
export function sampleGroupValues(genotype: Genotype, conditionId: SampleCondition['id'], metric: CellMetric): number[] {
  return SAMPLE_CELLS[genotype][conditionId][metric];
}

/** The label a sample cell is stored under. Coverslip and ROI start at 1. */
export function sampleCellLabel(metric: CellMetric, genotype: Genotype, conditionId: SampleCondition['id'], coverslip: number, roi: number): string {
  return `Sample data: ${CELL_METRIC_LABEL[metric]} ${genotype} ${conditionId} coverslip ${coverslip} ROI ${roi}`;
}
