/*
 * Finds the calculators a step needs and prefills their inputs from the step text.
 *
 * Detection works sentence by sentence, so "Prepare 500 mL 1X TBST from 10X" is read as one
 * dilution and "Incubate with 1:1000 antibody" is not mistaken for a volume. A step can produce
 * several calculators; a step with none returns [].
 *
 * Heuristics are deliberately conservative: a calculator is offered only when the sentence has
 * the numbers and the verb that make the calculation meaningful. Defaults that were guessed
 * are named in `reason` so the user can see them and change them.
 */
import type { Reagent, Step } from '../../types';
import { convertUnit, type ConcUnit, type MassConcUnit, type MassUnit, type MasterMixComponent, type MolarUnit, type VolumeUnit } from './calcMath';

export type CalcKind = 'dilution' | 'molarity' | 'antibody' | 'serial' | 'percent' | 'masterMix' | 'protein';

export type DetectedCalc =
  | {
      kind: 'dilution';
      reason: string;
      prefill: { c1?: number; c1Unit: ConcUnit; c2?: number; c2Unit: ConcUnit; v2?: number; v2Unit: VolumeUnit };
    }
  | {
      kind: 'molarity';
      reason: string;
      prefill: { molarity?: number; molarityUnit: MolarUnit; volume: number; volumeUnit: VolumeUnit; mw?: number; massUnit: MassUnit };
    }
  | {
      kind: 'antibody';
      reason: string;
      prefill: { label: string; ratio: number; finalVolume: number; volumeUnit: VolumeUnit };
    }
  | {
      kind: 'serial';
      reason: string;
      prefill: { startConcentration?: number; unit: ConcUnit; factor: number; steps: number; transferVolume: number; volumeUnit: VolumeUnit };
    }
  | {
      kind: 'percent';
      reason: string;
      prefill: { percent: number; basis: 'w/v' | 'v/v'; finalVolume: number; volumeUnit: VolumeUnit };
    }
  | {
      kind: 'masterMix';
      reason: string;
      prefill: { reactions: number; components: MasterMixComponent[] };
    }
  | {
      kind: 'protein';
      reason: string;
      prefill: { concentration?: number; concentrationUnit: MassConcUnit; targetUg: number; finalVolume: number };
    };

export const DEFAULT_ANTIBODY_VOLUME = { value: 10, unit: 'mL' as const };
export const DEFAULT_PERCENT_VOLUME = { value: 10, unit: 'mL' as const };
export const DEFAULT_MOLARITY_VOLUME = { value: 100, unit: 'mL' as const };
export const DEFAULT_MASTER_MIX_REACTIONS = 10;
export const DEFAULT_PROTEIN_FINAL_VOLUME = 20;

type StepText = Pick<Step, 'title' | 'instructions' | 'reagents'>;

// ---------- Text helpers ----------

/** Greek mu and the micro sign both become µ (U+00B5), so one regex covers both. */
function normalizeMicro(text: string): string {
  return text.replace(/μ/g, 'µ');
}

function toNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function parseVolumeUnit(raw: string): VolumeUnit | undefined {
  const k = normalizeMicro(raw).toLowerCase().replace(/u/g, 'µ');
  if (k === 'µl') return 'µL';
  if (k === 'ml') return 'mL';
  if (k === 'l') return 'L';
  return undefined;
}

function parseMassConcUnit(raw: string): MassConcUnit | undefined {
  const k = normalizeMicro(raw).toLowerCase().replace(/u/g, 'µ');
  const map: Record<string, MassConcUnit> = {
    'mg/ml': 'mg/mL',
    'µg/µl': 'µg/µL',
    'µg/ml': 'µg/mL',
    'ng/µl': 'ng/µL',
  };
  return map[k];
}

function parseMolarUnit(prefix: string): MolarUnit {
  const p = normalizeMicro(prefix);
  if (p === 'm') return 'mM';
  if (p === 'µ') return 'µM';
  if (p === 'n') return 'nM';
  return 'M';
}

interface Measured<U> {
  value: number;
  unit: U;
  raw: string;
}

function findVolumes(text: string): Measured<VolumeUnit>[] {
  const out: Measured<VolumeUnit>[] = [];
  for (const m of normalizeMicro(text).matchAll(/(\d+(?:[.,]\d+)?)\s*(µL|ul|mL|ml|L)\b/gi)) {
    const unit = parseVolumeUnit(m[2]);
    if (unit) out.push({ value: toNumber(m[1]), unit, raw: m[0] });
  }
  return out;
}

/** Molar concentrations: "10 mM", "100 µM", "1 M". "MgCl" is not matched because the M must end a word. */
function findMolar(text: string): Measured<MolarUnit>[] {
  const out: Measured<MolarUnit>[] = [];
  for (const m of normalizeMicro(text).matchAll(/(\d+(?:[.,]\d+)?)\s*([mun\u00b5]?M)\b/g)) {
    const prefix = m[2].slice(0, -1);
    out.push({ value: toNumber(m[1]), unit: parseMolarUnit(prefix), raw: m[0] });
  }
  return out;
}

function findMassConc(text: string): Measured<MassConcUnit>[] {
  const out: Measured<MassConcUnit>[] = [];
  for (const m of normalizeMicro(text).matchAll(/(\d+(?:[.,]\d+)?)\s*(mg\/mL|µg\/µL|µg\/mL|ng\/µL|ug\/ul|ug\/ml|ng\/ul|mg\/ml)/gi)) {
    const unit = parseMassConcUnit(m[2]);
    if (unit) out.push({ value: toNumber(m[1]), unit, raw: m[0] });
  }
  return out;
}

/** Fold stocks such as "10X". Uppercase X only, so "3 x 5 min" is not a fold. Laemmli "4X" is skipped. */
function findFolds(text: string): number[] {
  const normalized = normalizeMicro(text);
  const out: number[] = [];
  for (const m of normalized.matchAll(/(\d+(?:\.\d+)?)X\b/g)) {
    const after = normalized.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 30);
    if (/laemmli|sample\s+buffer|loading\s+buffer|\bLB\b/i.test(after)) continue;
    out.push(Number(m[1]));
  }
  return out;
}

function findPercents(text: string): number[] {
  const out: number[] = [];
  // Surfactant additives such as "0.1% Tween-20" are not solutions to prepare.
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*%(?!\s*(tween|triton|np-?40|igepal|nonidet))/gi)) {
    out.push(toNumber(m[1]));
  }
  return out;
}

function findRatios(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\b1\s*:\s*(\d{1,3}(?:,\d{3})+|\d+)\b/g)) {
    out.push(Number(m[1].replace(/,/g, '')));
  }
  return out;
}

function buildSentences(step: StepText): string[] {
  const reagentLines = step.reagents.map((r: Reagent) => [r.name, r.amount, r.unit].filter(Boolean).join(' '));
  const body = step.instructions.split(/(?<=[.!?;])\s+|\n+/);
  return [step.title, ...body, ...reagentLines].map((s) => s.trim()).filter(Boolean);
}

// ---------- Detectors (one sentence each unless noted) ----------

function detectFoldDilution(sentence: string): DetectedCalc | undefined {
  if (!/\b(prepare|make|dilut\w*|from|stock)\b/i.test(sentence)) return undefined;
  const folds = findFolds(sentence);
  const volume = findVolumes(sentence)[0];
  if (folds.length === 0 || !volume) return undefined;

  const distinct = [...new Set(folds)];
  let stock: number;
  let target: number;
  if (distinct.length >= 2) {
    stock = Math.max(...distinct);
    target = Math.min(...distinct);
  } else if (distinct[0] > 1 && /\b(from|stock|dilut\w*)\b/i.test(sentence)) {
    stock = distinct[0];
    target = 1;
  } else {
    return undefined;
  }
  return {
    kind: 'dilution',
    reason: `Prepare ${volume.raw} of ${target}X from ${stock}X stock`,
    prefill: { c1: stock, c1Unit: 'X', c2: target, c2Unit: 'X', v2: volume.value, v2Unit: volume.unit },
  };
}

function detectMolarDilution(sentence: string): DetectedCalc | undefined {
  if (!/\b(dilut\w*|stock)\b/i.test(sentence)) return undefined;
  const molar = findMolar(sentence);
  const volume = findVolumes(sentence)[0];
  if (molar.length < 2 || !volume) return undefined;

  const byStrength = [...molar].sort((a, b) => convertUnit(b.value, b.unit, 'M') - convertUnit(a.value, a.unit, 'M'));
  const stock = byStrength[0];
  const target = byStrength[byStrength.length - 1];
  return {
    kind: 'dilution',
    reason: `Dilute ${stock.raw} stock to ${target.raw} in ${volume.raw}`,
    prefill: { c1: stock.value, c1Unit: stock.unit, c2: target.value, c2Unit: target.unit, v2: volume.value, v2Unit: volume.unit },
  };
}

function detectAntibody(sentence: string): DetectedCalc | undefined {
  if (!/antibod|\banti[-\s]|\bprimary\b|\bsecondary\b|\bab\b/i.test(sentence)) return undefined;
  const ratio = findRatios(sentence)[0];
  if (ratio === undefined) return undefined;

  const label = /secondary/i.test(sentence)
    ? 'Secondary antibody volume'
    : /primary/i.test(sentence)
      ? 'Primary antibody volume'
      : 'Antibody volume';
  // Prefer the volume after "in" ("1:1000 in 10 mL"), then any volume in the sentence.
  const inVolume = findVolumes(sentence.match(/\bin\s+\S+\s*\S*/i)?.[0] ?? '')[0];
  const anyVolume = findVolumes(sentence)[0];
  const volume = inVolume ?? anyVolume;
  const final = volume ? { value: volume.value, unit: volume.unit } : DEFAULT_ANTIBODY_VOLUME;
  return {
    kind: 'antibody',
    reason: `1:${ratio} in ${final.value} ${final.unit}${volume ? '' : ' (default final volume)'}`,
    prefill: { label, ratio, finalVolume: final.value, volumeUnit: final.unit },
  };
}

function detectPercent(sentence: string): DetectedCalc | undefined {
  if (!/\b(make|prepare|dissolve)\b/i.test(sentence)) return undefined;
  const percent = findPercents(sentence)[0];
  if (percent === undefined) return undefined;
  const basis = /v\/v/i.test(sentence) ? 'v/v' : 'w/v';
  const volume = findVolumes(sentence)[0];
  const final = volume ? { value: volume.value, unit: volume.unit } : DEFAULT_PERCENT_VOLUME;
  return {
    kind: 'percent',
    reason: `${percent}% ${basis} in ${final.value} ${final.unit}${volume ? '' : ' (default volume)'}`,
    prefill: { percent, basis, finalVolume: final.value, volumeUnit: final.unit },
  };
}

function detectMolarity(sentence: string, fullText: string): DetectedCalc | undefined {
  if (!/\bdissolve\b/i.test(sentence) || /\bdilut\w*/i.test(sentence)) return undefined;
  const molar = findMolar(sentence)[0];
  if (!molar) return undefined;
  const volume = findVolumes(sentence)[0];
  const mwMatch = fullText.match(/(\d+(?:[.,]\d+)?)\s*g\/mol/i) ?? fullText.match(/\bMW\b\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
  const final = volume ? { value: volume.value, unit: volume.unit } : DEFAULT_MOLARITY_VOLUME;
  return {
    kind: 'molarity',
    reason: `Dissolve ${molar.raw} in ${final.value} ${final.unit}${volume ? '' : ' (default volume)'}`,
    prefill: {
      molarity: molar.value,
      molarityUnit: molar.unit,
      volume: final.value,
      volumeUnit: final.unit,
      mw: mwMatch ? toNumber(mwMatch[1]) : undefined,
      massUnit: 'mg',
    },
  };
}

function detectProtein(sentence: string, fullText: string): DetectedCalc | undefined {
  if (!/\b(load|loading|lysate|protein|sample)\b/i.test(sentence)) return undefined;
  const mass = normalizeMicro(sentence).match(/(\d+(?:[.,]\d+)?)\s*(µg|ug)(?![/\w])/i);
  if (!mass) return undefined;
  const targetUg = toNumber(mass[1]);
  const concentration = findMassConc(fullText)[0];
  const volume = findVolumes(sentence)[0];
  const finalVolume = volume ? convertUnit(volume.value, volume.unit, 'µL') : DEFAULT_PROTEIN_FINAL_VOLUME;
  return {
    kind: 'protein',
    reason: `Load ${targetUg} µg protein${volume ? '' : ` in ${DEFAULT_PROTEIN_FINAL_VOLUME} µL (default)`}`,
    prefill: {
      concentration: concentration?.value,
      concentrationUnit: concentration?.unit ?? 'µg/µL',
      targetUg,
      finalVolume,
    },
  };
}

function detectSerial(fullText: string): DetectedCalc | undefined {
  if (!/serial(?:ly)?\s+dilut/i.test(fullText)) return undefined;
  const ratio = findRatios(fullText)[0];
  const fold = fullText.match(/(\d+(?:\.\d+)?)\s*-?\s*fold/i);
  const factor = ratio ?? (fold ? Number(fold[1]) : 10);
  const steps = fullText.match(/(\d+)\s*(?:steps?|dilutions?|tubes?)\b/i);
  const transfer = fullText.match(/transfer\s+(\d+(?:[.,]\d+)?)\s*(µL|µl|ul|mL|ml|L)\b/i);
  const transferUnit = transfer ? parseVolumeUnit(transfer[2]) : undefined;
  const start = findMolar(fullText)[0] ?? findMassConc(fullText)[0];
  const unit: ConcUnit = start ? start.unit : 'M';
  return {
    kind: 'serial',
    reason: `${factor}-fold serial dilution`,
    prefill: {
      startConcentration: start?.value,
      unit,
      factor,
      steps: steps ? Number(steps[1]) : 5,
      transferVolume: transfer ? toNumber(transfer[1]) : 100,
      volumeUnit: transferUnit ?? 'µL',
    },
  };
}

function detectMasterMix(step: StepText, fullText: string): DetectedCalc | undefined {
  if (!/master\s*mix/i.test(fullText)) return undefined;
  const count = fullText.match(/(\d+)\s*(?:x\s*)?(?:reactions?|rxns?|samples?|wells?|tubes?|reps?)\b/i);
  const reactions = count ? Number(count[1]) : DEFAULT_MASTER_MIX_REACTIONS;
  const components: MasterMixComponent[] = [];
  for (const reagent of step.reagents) {
    const volume = findVolumes([reagent.amount ?? '', reagent.unit ?? ''].join(' '))[0];
    if (volume && reagent.name.trim()) {
      components.push({ name: reagent.name.trim(), perReaction: volume.value, unit: volume.unit });
    }
  }
  return {
    kind: 'masterMix',
    reason: count ? `Master mix for ${reactions} reactions` : `Master mix, default ${DEFAULT_MASTER_MIX_REACTIONS} reactions`,
    prefill: { reactions, components },
  };
}

/** Returns the calculators this step needs, in the order they appear in the step. */
export function detectCalcs(step: StepText): DetectedCalc[] {
  const sentences = buildSentences(step);
  const fullText = sentences.join(' ');
  const found: DetectedCalc[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const detected =
      detectFoldDilution(sentence) ??
      detectMolarDilution(sentence) ??
      detectAntibody(sentence) ??
      detectPercent(sentence) ??
      detectMolarity(sentence, fullText) ??
      detectProtein(sentence, fullText);
    // The title usually repeats the first instruction sentence; keep one card per calculation.
    const key = detected && JSON.stringify([detected.kind, detected.prefill]);
    if (detected && key && !seen.has(key)) {
      seen.add(key);
      found.push(detected);
    }
  }

  const serial = detectSerial(fullText);
  if (serial) found.push(serial);
  const mix = detectMasterMix(step, fullText);
  if (mix) found.push(mix);

  return found;
}

/** Kinds offered in the manual "+ Calculator" menu, with their labels. */
export const CALC_LABELS: Record<CalcKind, string> = {
  dilution: 'C1V1 dilution',
  molarity: 'Molarity to mass',
  antibody: 'Antibody dilution 1:N',
  serial: 'Serial dilution',
  percent: '% solution',
  masterMix: 'Master mix',
  protein: 'Protein loading',
};
