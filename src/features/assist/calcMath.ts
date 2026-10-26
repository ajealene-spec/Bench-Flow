/*
 * Pure, unit-aware lab calculations. No React, no database.
 *
 * Every unit belongs to a family (molar, mass concentration, percent, fold, volume, mass).
 * Values are converted through a per-unit factor to the family base, so mixed units such as
 * "10 mM stock to 100 µM" or "1 L at 10X" work without the caller converting first.
 *
 * Functions throw CalcError on invalid input (non-positive amounts, mismatched unit families,
 * impossible results). The UI catches it and shows the message.
 */

export type VolumeUnit = 'L' | 'mL' | 'µL';
export type MassUnit = 'g' | 'mg' | 'µg' | 'ng';
export type MolarUnit = 'M' | 'mM' | 'µM' | 'nM';
export type MassConcUnit = 'mg/mL' | 'µg/µL' | 'µg/mL' | 'ng/µL';
export type PercentUnit = '%';
export type FoldUnit = 'X';
export type ConcUnit = MolarUnit | MassConcUnit | PercentUnit | FoldUnit;
export type AnyUnit = ConcUnit | VolumeUnit | MassUnit;

export const VOLUME_UNITS: VolumeUnit[] = ['L', 'mL', 'µL'];
export const MASS_UNITS: MassUnit[] = ['g', 'mg', 'µg', 'ng'];
export const MOLAR_UNITS: MolarUnit[] = ['M', 'mM', 'µM', 'nM'];
export const MASS_CONC_UNITS: MassConcUnit[] = ['mg/mL', 'µg/µL', 'µg/mL', 'ng/µL'];

type Family = 'molar' | 'massConc' | 'percent' | 'fold' | 'volume' | 'mass';

/** factor = size of the unit in its family base (M, mg/mL, %, X, L, g). */
const UNITS: Record<AnyUnit, { family: Family; factor: number }> = {
  M: { family: 'molar', factor: 1 },
  mM: { family: 'molar', factor: 1e-3 },
  'µM': { family: 'molar', factor: 1e-6 },
  nM: { family: 'molar', factor: 1e-9 },
  'mg/mL': { family: 'massConc', factor: 1 },
  'µg/µL': { family: 'massConc', factor: 1 },
  'µg/mL': { family: 'massConc', factor: 1e-3 },
  'ng/µL': { family: 'massConc', factor: 1e-3 },
  '%': { family: 'percent', factor: 1 },
  X: { family: 'fold', factor: 1 },
  L: { family: 'volume', factor: 1 },
  mL: { family: 'volume', factor: 1e-3 },
  'µL': { family: 'volume', factor: 1e-6 },
  g: { family: 'mass', factor: 1 },
  mg: { family: 'mass', factor: 1e-3 },
  'µg': { family: 'mass', factor: 1e-6 },
  ng: { family: 'mass', factor: 1e-9 },
};

export class CalcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalcError';
  }
}

/** Parses a typed number. Accepts a decimal comma ("12,5") and rejects anything else. */
export function parseAmount(text: string | null | undefined): number | undefined {
  if (text === null || text === undefined) return undefined;
  let t = text.trim().replace(/−/g, '-');
  if (t === '') return undefined;
  if (t.includes(',') && t.includes('.')) t = t.replace(/,/g, '');
  else t = t.replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Formats a result for display with three significant figures, without trailing zeros. */
export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  return String(Number(value.toPrecision(3)));
}

export function unitFamily(unit: AnyUnit): Family {
  return UNITS[unit].family;
}

export function convertUnit(value: number, from: AnyUnit, to: AnyUnit): number {
  if (UNITS[from].family !== UNITS[to].family) {
    throw new CalcError(`${from} and ${to} are different kinds of units`);
  }
  return (value * UNITS[from].factor) / UNITS[to].factor;
}

function requirePositive(value: number | null | undefined, name: string): number {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    throw new CalcError(`${name} must be a number greater than 0`);
  }
  return value;
}

function requireInteger(value: number, name: string, min: number): number {
  if (!Number.isInteger(value) || value < min) {
    throw new CalcError(`${name} must be a whole number of at least ${min}`);
  }
  return value;
}

// ---------- C1V1 dilution ----------

export type DilutionField = 'c1' | 'v1' | 'c2' | 'v2';

export interface DilutionInput {
  /** Stock concentration. null means unknown. */
  c1: number | null;
  c1Unit: ConcUnit;
  /** Volume of stock to take. null means unknown. */
  v1: number | null;
  v1Unit: VolumeUnit;
  /** Final (target) concentration. null means unknown. */
  c2: number | null;
  c2Unit: ConcUnit;
  /** Final volume. null means unknown. */
  v2: number | null;
  v2Unit: VolumeUnit;
}

export interface DilutionResult {
  field: DilutionField;
  value: number;
  unit: AnyUnit;
  /** Set when the numbers are physically impossible, e.g. the stock is weaker than the target. */
  warning?: string;
}

/**
 * Solves C1V1 = C2V2 for the one field left null. Concentrations may use different units of
 * the same family (10 mM stock, 100 µM target); the solved value comes back in the unit of
 * the solved field.
 */
export function solveDilution(input: DilutionInput): DilutionResult {
  const fields: DilutionField[] = ['c1', 'v1', 'c2', 'v2'];
  const unknown = fields.filter((f) => input[f] === null || input[f] === undefined);
  if (unknown.length !== 1) {
    throw new CalcError('Fill in exactly three of C1, V1, C2 and V2, and leave one empty');
  }
  if (unitFamily(input.c1Unit) !== unitFamily(input.c2Unit)) {
    throw new CalcError('C1 and C2 need units of the same kind (for example both molar, or both X)');
  }
  const field = unknown[0];

  // Work in the units of c1 (concentration) and v1 (volume); the solved field is converted back.
  const c2 = field === 'c2' ? undefined : convertUnit(requirePositive(input.c2, 'C2'), input.c2Unit, input.c1Unit);
  const v2 = field === 'v2' ? undefined : convertUnit(requirePositive(input.v2, 'V2'), input.v2Unit, input.v1Unit);
  const c1 = field === 'c1' ? undefined : requirePositive(input.c1, 'C1');
  const v1 = field === 'v1' ? undefined : requirePositive(input.v1, 'V1');

  let solvedValue: number;
  let solvedUnit: AnyUnit;
  let finalC1: number;
  let finalC2: number;
  let finalV1: number;
  let finalV2: number;

  switch (field) {
    case 'c1':
      finalV1 = v1 as number;
      finalV2 = v2 as number;
      finalC2 = c2 as number;
      finalC1 = (finalC2 * finalV2) / finalV1;
      solvedValue = finalC1;
      solvedUnit = input.c1Unit;
      break;
    case 'v1':
      finalC1 = c1 as number;
      finalC2 = c2 as number;
      finalV2 = v2 as number;
      finalV1 = (finalC2 * finalV2) / finalC1;
      solvedValue = finalV1;
      solvedUnit = input.v1Unit;
      break;
    case 'c2':
      finalC1 = c1 as number;
      finalV1 = v1 as number;
      finalV2 = v2 as number;
      finalC2 = (finalC1 * finalV1) / finalV2;
      solvedValue = convertUnit(finalC2, input.c1Unit, input.c2Unit);
      solvedUnit = input.c2Unit;
      break;
    case 'v2':
      finalC1 = c1 as number;
      finalV1 = v1 as number;
      finalC2 = c2 as number;
      finalV2 = (finalC1 * finalV1) / finalC2;
      solvedValue = convertUnit(finalV2, input.v1Unit, input.v2Unit);
      solvedUnit = input.v2Unit;
      break;
  }

  const warning = dilutionWarning(finalC1, finalC2, finalV1, finalV2);
  return warning ? { field, value: solvedValue, unit: solvedUnit, warning } : { field, value: solvedValue, unit: solvedUnit };
}

function dilutionWarning(c1: number, c2: number, v1: number, v2: number): string | undefined {
  const eps = 1e-9;
  if (c1 + eps < c2) return 'The stock is weaker than the target, so no volume of stock can reach it.';
  if (v1 > v2 + eps) return 'V1 is larger than the final volume. Use a stronger stock or a larger final volume.';
  return undefined;
}

// ---------- Molarity and mass ----------

export interface MolarityToMassInput {
  molarity: number;
  molarityUnit: MolarUnit;
  volume: number;
  volumeUnit: VolumeUnit;
  /** Molecular weight in g/mol. */
  mw: number;
  massUnit: MassUnit;
}

/** Mass to weigh = M × V × MW, returned in massUnit. */
export function molarityToMass(input: MolarityToMassInput): number {
  const molarity = requirePositive(input.molarity, 'Concentration');
  const volume = requirePositive(input.volume, 'Volume');
  const mw = requirePositive(input.mw, 'Molecular weight');
  const moles = convertUnit(molarity, input.molarityUnit, 'M') * convertUnit(volume, input.volumeUnit, 'L');
  return convertUnit(moles * mw, 'g', input.massUnit);
}

export interface MassToMolarityInput {
  mass: number;
  massUnit: MassUnit;
  volume: number;
  volumeUnit: VolumeUnit;
  mw: number;
  molarityUnit: MolarUnit;
}

/** Concentration reached by dissolving a mass in a volume: M = (mass / MW) / V, in molarityUnit. */
export function massToMolarity(input: MassToMolarityInput): number {
  const mass = requirePositive(input.mass, 'Mass');
  const volume = requirePositive(input.volume, 'Volume');
  const mw = requirePositive(input.mw, 'Molecular weight');
  const moles = convertUnit(mass, input.massUnit, 'g') / mw;
  return convertUnit(moles / convertUnit(volume, input.volumeUnit, 'L'), 'M', input.molarityUnit);
}

// ---------- Percent solutions ----------

export interface PercentInput {
  percent: number;
  /** w/v: grams of solute per 100 mL. v/v: mL of solute per 100 mL. */
  basis: 'w/v' | 'v/v';
  finalVolume: number;
  volumeUnit: VolumeUnit;
  /** A mass unit for w/v, a volume unit for v/v. */
  outUnit: MassUnit | VolumeUnit;
}

/** Amount of solute for a percent solution in a final volume. */
export function percentSolute(input: PercentInput): number {
  const percent = requirePositive(input.percent, 'Percent');
  const volumeMl = convertUnit(requirePositive(input.finalVolume, 'Final volume'), input.volumeUnit, 'mL');
  const amountOfSolute = (percent * volumeMl) / 100; // w/v gives g, v/v gives mL
  if (input.basis === 'w/v') {
    if (!MASS_UNITS.includes(input.outUnit as MassUnit)) throw new CalcError('w/v needs a mass unit');
    return convertUnit(amountOfSolute, 'g', input.outUnit as MassUnit);
  }
  if (!VOLUME_UNITS.includes(input.outUnit as VolumeUnit)) throw new CalcError('v/v needs a volume unit');
  return convertUnit(amountOfSolute, 'mL', input.outUnit as VolumeUnit);
}

// ---------- Antibody dilution ----------

export interface AntibodyInput {
  /** N in 1:N. */
  ratio: number;
  finalVolume: number;
  volumeUnit: VolumeUnit;
  outUnit: VolumeUnit;
}

/** Antibody and diluent volumes for 1:N in a final volume. */
export function antibodyDilution(input: AntibodyInput): { antibodyVolume: number; diluentVolume: number } {
  const ratio = requirePositive(input.ratio, 'Dilution ratio');
  if (ratio < 1) throw new CalcError('Dilution ratio must be 1 or more (1:N)');
  const total = requirePositive(input.finalVolume, 'Final volume');
  const totalUl = convertUnit(total, input.volumeUnit, 'µL');
  const antibodyUl = totalUl / ratio;
  return {
    antibodyVolume: convertUnit(antibodyUl, 'µL', input.outUnit),
    diluentVolume: convertUnit(totalUl - antibodyUl, 'µL', input.outUnit),
  };
}

// ---------- Serial dilution ----------

export interface SerialInput {
  startConcentration: number;
  unit: ConcUnit;
  /** Dilution factor per step, e.g. 10 for 1:10 steps. Must be greater than 1. */
  factor: number;
  steps: number;
  /** Volume carried from one tube to the next. */
  transferVolume: number;
  volumeUnit: VolumeUnit;
}

export interface SerialTube {
  /** 0 is the starting solution; n is after n transfers. */
  index: number;
  concentration: number;
  /** Total dilution from the start, e.g. 100 for the second 1:10 step. */
  totalFactor: number;
}

export interface SerialResult {
  tubes: SerialTube[];
  unit: ConcUnit;
  transferVolume: number;
  transferUnit: VolumeUnit;
  /** Diluent added to each tube (transfer × (factor − 1)), so each tube ends at the same volume. */
  diluentVolume: number;
}

export function serialDilution(input: SerialInput): SerialResult {
  const start = requirePositive(input.startConcentration, 'Starting concentration');
  const factor = requirePositive(input.factor, 'Dilution factor');
  if (factor <= 1) throw new CalcError('Dilution factor must be greater than 1');
  const steps = requireInteger(input.steps, 'Number of steps', 1);
  if (steps > 50) throw new CalcError('Use 50 steps or fewer');
  const transfer = requirePositive(input.transferVolume, 'Transfer volume');

  const tubes: SerialTube[] = [];
  for (let i = 0; i <= steps; i++) {
    const totalFactor = factor ** i;
    tubes.push({ index: i, concentration: start / totalFactor, totalFactor });
  }
  return {
    tubes,
    unit: input.unit,
    transferVolume: transfer,
    transferUnit: input.volumeUnit,
    diluentVolume: transfer * (factor - 1),
  };
}

// ---------- Master mix ----------

export interface MasterMixComponent {
  name: string;
  /** Volume of this component for one reaction. */
  perReaction: number;
  unit: VolumeUnit;
}

export interface MasterMixRow extends MasterMixComponent {
  /** perReaction × reactions with overage, in the component's unit. */
  total: number;
}

export interface MasterMixInput {
  reactions: number;
  /** Extra volume to cover pipetting loss, in percent. Default 10. */
  overagePct?: number;
  components: MasterMixComponent[];
}

export interface MasterMixResult {
  reactionsWithOverage: number;
  rows: MasterMixRow[];
  /** Sum of all rows, converted to µL. */
  totalMicroliters: number;
}

export function masterMix(input: MasterMixInput): MasterMixResult {
  const reactions = requireInteger(input.reactions, 'Number of reactions', 1);
  const overage = input.overagePct ?? 10;
  if (!Number.isFinite(overage) || overage < 0) throw new CalcError('Overage must be 0% or more');
  const reactionsWithOverage = reactions * (1 + overage / 100);

  const rows = input.components.map((component) => {
    const perReaction = requirePositive(component.perReaction, `${component.name || 'Component'} volume`);
    return { ...component, name: component.name.trim(), total: perReaction * reactionsWithOverage };
  });
  const totalMicroliters = rows.reduce((sum, row) => sum + convertUnit(row.total, row.unit, 'µL'), 0);
  return { reactionsWithOverage, rows, totalMicroliters };
}

// ---------- Protein loading ----------

export interface ProteinLoadInput {
  /** Lysate concentration as measured, e.g. by BCA. */
  concentration: number;
  concentrationUnit: MassConcUnit;
  /** Protein to load, in µg. */
  targetUg: number;
  /** Final volume after adding buffer, in µL. */
  finalVolume: number;
  /** Laemmli sample buffer strength. Default 4 (4X). */
  laemmliFold?: number;
}

export interface ProteinLoadResult {
  sampleVolume: number;
  laemmliVolume: number;
  bufferVolume: number;
  finalVolume: number;
}

/** Volumes (µL) of lysate, 4X Laemmli and extra buffer that give the target µg in the final volume. */
export function proteinLoad(input: ProteinLoadInput): ProteinLoadResult {
  const concUgPerUl = convertUnit(requirePositive(input.concentration, 'Concentration'), input.concentrationUnit, 'µg/µL');
  const target = requirePositive(input.targetUg, 'Target protein');
  const finalVolume = requirePositive(input.finalVolume, 'Final volume');
  const fold = requirePositive(input.laemmliFold ?? 4, 'Laemmli strength');

  const sampleVolume = target / concUgPerUl;
  const laemmliVolume = finalVolume / fold;
  const bufferVolume = finalVolume - sampleVolume - laemmliVolume;
  if (bufferVolume < -1e-9) {
    throw new CalcError(
      `Lysate needs ${formatValue(sampleVolume)} µL, which does not fit in ${formatValue(finalVolume)} µL with ${formatValue(laemmliVolume)} µL of ${fold}X buffer. Use more concentrated lysate, less protein, or a larger final volume.`,
    );
  }
  return { sampleVolume, laemmliVolume, bufferVolume: Math.max(0, bufferVolume), finalVolume };
}
