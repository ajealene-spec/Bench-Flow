import type { StepVariable } from '../../types';

/*
 * Finds quantities in a step's text and the relationships between them, as StepVariables.
 * Literal quantities become inputs (tappable in the step). Relationships become derived
 * variables whose formulas refer to input ids:
 *   - dilution "1:1000 antibody in 10 mL": antibody volume = final volume / 1000
 *   - C1V1 "dilute 10 mM stock to 1 mM in 50 mL": V1 = final volume * C2 / C1
 *   - per-sample scaling "1.5 mL per sample" with N samples: total = amount * N
 * Pure: no database or DOM access.
 */

const MICRO = '(?:\\u00b5|\\u03bc|u)';
const NUM = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
const MICRO_SIGN = 'µ';

type Family = 'volume' | 'mass' | 'molar' | 'x' | 'percent' | 'dilution' | 'count';

interface Quantity {
  start: number;
  end: number;
  token: string;
  value: number;
  unit: string;
  family: Family;
}

/** Scale of each unit relative to its base (litres, grams, molar); 1 for dimensionless ratios. */
const BASE: Record<string, number> = {
  [`${MICRO_SIGN}L`]: 1e-6,
  mL: 1e-3,
  L: 1,
  [`${MICRO_SIGN}g`]: 1e-6,
  mg: 1e-3,
  g: 1,
  nM: 1e-9,
  [`${MICRO_SIGN}M`]: 1e-6,
  mM: 1e-3,
  M: 1,
  x: 1,
  '%': 1,
};

const CENTRIFUGE_CONTEXT = /centrifug|\bspin|\brcf\b|force\s*$|\bat\s*$/i;
const TIME_CONTEXT = /\b(?:at|for|after|until|by|before|within|during)\s*$/i;
const PER_SAMPLE = /\bper\s+(?:sample|well|tube|reaction|replicate|animal|plate|condition)s?\b|\beach\b/i;
const CONNECTIVE = /\b(?:in|into|to|final)\b/i;
const DILUTE_VERB = /\b(?:dilut\w*|to|from|C1V1)\b/i;
const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'and', 'in', 'to', 'into', 'with', 'dilute', 'dilution', 'prepare', 'add', 'make', 'mix', 'final']);

function canonicalUnit(raw: string): string {
  return raw.replace(/^(?:µ|μ|u)(?=[LgM])/, MICRO_SIGN);
}

function parseNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

function scan(
  text: string,
  re: RegExp,
  family: Family,
  unitOf: (m: RegExpExecArray) => string,
  valueOf: (m: RegExpExecArray) => number,
): Quantity[] {
  const found: Quantity[] = [];
  const pattern = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const start = m.index;
    const before = text.slice(Math.max(0, start - 40), start);
    if (family === 'mass' && CENTRIFUGE_CONTEXT.test(before)) continue;
    if (family === 'dilution' && TIME_CONTEXT.test(before)) continue;
    const value = valueOf(m);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (family === 'dilution' && value <= 1) continue;
    found.push({ start, end: start + m[0].length, token: m[0], value, unit: unitOf(m), family });
  }
  return found;
}

/** Every quantity in text order. Overlapping matches are dropped (the earlier one wins). */
function findQuantities(text: string): Quantity[] {
  const value = (m: RegExpExecArray) => parseNumber(m[1]);
  const all = [
    ...scan(text, new RegExp(`(?<![\\d.,])(${NUM})\\s*(${MICRO}L|mL|L)(?![A-Za-z])`, 'g'), 'volume', (m) => canonicalUnit(m[2]), value),
    ...scan(text, new RegExp(`(?<![\\d.,])(${NUM})\\s*(${MICRO}g|mg|g)(?![A-Za-z])`, 'g'), 'mass', (m) => canonicalUnit(m[2]), value),
    ...scan(text, new RegExp(`(?<![\\d.,])(${NUM})\\s*(${MICRO}M|mM|nM|M)(?![A-Za-z])`, 'g'), 'molar', (m) => canonicalUnit(m[2]), value),
    ...scan(text, new RegExp(`(?<![\\d.,])(${NUM})\\s*(?:x|\\u00d7)(?![A-Za-z\\d])(?!\\s*\\d)(?!\\s*g\\b)`, 'g'), 'x', () => 'x', value),
    ...scan(text, new RegExp(`(?<![\\d.,])(${NUM})\\s*%`, 'g'), 'percent', () => '%', value),
    ...scan(
      text,
      /(?<![\d.,:])1\s*:\s*(\d+(?:\.\d+)?)(?![\d:])(?!\s*(?:min|mins|minutes?|sec|secs|seconds?|s|h|hr|hrs|hours?|am|pm)\b)/gi,
      'dilution',
      () => '1:N',
      value,
    ),
    ...scan(text, /(?<![\d.,])(\d+)\s+(samples?|wells?|tubes?|reactions?|replicates?)\b/gi, 'count', () => 'samples', value),
  ].sort((a, b) => a.start - b.start);

  const kept: Quantity[] = [];
  for (const q of all) {
    const last = kept[kept.length - 1];
    if (last && q.start < last.end) continue;
    kept.push(q);
  }
  return kept;
}

/** Sentence ranges as [start, end) offsets. Breaks after . ; ! ? followed by a space or the end, and at new lines. */
function sentenceRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const breaks = /[.;!?]+(?=\s|$)|\n/g;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = breaks.exec(text)) !== null) {
    ranges.push([start, m.index]);
    start = m.index + m[0].length;
  }
  ranges.push([start, text.length]);
  return ranges;
}

function nameWords(raw: string): string[] {
  return raw
    .replace(/[,:;]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase().replace(/[()]/g, '')));
}

/** Reagent name for a dilution: the words between it and "in", else the words before it. */
function dilutionName(sentence: string, dilStart: number, dilEnd: number, connectiveStart: number): string {
  const after = nameWords(sentence.slice(dilEnd, connectiveStart)).slice(0, 2);
  if (after.length > 0) return after.join(' ');
  const before = nameWords(sentence.slice(0, dilStart)).slice(-2);
  return before.length > 0 ? before.join(' ') : 'diluted sample';
}

/** The derived volume unit for a final volume: µL for µL and mL, mL for L. */
function derivedVolumeUnit(finalUnit: string): string {
  return finalUnit === 'L' ? 'mL' : 'µL';
}

/** Converts a value in `from` units into `to` units, for volumes or concentrations. */
function factor(from: string, to: string): number {
  return Number((BASE[from] / BASE[to]).toPrecision(12));
}

/** Magnitude in base units, so concentrations of different units compare correctly. */
function magnitude(q: Quantity): number {
  return q.value * BASE[q.unit];
}

function uniqueName(name: string, used: Set<string>): string {
  let candidate = name;
  let n = 2;
  while (used.has(candidate)) candidate = `${name} ${n++}`;
  used.add(candidate);
  return candidate;
}

export function detectVariables(stepText: string): StepVariable[] {
  const text = stepText ?? '';
  if (!text.trim()) return [];

  const hasPerSample = PER_SAMPLE.test(text);
  // A bare "12 tubes" is only a sample count when the step scales something per sample.
  const quantities = findQuantities(text).filter((q) => q.family !== 'count' || hasPerSample);
  if (quantities.length === 0) return [];

  const idOf = new Map<Quantity, string>(quantities.map((q, i) => [q, `q${i + 1}`]));
  const inputs: StepVariable[] = quantities.map((q) => ({
    id: idOf.get(q) as string,
    token: q.token,
    value: q.value,
    unit: q.unit,
    role: 'input',
  }));
  const extraInputs: StepVariable[] = [];
  const derived: StepVariable[] = [];
  const usedNames = new Set<string>();
  const addDerived = (token: string, unit: string, formula: string) => {
    derived.push({ id: `d${derived.length + 1}`, token: uniqueName(token, usedNames), value: 0, unit, role: 'derived', formula });
  };

  for (const [from, to] of sentenceRanges(text)) {
    const sentence = text.slice(from, to);
    const inSentence = quantities.filter((q) => q.start >= from && q.end <= to);
    if (inSentence.length === 0) continue;

    // Dilution: 1:N of a reagent, made up in a final volume.
    for (const dil of inSentence.filter((q) => q.family === 'dilution')) {
      const finalVol = inSentence.find((q) => q.family === 'volume' && q.start >= dil.end);
      if (!finalVol) continue;
      const gap = text.slice(dil.end, finalVol.start);
      const connective = CONNECTIVE.exec(gap);
      if (!connective || /\d/.test(gap)) continue;
      const name = dilutionName(sentence, dil.start - from, dil.end - from, dil.end - from + connective.index);
      const unit = derivedVolumeUnit(finalVol.unit);
      addDerived(`${name} volume`, unit, `${idOf.get(finalVol)} * ${factor(finalVol.unit, unit)} / ${idOf.get(dil)}`);
    }

    // C1V1: two concentrations of one kind, then a final volume. The more concentrated one is the stock.
    const concs = inSentence.filter((q) => q.family === 'molar' || q.family === 'x' || q.family === 'percent');
    if (concs.length >= 2 && DILUTE_VERB.test(sentence)) {
      const [a, b] = concs;
      const finalVol = inSentence.find((q) => q.family === 'volume' && q.start >= b.end);
      const sameKind = a.family === b.family;
      if (sameKind && finalVol && !/\d/.test(text.slice(b.end, finalVol.start))) {
        const stock = magnitude(a) >= magnitude(b) ? a : b;
        const target = stock === a ? b : a;
        const unit = derivedVolumeUnit(finalVol.unit);
        const k = Number(((BASE[target.unit] / BASE[stock.unit]) * factor(finalVol.unit, unit)).toPrecision(12));
        const scale = k === 1 ? '' : ` * ${k}`;
        addDerived('V1', unit, `${idOf.get(finalVol)} * ${idOf.get(target)} / ${idOf.get(stock)}${scale}`);
      }
    }

    // Per-sample scaling: an amount per sample, times the sample count.
    if (PER_SAMPLE.test(sentence)) {
      const amounts = inSentence.filter((q) => q.family === 'volume' || q.family === 'mass' || q.family === 'molar');
      if (amounts.length > 0) {
        const count = inSentence.find((q) => q.family === 'count');
        let nId = count ? idOf.get(count) : undefined;
        if (!nId) {
          nId = `n${extraInputs.length + 1}`;
          extraInputs.push({ id: nId, token: 'N', value: 1, unit: 'samples', role: 'input' });
        }
        for (const amount of amounts) {
          const suffix = amounts.length > 1 ? ` (${amount.token})` : '';
          addDerived(`total for N${suffix}`, amount.unit, `${idOf.get(amount)} * ${nId}`);
        }
      }
    }
  }

  return [...inputs, ...extraInputs, ...derived];
}
