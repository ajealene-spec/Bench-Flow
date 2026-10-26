/*
 * Recipe scaling and osmolarity estimates for buffers such as ACSF and cutting solutions. Pure math.
 * Amounts are in mM. Grams = mM / 1000 × MW (g/mol) × volume (L).
 */

export interface SolutionComponent {
  id: string;
  name: string;
  /** Molecular weight in g/mol. Use the hydrate listed on your bottle. */
  mw: number;
  /** Concentration in mM for the reference recipe. */
  mM: number;
  /** Particles per formula unit once dissolved (used for osmolarity). */
  particles: number;
  /** Optional note shown next to the component. */
  note?: string;
}

export class SolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SolutionError';
  }
}

/** Standard ACSF for slice electrophysiology. Starting values only; check your own recipe. */
export const ACSF_RECIPE: SolutionComponent[] = [
  { id: 'nacl', name: 'NaCl', mw: 58.44, mM: 125, particles: 2 },
  { id: 'kcl', name: 'KCl', mw: 74.55, mM: 2.5, particles: 2 },
  { id: 'nah2po4', name: 'NaH₂PO₄·H₂O', mw: 137.99, mM: 1.25, particles: 2 },
  { id: 'nahco3', name: 'NaHCO₃', mw: 84.01, mM: 26, particles: 2 },
  { id: 'glucose', name: 'D-glucose', mw: 180.16, mM: 25, particles: 1 },
  { id: 'cacl2', name: 'CaCl₂·2H₂O', mw: 147.01, mM: 2, particles: 3 },
  { id: 'mgcl2', name: 'MgCl₂·6H₂O', mw: 203.3, mM: 1, particles: 3, note: 'Add after CaCl₂ or use a separate stock' },
];

export interface ScaledComponent extends SolutionComponent {
  grams: number;
}

/** Grams of each component for a volume. Scale factor multiplies every mM value (1 = recipe as written). */
export function scaleRecipe(components: SolutionComponent[], volumeL: number, scale = 1): ScaledComponent[] {
  if (!Number.isFinite(volumeL) || volumeL <= 0) throw new SolutionError('Volume must be greater than 0 L');
  if (!Number.isFinite(scale) || scale <= 0) throw new SolutionError('Scale must be greater than 0');
  return components.map((c) => {
    if (!Number.isFinite(c.mw) || c.mw <= 0) throw new SolutionError(`${c.name}: molecular weight must be greater than 0`);
    if (!Number.isFinite(c.mM) || c.mM < 0) throw new SolutionError(`${c.name}: concentration must be 0 or more`);
    const mM = c.mM * scale;
    return { ...c, mM, grams: round(((mM / 1000) * c.mw * volumeL), 4) };
  });
}

/**
 * Ideal osmolarity estimate: sum of mM × particles. Real solutions run lower (osmotic coefficient
 * near 0.9), so pass coefficient to match a measured value. Default 1 gives the ideal number.
 */
export function estimateOsmolarity(components: SolutionComponent[], coefficient = 1): number {
  if (!Number.isFinite(coefficient) || coefficient <= 0) throw new SolutionError('Osmotic coefficient must be greater than 0');
  const ideal = components.reduce((sum, c) => sum + c.mM * c.particles, 0);
  return round(ideal * coefficient, 1);
}

export interface OsmolarityCheck {
  estimate: number;
  target: number;
  tolerance: number;
  inRange: boolean;
  /** Mosmol difference from target. Positive means too concentrated. */
  difference: number;
}

export function checkOsmolarity(estimate: number, target = 300, tolerance = 10): OsmolarityCheck {
  if (!Number.isFinite(target) || target <= 0) throw new SolutionError('Target must be greater than 0 mOsm');
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new SolutionError('Tolerance must be 0 or more');
  const difference = round(estimate - target, 1);
  return { estimate, target, tolerance, inRange: Math.abs(difference) <= tolerance, difference };
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
