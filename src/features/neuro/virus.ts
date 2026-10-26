/*
 * Viral titer to injection volume and dilution. Pure math.
 * Titers are in viral genomes per mL (vg/mL). Doses are in vg. Volumes are in µL.
 */

export class VirusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VirusError';
  }
}

/** Volume (µL) of undiluted stock that delivers the dose. */
export function injectionVolumeUl(stockTiterVgPerMl: number, doseVg: number): number {
  requirePos(stockTiterVgPerMl, 'Stock titer');
  requirePos(doseVg, 'Dose');
  return round(doseVg / (stockTiterVgPerMl / 1000), 2);
}

export interface DilutionPlan {
  /** Concentration needed in the injection (vg/mL) so that targetDose fits in injectionVolumeUl. */
  neededVgPerMl: number;
  /** Fold dilution of the stock. 1 means no dilution. Below 1 means the stock is weaker than needed. */
  foldDilution: number;
  /** Volume of stock to take for finalVolumeUl. */
  stockUl: number;
  /** Volume of diluent (saline, PBS or ACSF) to add. */
  diluentUl: number;
  /** Final volume made, in µL. */
  finalVolumeUl: number;
  warning?: string;
}

/**
 * Dilution to deliver doseVg in injectionVolumeUl from a stock of stockTiterVgPerMl. The stock is
 * diluted to a final volume of finalVolumeUl (defaults to injectionVolumeUl).
 */
export function dilutionPlan(input: {
  stockTiterVgPerMl: number;
  doseVg: number;
  injectionVolumeUl: number;
  finalVolumeUl?: number;
}): DilutionPlan {
  requirePos(input.stockTiterVgPerMl, 'Stock titer');
  requirePos(input.doseVg, 'Dose');
  requirePos(input.injectionVolumeUl, 'Injection volume');
  const finalVolumeUl = input.finalVolumeUl ?? input.injectionVolumeUl;
  requirePos(finalVolumeUl, 'Final volume');
  const neededVgPerMl = input.doseVg / (input.injectionVolumeUl / 1000);
  const foldDilution = input.stockTiterVgPerMl / neededVgPerMl;
  const stockUl = round(finalVolumeUl / foldDilution, 2);
  const plan: DilutionPlan = {
    neededVgPerMl,
    foldDilution: round(foldDilution, 3),
    stockUl,
    diluentUl: round(finalVolumeUl - stockUl, 2),
    finalVolumeUl,
  };
  if (stockUl > finalVolumeUl) {
    plan.warning = 'Stock is weaker than needed. Inject undiluted or raise the dose or the injection volume.';
  }
  return plan;
}

/** Titer (vg/mL) after diluting a stock by a fold factor (for example 10 for a 1:10 dilution). */
export function titerAfterDilution(stockTiterVgPerMl: number, fold: number): number {
  requirePos(stockTiterVgPerMl, 'Stock titer');
  requirePos(fold, 'Fold dilution');
  return stockTiterVgPerMl / fold;
}

function requirePos(n: number, name: string): void {
  if (!Number.isFinite(n) || n <= 0) throw new VirusError(`${name} must be greater than 0`);
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
