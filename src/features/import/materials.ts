import type { MaterialItem, MaterialKind } from '../../types';
import { detectMaterials } from './localParse';

/**
 * Materials for a protocol: lines from a Materials/Reagents/Equipment section, reagents named in
 * steps (by known name, by "5 µM X" concentration, and by capitalised names such as Matrigel or FIJI),
 * and the equipment and solution phrases that localParse already knows. Shared by both readers.
 */

export type MaterialCandidate = { name: string; kind: MaterialKind; quantity?: string };

const MAX_MATERIALS = 60;

/** Reagents the lab uses often. Matched case-insensitively as whole words. */
const KNOWN_REAGENTS: Array<[RegExp, string]> = [
  [/(?<![\w-])Matrigel(?![\w-])/i, 'Matrigel'],
  [/(?<![\w-])laminin(?![\w-])/i, 'Laminin'],
  [/(?<![\w-])poly-?D-?lysine(?![\w-])/i, 'Poly-D-lysine'],
  [/(?<![\w-])Fluo-?4(?:\s*AM)?(?![\w-])/i, 'Fluo-4 AM'],
  [/(?<![\w-])glutamate(?![\w-])/i, 'Glutamate'],
  [/(?<![\w-])Tris-?HCl(?![\w-])/i, 'Tris-HCl'],
  [/(?<![\w-])HEPES(?![\w-])/i, 'HEPES'],
  [/(?<![\w-])PBS(?![\w-])/i, 'PBS'],
  [/(?<![\w-])TBST(?![\w-])/i, 'TBST'],
  [/(?<![\w-])TBS(?![\w-])/i, 'TBS'],
  [/(?<![\w-])EDTA(?![\w-])/i, 'EDTA'],
  [/(?<![\w-])Triton\s*X-?100(?![\w-])/i, 'Triton X-100'],
  [/(?<![\w-])Tween-?20(?![\w-])/i, 'Tween-20'],
  [/(?<![\w-])SDS(?![\w-])/, 'SDS'],
  [/(?<![\w-])DTT(?![\w-])/, 'DTT'],
  [/(?<![\w-])BSA(?![\w-])/, 'BSA'],
  [/(?<![\w-])DMSO(?![\w-])/, 'DMSO'],
  [/(?<![\w-])glycerol(?![\w-])/i, 'Glycerol'],
  [/(?<![\w-])methanol(?![\w-])/i, 'Methanol'],
  [/(?<![\w-])ethanol(?![\w-])/i, 'Ethanol'],
  [/(?<![\w-])isopropanol(?![\w-])/i, 'Isopropanol'],
  [/(?<![\w-])paraformaldehyde(?![\w-])|(?<![\w-])PFA(?![\w-])/i, 'Paraformaldehyde (PFA)'],
  [/(?<![\w-])trypsin(?![\w-])/i, 'Trypsin'],
  [/(?<![\w-])DAPI(?![\w-])/, 'DAPI'],
  [/(?<![\w-])Hoechst(?![\w-])/i, 'Hoechst'],
  [/(?<![\w-])FBS(?![\w-])|fetal bovine serum/i, 'Fetal bovine serum'],
  [/(?<![\w-])DMEM(?![\w-])/, 'DMEM'],
  [/(?<![\w-])Neurobasal(?![\w-])/i, 'Neurobasal'],
  [/(?<![\w-])B-?27(?![\w-])/, 'B-27 supplement'],
  [/(?<![\w-])TEMED(?![\w-])/, 'TEMED'],
  [/(?<![\w-])APS(?![\w-])|ammonium persulfate/i, 'Ammonium persulfate'],
  [/(?<![\w-])Ponceau(?:\s*S)?(?![\w-])/i, 'Ponceau S'],
  [/(?<![\w-])NaCl(?![\w-])/, 'NaCl'],
  [/(?<![\w-])KCl(?![\w-])/, 'KCl'],
  [/(?<![\w-])sucrose(?![\w-])/i, 'Sucrose'],
  [/(?<![\w-])glucose(?![\w-])/i, 'Glucose'],
  [/(?<![\w-])glycine(?![\w-])/i, 'Glycine'],
  [/(?<![\w-])acrylamide(?![\w-])/i, 'Acrylamide'],
  [/normal goat serum/i, 'Normal goat serum'],
  [/normal donkey serum/i, 'Normal donkey serum'],
  [/normal horse serum/i, 'Normal horse serum'],
  [/(?:β|\bbeta)[\s-]?mercaptoethanol|\b2-?mercaptoethanol\b/i, 'β-mercaptoethanol'],
  [/(?<![\w-])isoflurane(?![\w-])/i, 'Isoflurane'],
  [/(?<![\w-])ketamine(?![\w-])/i, 'Ketamine'],
  [/(?<![\w-])xylazine(?![\w-])/i, 'Xylazine'],
  [/(?<![\w-])TRIzol(?![\w-])/i, 'TRIzol'],
  [/SYBR\s*Green/i, 'SYBR Green master mix'],
  [/nuclease-free water/i, 'Nuclease-free water'],
  [/(?<![\w-])chloroform(?![\w-])/i, 'Chloroform'],
  [/(?<![\w-])cDNA(?![\w-])/i, 'cDNA'],
  [/(?<![\w-])primers?(?![\w-])/i, 'Primers'],
  [/\bRT kit\b|reverse transcription kit/i, 'Reverse transcription kit'],
  [/optical film/i, 'Optical film'],
];

/** Capitalised words that are not reagents when they appear mid-sentence. */
const CAPITAL_BAN = new Set([
  'Day', 'Step', 'Figure', 'Table', 'Note', 'Caution', 'Warning', 'Procedure', 'Materials', 'Reagents',
  'Equipment', 'Phase', 'Overnight', 'Min', 'Hour', 'Hours', 'Minutes', 'Sample', 'Samples', 'Control',
  'Controls', 'Cells', 'Cell', 'Mice', 'Mouse', 'Rat', 'Rats', 'Animal', 'Animals', 'Then', 'Next',
  'The', 'This', 'Each', 'Use', 'Add', 'Wash', 'Incubate', 'Image', 'Imaging', 'Load', 'Plate', 'Set',
  'Before', 'After', 'When', 'Once', 'Repeat', 'Remove', 'Transfer', 'Store', 'Keep', 'ROIs', 'ROI',
]);

const STOP_WORD = /^(?:in|for|at|per|and|or|with|to|of|on|then|into|from|by|the|a|an|over|using|until|while|overnight)$/i;
/** Verbs and small words that end a material name in running text ("5 mL PBS Add 1 ..."). */
const VERB_STOP = /^(?:add|put|check|spin|seed|wash|incubate|transfer|image|load|mix|resuspend|neutralize|warm|aspirate|pipette|count|then|so|do|not|let|keep|use|make|prepare|block|apply|rock|thaw|dilute)$/i;
/** Words that cannot start a material name after a concentration ("each primer", "15 µL reaction"). */
const GENERIC_FIRST = /^(?:each|per|well|wells|reaction|reactions|total|final|volume|tube|tubes|sample|samples|cell|cells|min|minutes?|hours?|h|times?|steps?|days?|mice|animals?|slices?|sections?|dishes?|plates?|aliquots?|pellet|supernatant|rpm|g|confluen\w*|it|them|this|that)$/i;
/** A name that is only a generic word or a single short token is not a material. */
function isGenericName(name: string): boolean {
  return GENERIC_FIRST.test(name) || name.length < 2;
}

/** Equipment words, and the kind a section heading gives to a line when the word itself says nothing. */
const EQUIPMENT_WORD =
  /\b(?:microscope|imager|centrifuge|incubator|scanner|pipett\w*|plate reader|thermocycler|balance|scale|water bath|heat block|power supply|tank|chamber|apparatus|system|cassette|FIJI|ImageJ|software|camera|vortex\w*|shaker|rocker|ph meter|spectrophotometer|nanodrop|microtome|cryostat|amplifier|electrode\w*|rig|oven|hood|pump|scissors|forceps|tweezers|tubes? roller)\b/i;
const CONSUMABLE_WORD =
  /\b(?:tips?|tubes?|plates?|membranes?|gloves?|coverslips?|flasks?|filters?|filter paper|sponges?|parafilm|dishes|slides?|vials?|syringes?|needles?|well plates?|petri dish\w*|cryovials?|microplates?|cell strainers?|film|paper)\b/i;
const SOLUTION_WORD = /\b(?:buffer|solution|medium|media|mix|PBS|TBS|TBST|saline|water|serum)\b/i;

export function classifyMaterial(name: string, sectionKind?: MaterialKind): MaterialKind {
  if (EQUIPMENT_WORD.test(name)) return 'equipment';
  if (CONSUMABLE_WORD.test(name)) return 'consumable';
  if (SOLUTION_WORD.test(name)) return 'solution';
  return sectionKind ?? 'reagent';
}

const QUANTITY_RE =
  /\b\d+(?:[.,]\d+)?\s*(?:µM|μM|uM|nM|mM|M|%|mg\/mL|µg\/mL|μg\/mL|ng\/µL|ng\/μL|µL|μL|uL|mL|L|mg|µg|ng|U\/mL|x|×)(?![A-Za-z])|\b1:\d+\b/;

/** One material per line of a Materials/Reagents/Equipment section. Vendor and catalog text is dropped. */
export function materialsFromSectionLines(lines: string[], sectionKind?: MaterialKind): MaterialCandidate[] {
  const out: MaterialCandidate[] = [];
  for (const raw of lines) {
    const line = raw
      .replace(/^\s*(?:[-*•–·]|\d{1,2}[.)]|[a-z][.)])\s+/i, '')
      .replace(/\((?:cat\w*|catalog|lot|#)[^)]*\)/gi, '')
      .replace(/,?\s*(?:cat\.?|catalog)\s*(?:no\.?|#)?\s*[\w-]+/gi, '')
      .trim();
    if (!line || line.length > 200) continue;
    if (/[.!?]$/.test(line) && line.split(/\s+/).length > 12) continue;

    const parts = line.includes(';') || (line.split(',').length >= 3 && !QUANTITY_RE.test(line))
      ? line.split(/[;,]/)
      : [line];

    for (const part of parts) {
      const cleaned = part.trim();
      if (!cleaned) continue;
      const quantityMatch = QUANTITY_RE.exec(cleaned);
      const quantity = quantityMatch ? quantityMatch[0].replace(/\s+/g, ' ') : undefined;
      let name = cleaned
        .split(/\s+[-–—]\s+|\s+\(|\s+with\s|,\s*(?=\d)|:\s|\s*:\s*$/)[0]
        .replace(QUANTITY_RE, '')
        .replace(/[,:;\s]+$/g, '')
        .trim();
      if (name.length < 2 || name.length > 80 || /^(?:for|note|optional|required|each|total)$/i.test(name)) continue;
      out.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        kind: classifyMaterial(name, sectionKind),
        ...(quantity ? { quantity } : {}),
      });
    }
  }
  return out;
}

/** Reagents and equipment named in the text itself (steps or anywhere else). */
export function materialsFromText(text: string): MaterialCandidate[] {
  const out: MaterialCandidate[] = [];

  for (const [re, name] of KNOWN_REAGENTS) {
    if (re.test(text)) out.push({ name, kind: classifyMaterial(name, 'reagent') });
  }

  for (const m of text.matchAll(
    /\b(\d+(?:[.,]\d+)?)[ \t]*(µM|μM|uM|nM|mM|M|%|mg\/mL|µg\/mL|μg\/mL|ng\/µL|ng\/μL|µL|μL|uL|mL|U\/mL|x)[ \t]+([A-Za-zα-ωΑ-Ω][^\n]*)/g,
  )) {
    const words: string[] = [];
    for (const w of m[3].split(/[ \t]+/)) {
      if (STOP_WORD.test(w) || VERB_STOP.test(w.replace(/[,.;:)]+$/, ''))) break;
      if (!/^[A-Za-zα-ωΑ-Ω0-9(]/.test(w)) break;
      const ends = /[,.;:)]$/.test(w);
      words.push(w.replace(/[,.;:)]+$/, ''));
      if (ends || words.length === 3) break;
    }
    const name = words.join(' ').replace(/[,.;:(]+$/, '');
    if (isGenericName(name)) continue;
    out.push({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      kind: classifyMaterial(name, 'reagent'),
      quantity: `${m[1]} ${m[2]}`,
    });
  }

  // Runs of capitalised words that are not the first word of a sentence: "Alexa Fluor 488", "Fluo-4 AM", "FIJI".
  for (const sentence of text.split(/(?<=[.!?])[ \t]+|\n+/)) {
    const words = sentence.trim().split(/[ \t]+/);
    let run: string[] = [];
    const flush = () => {
      const name = run.join(' ');
      run = [];
      if (name.length >= 2 && (name.length >= 3 || /\d/.test(name))) {
        out.push({ name, kind: classifyMaterial(name, 'reagent') });
      }
    };
    words.forEach((raw, i) => {
      const w = raw.replace(/[,.;:()]+$/g, '');
      const isCap = i > 0 && /^[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*$/.test(w) && !CAPITAL_BAN.has(w) && !/^T\d+$/.test(w);
      const isNumber = run.length > 0 && /^\d{2,4}$/.test(w);
      if (isCap || isNumber) run.push(w);
      else flush();
      if (/[,;:)]$/.test(raw) && run.length > 0) flush();
    });
    flush();
  }

  for (const [re, kind, name] of [[/\bT\d{2,3} flasks?\b/gi, 'consumable', 'Culture flask'] as const]) {
    if (re.test(text)) out.push({ name, kind });
  }

  for (const found of detectMaterials(text)) {
    if (found.kind === 'solution' && !isPlausibleSolution(found.name)) continue;
    out.push({ name: found.name, kind: found.kind });
  }
  return out;
}

/** localParse finds "... buffer" phrases loosely; drop ones that carry a number or a verb ("15 mL medium", "Aspirate medium"). */
function isPlausibleSolution(name: string): boolean {
  const words = name.split(/\s+/);
  if (words.length > 3 || /\d/.test(name)) return false;
  return !words.some((w) => /^(?:ml|ul|µl|μl|-)$/i.test(w) || VERB_STOP.test(w));
}

const normalizeKey = (name: string): string => name.toLowerCase().replace(/[^a-z0-9α-ω]/g, '');

/**
 * Merges candidates into materials. Duplicates are matched case-insensitively. When one name is a
 * prefix of another ("Fluo-4" and "Fluo-4 AM") the longer name is kept. Earlier entries win on kind
 * and quantity unless they are missing.
 */
export function mergeMaterials(...lists: MaterialCandidate[][]): MaterialItem[] {
  const all: Array<MaterialCandidate & { key: string }> = [];
  for (const list of lists) {
    for (const item of list) {
      const key = normalizeKey(item.name);
      if (!key) continue;
      const same = all.find((m) => m.key === key || m.key.startsWith(key) || key.startsWith(m.key));
      if (same) {
        if (key.length > same.key.length) {
          same.name = item.name;
          same.key = key;
        }
        same.quantity ??= item.quantity;
        continue;
      }
      if (all.length >= MAX_MATERIALS) continue;
      all.push({ ...item, key });
    }
  }
  // A name contained in a longer name is the same material ("Water" in "Nuclease-free water").
  const merged = all.filter(
    (m, i) => !all.some((o, j) => j !== i && m.key.length >= 3 && o.key.length > m.key.length && o.key.includes(m.key)),
  );
  return merged.map(({ key: _key, ...m }) => ({
    id: crypto.randomUUID(),
    name: m.name,
    kind: m.kind,
    ...(m.quantity ? { quantity: m.quantity } : {}),
  }));
}

/** Reagents and equipment from the whole text, for the offline reader and as a backstop for the AI reader. */
export function materialsForText(text: string): MaterialCandidate[] {
  return materialsFromText(text);
}
