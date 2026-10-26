/*
 * Shapes the Insights charts read. Pure: callers load the rows, these functions only reshape them.
 */
import type { EphysRecord, Experiment, ExecutionEvent, Procedure, StepRecord } from '../../types';
import { TIMER_TOLERANCE } from '../run/deviation';

export const NO_PROTOCOL = 'No protocol';
/** Input resistance reference line on the ephys strip plot, in MΩ. */
export const RM_REFERENCE_MOHM = 25;

export interface InsightsRun {
  experimentId: string;
  name: string;
  protocol: string;
  /** Start date (or creation date) as a timestamp. Used for ordering and the date filter. */
  date: number;
  /** Protocol step titles in order. Used to match steps across runs. */
  stepTitles: string[];
  numbers: Array<{ stepTitle: string; label: string; value: number; unit?: string }>;
  timers: Array<{ stepTitle: string; plannedSec: number; actualSec: number }>;
  ephys: Array<{ cellId: string; Ra: number; Rm: number }>;
  /** Reproducibility score 0 to 100, or null when it could not be computed. */
  score: number | null;
}

export interface RawRun {
  experiment: Experiment;
  procedure?: Procedure;
  records: StepRecord[];
  events: ExecutionEvent[];
  ephys: EphysRecord[];
  score: number | null;
}

export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Builds the chart model for one run. Step records and timer events are matched to steps by title. */
export function buildInsightsRun(raw: RawRun): InsightsRun {
  const steps = raw.procedure?.steps ?? [];
  const titleById = new Map(steps.map((s) => [s.id, s.title.trim()]));
  const titleOf = (stepId: string | undefined) => (stepId && titleById.get(stepId)) || 'Unassigned';
  const experiment = raw.experiment;

  const numbers = raw.records
    .filter((r) => r.kind === 'number' && typeof r.value === 'number' && Number.isFinite(r.value))
    .map((r) => ({ stepTitle: titleOf(r.stepId), label: r.label.trim() || 'Value', value: r.value as number, unit: r.unit }));

  const timers: InsightsRun['timers'] = [];
  for (const e of raw.events) {
    if (e.type !== 'timer_stop') continue;
    if (typeof e.planned !== 'number' || e.planned <= 0 || typeof e.actual !== 'number') continue;
    timers.push({ stepTitle: titleOf(e.stepId), plannedSec: e.planned, actualSec: e.actual });
  }

  return {
    experimentId: experiment.id,
    name: experiment.name,
    protocol: raw.procedure?.title.trim() || NO_PROTOCOL,
    date: experiment.startedAt ?? experiment.createdAt,
    stepTitles: steps.map((s) => s.title.trim()),
    numbers,
    timers,
    ephys: raw.ephys.map((e) => ({ cellId: e.cellId, Ra: e.Ra, Rm: e.Rm })).filter((e) => Number.isFinite(e.Ra) && Number.isFinite(e.Rm)),
    score: raw.score,
  };
}

export interface InsightsFilter {
  protocol?: string;
  /** Inclusive, timestamps in ms. */
  from?: number;
  to?: number;
}

export function filterRuns(runs: InsightsRun[], filter: InsightsFilter): InsightsRun[] {
  return runs
    .filter((r) => (filter.protocol === undefined || r.protocol === filter.protocol))
    .filter((r) => (filter.from === undefined || r.date >= filter.from))
    .filter((r) => (filter.to === undefined || r.date <= filter.to))
    .sort((a, b) => a.date - b.date || a.name.localeCompare(b.name));
}

export interface ProtocolOption {
  protocol: string;
  runCount: number;
}

/** Protocols with at least one run, most runs first. */
export function protocolOptions(runs: InsightsRun[]): ProtocolOption[] {
  const counts = new Map<string, number>();
  for (const r of runs) counts.set(r.protocol, (counts.get(r.protocol) ?? 0) + 1);
  return [...counts.entries()]
    .map(([protocol, runCount]) => ({ protocol, runCount }))
    .sort((a, b) => b.runCount - a.runCount || a.protocol.localeCompare(b.protocol));
}

export interface MeanSd {
  n: number;
  mean: number;
  /** Sample standard deviation (n − 1). 0 when fewer than two values. */
  sd: number;
}

export function meanSd(values: number[]): MeanSd | undefined {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length === 0) return undefined;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (xs.length < 2) return { n: xs.length, mean, sd: 0 };
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return { n: xs.length, mean, sd: Math.sqrt(variance) };
}

export interface NumericPoint {
  /** Position of the run among the selected runs, starting at 0. */
  runIndex: number;
  runName: string;
  date: number;
  /** Mean of the values this run recorded for this field. */
  value: number;
}

export interface NumericSeries {
  key: string;
  stepTitle: string;
  label: string;
  unit?: string;
  points: NumericPoint[];
  stats?: MeanSd;
}

/** One series per step and field, with one point per run (the run's mean for that field). Sorted by step order. */
export function numericSeries(runs: InsightsRun[]): NumericSeries[] {
  const groups = new Map<string, { stepTitle: string; label: string; unit?: string; byRun: Map<number, number[]> }>();
  runs.forEach((run, runIndex) => {
    for (const n of run.numbers) {
      const key = `${normalizeTitle(n.stepTitle)}||${n.label}||${n.unit ?? ''}`;
      let group = groups.get(key);
      if (!group) {
        group = { stepTitle: n.stepTitle, label: n.label, unit: n.unit, byRun: new Map() };
        groups.set(key, group);
      }
      const list = group.byRun.get(runIndex) ?? [];
      list.push(n.value);
      group.byRun.set(runIndex, list);
    }
  });
  const out: NumericSeries[] = [];
  for (const [key, g] of groups) {
    const points: NumericPoint[] = [...g.byRun.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([runIndex, values]) => ({
        runIndex,
        runName: runs[runIndex].name,
        date: runs[runIndex].date,
        value: values.reduce((a, b) => a + b, 0) / values.length,
      }));
    out.push({ key, stepTitle: g.stepTitle, label: g.label, unit: g.unit, points, stats: meanSd(points.map((p) => p.value)) });
  }
  const stepOrder = (title: string) => {
    const i = runs.map((r) => r.stepTitles.map(normalizeTitle).indexOf(normalizeTitle(title))).find((x) => x >= 0);
    return i ?? Number.MAX_SAFE_INTEGER;
  };
  return out.sort((a, b) => stepOrder(a.stepTitle) - stepOrder(b.stepTitle) || a.label.localeCompare(b.label));
}

export interface TimerDeviationBar {
  stepTitle: string;
  n: number;
  /** Mean absolute deviation from the plan, as a percentage of the planned time. */
  meanAbsPct: number;
  /** Timers that finished outside the tolerance. */
  outside: number;
}

/** Per step: how far timers drifted from plan across runs, as a percentage of the planned time. */
export function timerDeviationBars(runs: InsightsRun[]): TimerDeviationBar[] {
  const byStep = new Map<string, { stepTitle: string; pcts: number[]; outside: number }>();
  for (const run of runs) {
    for (const t of run.timers) {
      const key = normalizeTitle(t.stepTitle);
      const pct = ((t.actualSec - t.plannedSec) / t.plannedSec) * 100;
      const entry = byStep.get(key) ?? { stepTitle: t.stepTitle, pcts: [], outside: 0 };
      entry.pcts.push(Math.abs(pct));
      if (Math.abs(pct) / 100 > TIMER_TOLERANCE) entry.outside += 1;
      byStep.set(key, entry);
    }
  }
  return [...byStep.values()]
    .map((e) => ({
      stepTitle: e.stepTitle,
      n: e.pcts.length,
      meanAbsPct: e.pcts.reduce((a, b) => a + b, 0) / e.pcts.length,
      outside: e.outside,
    }))
    .sort((a, b) => b.meanAbsPct - a.meanAbsPct || a.stepTitle.localeCompare(b.stepTitle));
}

export interface EphysStrip {
  Ra: Array<{ runName: string; cellId: string; value: number }>;
  Rm: Array<{ runName: string; cellId: string; value: number }>;
}

export function ephysStrip(runs: InsightsRun[]): EphysStrip {
  const out: EphysStrip = { Ra: [], Rm: [] };
  for (const run of runs) {
    for (const e of run.ephys) {
      out.Ra.push({ runName: run.name, cellId: e.cellId, value: e.Ra });
      out.Rm.push({ runName: run.name, cellId: e.cellId, value: e.Rm });
    }
  }
  return out;
}

export interface ScorePoint {
  date: number;
  runName: string;
  score: number;
}

export function scoresOverTime(runs: InsightsRun[]): ScorePoint[] {
  return runs
    .filter((r): r is InsightsRun & { score: number } => r.score !== null)
    .map((r) => ({ date: r.date, runName: r.name, score: r.score }));
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local start of a yyyy-mm-dd date, or undefined when the text is not a date. */
export function dayStart(text: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

/** Local end (inclusive) of a yyyy-mm-dd date. */
export function dayEnd(text: string): number | undefined {
  const start = dayStart(text);
  return start === undefined ? undefined : start + DAY_MS - 1;
}
