/*
 * Perfusion volumes by body weight. Pure math.
 *
 * The per-gram rates are starting values only. Use the volumes and flow rates in your
 * IACUC-approved protocol; the tool lets you edit every rate.
 */

export interface PerfusionRates {
  /** Saline or PBS rinse, mL per gram of body weight. */
  salineMlPerG: number;
  /** Fixative (e.g. 4% PFA), mL per gram of body weight. */
  fixativeMlPerG: number;
  /** Pump flow rate in mL per minute. Optional. */
  flowMlPerMin?: number;
}

export const PERFUSION_PRESETS: Record<'mouse' | 'rat', PerfusionRates> = {
  mouse: { salineMlPerG: 1, fixativeMlPerG: 1, flowMlPerMin: 3 },
  rat: { salineMlPerG: 1, fixativeMlPerG: 1, flowMlPerMin: 25 },
};

export interface PerfusionPlan {
  weightG: number;
  salineMl: number;
  fixativeMl: number;
  totalMl: number;
  /** Minutes of pumping for each phase, when a flow rate is set. */
  salineMin?: number;
  fixativeMin?: number;
}

export class PerfusionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PerfusionError';
  }
}

export function perfusionPlan(weightG: number, rates: PerfusionRates): PerfusionPlan {
  if (!Number.isFinite(weightG) || weightG <= 0) throw new PerfusionError('Body weight must be greater than 0 g');
  if (!Number.isFinite(rates.salineMlPerG) || rates.salineMlPerG < 0) throw new PerfusionError('Saline rate must be 0 or more');
  if (!Number.isFinite(rates.fixativeMlPerG) || rates.fixativeMlPerG < 0) throw new PerfusionError('Fixative rate must be 0 or more');
  const salineMl = round1(weightG * rates.salineMlPerG);
  const fixativeMl = round1(weightG * rates.fixativeMlPerG);
  const plan: PerfusionPlan = { weightG, salineMl, fixativeMl, totalMl: round1(salineMl + fixativeMl) };
  if (rates.flowMlPerMin !== undefined) {
    if (!(rates.flowMlPerMin > 0)) throw new PerfusionError('Flow rate must be greater than 0 mL/min');
    plan.salineMin = round1(salineMl / rates.flowMlPerMin);
    plan.fixativeMin = round1(fixativeMl / rates.flowMlPerMin);
  }
  return plan;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
