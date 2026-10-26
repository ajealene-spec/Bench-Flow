import type { MaterialItem, MaterialKind, ProtocolPhase, Step, Timer } from '../../types';

/**
 * Deterministic, offline procedure parser. Used when the AI parser is unavailable.
 *
 * - If the text has a procedure heading ("Procedure", "Protocol", "Method", "Steps", ...), only the
 *   lines after it are parsed, until an end heading (Introduction, Reagents, Troubleshooting, References...).
 * - Sub-headings such as "Sample preparation" or "Transfer" become a prefix on the step titles.
 * - Continuation lines are folded into the step above; list items start new steps.
 * - Durations ("10 min", "1 h", "30 s", "overnight") become timers.
 */

export interface LocalParseResult {
  title?: string;
  steps: Step[];
  /** "Day N" / "Phase N" blocks found in the text. Missing when there are none. */
  phases?: ProtocolPhase[];
  /** Reagents, solutions and equipment mentioned in the text. Missing when none were found. */
  materials?: MaterialItem[];
}

export interface DetectedDuration {
  seconds: number;
  label: string;
}

export const TITLE_MAX = 60;

// "1. x", "2) x", "Step 3: x", "Step 3 x", "(4) x", "- x", "* x", "• x", "– x". The marker must be followed by
// a space, so "1.5 mL" is not a list item.
const ITEM_RE = /^\s*(?:step\s+\d{1,3}\s*[:.)]\s*|step\s+\d{1,3}\s+|\d{1,3}\s*[.)]\s+|\(\d{1,3}\)\s+|[-*•–]\s+)(.+?)\s*$/i;
const ITEM_MARKER_RE = /^(?:step\s+\d{1,3}\s*[:.)]?\s*|\d{1,3}\s*[.)]\s+|[a-z][.)]\s+|\(\d{1,3}\)\s+)/i;
const NUMBERED_RE = /^\s*(?:step\s+)?\d{1,3}\s*[.):]\s/i;
const INDENT_RE = /^(?:\s{2,}|\t)/;

const PROCEDURE_HEADING_RE =
  /^(?:[A-Z]\.\s+|\d+\.\s+)?(?:[A-Za-z-]+\s+){0,3}(?:procedure|protocol|method|methods|steps|step-by-step|instructions|workflow)\s*:?$/i;

const END_HEADING_RE =
  /^(?:[A-Z]\.\s+|\d+\.\s+)?(?:introduction|background|overview|materials(?:\s+and\s+equipment)?|equipment|reagents?(?:\s+(?:and|preparation|list)\b[\w\s,&-]{0,30})?|buffers?(?:\s+(?:and|recipes?|preparation)\b[\w\s,&-]{0,30})?|buffer recipes?|recipes?|solutions?|stock solutions?|troubleshooting|references?|bibliography|ordering information|ordering|product information|related products|appendix|about this (?:guide|protocol)|faq)\s*:?$/i;

const KNOWN_GROUP_RE =
  /^(?:sample (?:preparation|prep)|cell (?:lysis|culture)|lysis|protein (?:quantification|extraction|determination)|quantification|sds[- ]?page|gel (?:electrophoresis|preparation|loading)|electrophoresis|(?:wet |semi-dry |dry )?(?:protein )?(?:transfer|blotting)|membrane (?:blocking|preparation)|blocking|antibody (?:incubation|incubations?)|primary antibody(?: incubation)?|secondary antibody(?: incubation)?|washes|washing|wash(?: steps?)?|detection|imaging|stripping|reprobing)\s*:?$/i;

const CAUTION_LABEL_RE = /^(?:caution|warning|danger|note|important|critical|attention|safety|hazard)\b\s*[:!-]?\s*/i;

const CAUTION_RE =
  /\b(caution|warning|danger|hazard\w*|toxic|carcinogen\w*|corrosive|flammable|wear\s+(?:gloves|goggles|a\s+lab\s+coat|ppe)|handle with care|do not|don't|never)\b/i;

const DURATION_RE =
  /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|—|to)\s*(\d+(?:[.,]\d+)?))?\s*(hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|sec|s)(?![A-Za-z])/gi;
const OVERNIGHT_RE = /\b(overnight|o\/n)\b/gi;
// Words that may sit between two duration tokens so they count as one duration ("1 h 30 min").
const GAP_RE = /^\s*(?:and|plus|\+)?\s*$/i;

const UNIT_SECONDS: Record<string, number> = {
  h: 3600,
  hr: 3600,
  hrs: 3600,
  hour: 3600,
  hours: 3600,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  s: 1,
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
};

const OVERNIGHT_SECONDS = 16 * 3600;

function parseNumber(raw: string): number {
  return parseFloat(raw.replace(',', '.'));
}

/**
 * Finds durations in free text. Adjacent duration tokens ("1 h 30 min") are summed into one.
 * Ranges ("10-15 min") use the upper bound so a timer never ends before the protocol allows.
 */
export function detectDurations(text: string): DetectedDuration[] {
  type Match = { start: number; end: number; seconds: number };
  const matches: Match[] = [];

  for (const m of text.matchAll(DURATION_RE)) {
    const start = m.index ?? 0;
    const value = parseNumber(m[2] ?? m[1]);
    const unit = UNIT_SECONDS[m[3].toLowerCase()];
    if (!Number.isFinite(value) || unit === undefined) continue;
    matches.push({ start, end: start + m[0].length, seconds: Math.round(value * unit) });
  }

  for (const m of text.matchAll(OVERNIGHT_RE)) {
    const start = m.index ?? 0;
    matches.push({ start, end: start + m[0].length, seconds: OVERNIGHT_SECONDS });
  }

  matches.sort((a, b) => a.start - b.start);

  const groups: Match[] = [];
  for (const m of matches) {
    const last = groups[groups.length - 1];
    if (last && GAP_RE.test(text.slice(last.end, m.start))) {
      last.end = m.end;
      last.seconds += m.seconds;
    } else {
      groups.push({ ...m });
    }
  }

  return groups.map((g) => ({
    seconds: g.seconds,
    label: text.slice(g.start, g.end).replace(/\s+/g, ' ').trim(),
  }));
}

function detectCautions(text: string): string[] {
  return text
    .split(/(?<=[.;!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s && (CAUTION_LABEL_RE.test(s) || CAUTION_RE.test(s)));
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Cuts text to at most `max` characters at a word boundary, adding an ellipsis when it is cut. */
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:]+$/, '')}…`;
}

/**
 * Title from one sentence: the text before a colon or semicolon when that is short, else the whole
 * sentence, cut at a word boundary.
 */
function firstClause(sentence: string, max: number): string {
  let s = sentence.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
  const colon = s.search(/:\s/);
  if (colon > 0 && colon <= max) s = s.slice(0, colon);
  const semi = s.split(/\s*;\s*|\s+[–—]\s+/)[0];
  if (semi.length >= 12 && semi.length < s.length) s = semi;
  return capitalize(cutAtWord(s, max));
}

/**
 * Short step title. Caution, Note and similar labels are skipped, so a step never gets titled
 * "Caution". The title is the first real clause of the step, prefixed by its section heading if any.
 */
export function deriveTitle(text: string, group?: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const main = sentences.find((s) => !CAUTION_LABEL_RE.test(s)) ?? sentences[0] ?? text.trim();
  const stripped = main.replace(CAUTION_LABEL_RE, '');

  if (!group) return firstClause(stripped, TITLE_MAX);
  const budget = Math.max(20, TITLE_MAX - group.length - 2);
  return `${group}: ${firstClause(stripped, budget)}`;
}

/** Cleans a title that came from elsewhere (for example the AI parser): strips caution labels and clamps length. */
export function cleanStepTitle(title: string): string {
  const stripped = title.trim().replace(CAUTION_LABEL_RE, '').trim();
  return capitalize(cutAtWord(stripped || title.trim(), TITLE_MAX));
}

function toGroupName(line: string): string {
  const name = line.replace(/:\s*$/, '').trim();
  // "SAMPLE PREPARATION" becomes "Sample preparation"; acronyms such as "SDS-PAGE" keep their case.
  const lower = name === name.toUpperCase() && name.includes(' ') ? name.toLowerCase() : name;
  return capitalize(lower).slice(0, 40);
}

function isProcedureHeading(line: string): boolean {
  return line.length <= 50 && PROCEDURE_HEADING_RE.test(line);
}

function isGenericGroupHeading(line: string, next: string): boolean {
  if (line.length > 50 || /[.!?;]$/.test(line) || ITEM_RE.test(line)) return false;
  const words = line.replace(/:$/, '').split(/\s+/);
  if (words.length > 5) return false;
  const capitalised = words.filter((w) => /^[A-Z]/.test(w)).length;
  return capitalised / words.length >= 0.6 && NUMBERED_RE.test(next);
}

/** Folds an unlisted line into the sentence above when it looks like a wrapped line of the same sentence. */
function continuesPrevious(prev: string, line: string): boolean {
  return /^[a-z(]/.test(line) || (!/[.!?:]$/.test(prev) && prev.length >= 55);
}

interface Pending {
  text: string;
  group?: string;
  phaseId?: string;
}

/** 'Day 1', 'Day 2: Transfer', 'Phase 3 - Detection'. Must be short and must not end like a sentence. */
const PHASE_HEADING_RE = /^(?:day|phase)\s+[\w.-]+(?:\s*[:.\-–—]\s*.{0,60}|\s*)?$/i;

function isPhaseHeading(line: string): boolean {
  return line.length <= 80 && !/[.!?;,]$/.test(line) && PHASE_HEADING_RE.test(line);
}

function phaseName(line: string): string {
  return capitalize(line.replace(/[:\s]+$/, '').trim()).slice(0, 60);
}

// Equipment and consumables are matched by name; solutions by a '... buffer/solution/medium' phrase.
const EQUIPMENT_TERMS: Array<[RegExp, MaterialKind, string]> = [
  [/\b(?:transfer (?:apparatus|cassette|tank|stack)|wet transfer|semi-dry transfer|blotting (?:apparatus|system))\b/gi, 'equipment', 'Transfer apparatus'],
  [/\b(?:gel (?:tank|box|apparatus|system)|electrophoresis (?:tank|chamber|apparatus|system))\b/gi, 'equipment', 'Electrophoresis tank'],
  [/\bpower supply\b/gi, 'equipment', 'Power supply'],
  [/\bcentrifuge\b/gi, 'equipment', 'Centrifuge'],
  [/\bmicrocentrifuge\b/gi, 'equipment', 'Microcentrifuge'],
  [/\bheat block\b/gi, 'equipment', 'Heat block'],
  [/\bwater bath\b/gi, 'equipment', 'Water bath'],
  [/\bincubator\b/gi, 'equipment', 'Incubator'],
  [/\b(?:rocker|shaker|orbital shaker)\b/gi, 'equipment', 'Rocker'],
  [/\b(?:imager|imaging system|chemiluminescence imager|scanner)\b/gi, 'equipment', 'Imaging system'],
  [/\bplate reader\b/gi, 'equipment', 'Plate reader'],
  [/\b(?:spectrophotometer|nanodrop)\b/gi, 'equipment', 'Spectrophotometer'],
  [/\bthermocycler\b/gi, 'equipment', 'Thermocycler'],
  [/\bpipett(?:e|es|ing)\b/gi, 'equipment', 'Pipettes'],
  [/\bvortex(?:er|ing)?\b/gi, 'equipment', 'Vortexer'],
  [/\bpipette tips?\b/gi, 'consumable', 'Pipette tips'],
  [/\b(?:nitrocellulose|pvdf) membranes?\b/gi, 'consumable', 'Membrane'],
  [/\bfilter paper\b/gi, 'consumable', 'Filter paper'],
  [/\bsponges?\b/gi, 'consumable', 'Sponges'],
  [/\bmicrocentrifuge tubes?\b/gi, 'consumable', 'Microcentrifuge tubes'],
  [/\b(?:falcon|conical) tubes?\b/gi, 'consumable', 'Conical tubes'],
  [/\b96-well (?:plate|plates)\b/gi, 'consumable', '96-well plate'],
  [/\bgloves\b/gi, 'consumable', 'Gloves'],
  [/\bparafilm\b/gi, 'consumable', 'Parafilm'],
];

const SOLUTION_RE = /\b((?:[A-Za-z0-9+-]+\s){0,2}(?:buffer|solution|medium|media|mix))\b/gi;
const SOLUTION_STOP = /^(?:the|this|each|of|in|with|and|a|an|to|for|at)$/i;

const MATERIAL_LIMIT = 40;

/**
 * Best-effort materials list from the text: equipment and consumables by name, and solutions or
 * buffers by a '... buffer' / '... solution' phrase. Duplicates are merged case-insensitively.
 */
export function detectMaterials(text: string): MaterialItem[] {
  const found = new Map<string, MaterialItem>();
  const add = (name: string, kind: MaterialKind) => {
    const key = name.toLowerCase();
    if (found.size >= MATERIAL_LIMIT || found.has(key)) return;
    found.set(key, { id: crypto.randomUUID(), name, kind });
  };

  const positions: Array<{ at: number; name: string; kind: MaterialKind }> = [];
  for (const [re, kind, name] of EQUIPMENT_TERMS) {
    for (const m of text.matchAll(re)) positions.push({ at: m.index ?? 0, name, kind });
  }
  positions.sort((a, b) => a.at - b.at);
  for (const p of positions) add(p.name, p.kind);

  for (const m of text.matchAll(SOLUTION_RE)) {
    const words = m[1].split(/\s+/);
    // Drop leading filler words such as 'the' or 'of' so 'the transfer buffer' becomes 'Transfer buffer'.
    while (words.length > 1 && SOLUTION_STOP.test(words[0])) words.shift();
    if (words.length < 2) continue;
    add(capitalize(words.join(' ')), 'solution');
  }

  return [...found.values()];
}

export function parseLocal(input: string): LocalParseResult {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const hasList = lines.some((line) => ITEM_RE.test(line));
  const hasProcedure = lines.some((line) => isProcedureHeading(line.trim()));

  const items: Pending[] = [];
  let inSection = !hasProcedure;
  let open = false;
  let blankBefore = true;
  let group: string | undefined;
  const phases: ProtocolPhase[] = [];
  let currentPhaseId: string | undefined;
  let title: string | undefined;
  let firstLine: string | undefined;

  const nextContent = (index: number): string => {
    for (let j = index + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (t) return t;
    }
    return '';
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      blankBefore = true;
      continue;
    }
    firstLine ??= line;

    if (isProcedureHeading(line)) {
      inSection = true;
      open = false;
      group = undefined;
      blankBefore = true;
      continue;
    }
    if (END_HEADING_RE.test(line)) {
      inSection = false;
      open = false;
      group = undefined;
      blankBefore = true;
      continue;
    }

    const bare = line.replace(ITEM_MARKER_RE, '').trim();
    if (
      KNOWN_GROUP_RE.test(bare) ||
      (items.length > 0 && isGenericGroupHeading(line, nextContent(i)))
    ) {
      inSection = true;
      open = false;
      group = toGroupName(bare);
      blankBefore = true;
      continue;
    }

    if (inSection && isPhaseHeading(line)) {
      const id = crypto.randomUUID();
      phases.push({ id, name: phaseName(line) });
      currentPhaseId = id;
      open = false;
      group = undefined;
      blankBefore = true;
      continue;
    }

    if (!inSection) continue;

    const last = items[items.length - 1];
    if (hasList) {
      const match = ITEM_RE.exec(raw);
      const indented = INDENT_RE.test(raw);
      if (match && (!indented || !open)) {
        items.push({ text: match[1], group, phaseId: currentPhaseId });
        open = true;
      } else if (open && last) {
        last.text += ` ${line}`;
      } else if (!title && items.length === 0 && line.length <= 100) {
        title = line;
      }
    } else if (open && last && !blankBefore && continuesPrevious(last.text, line)) {
      last.text += ` ${line}`;
    } else {
      items.push({ text: line, group, phaseId: currentPhaseId });
      open = true;
    }
    blankBefore = false;
  }

  if (!title && hasList && firstLine && firstLine.length <= 80 && !/[.!?]$/.test(firstLine)) {
    if (!ITEM_RE.test(firstLine) && !isProcedureHeading(firstLine) && !END_HEADING_RE.test(firstLine)) {
      title = firstLine;
    }
  }

  const materials = detectMaterials(input);

  return {
    title,
    steps: items.map((item) => makeStep(item.text, item.group, item.phaseId)),
    phases: phases.length > 0 ? phases : undefined,
    materials: materials.length > 0 ? materials : undefined,
  };
}

function makeStep(text: string, group?: string, phaseId?: string): Step {
  const id = crypto.randomUUID();
  const durations = detectDurations(text);
  const timers: Timer[] = durations.map((d) => ({
    id: crypto.randomUUID(),
    stepId: id,
    label: d.label,
    durationSec: d.seconds,
    status: 'idle',
  }));

  return {
    id,
    title: deriveTitle(text, group),
    instructions: text,
    durationSec: durations[0]?.seconds,
    timers,
    reagents: [],
    dataFields: [],
    cautions: detectCautions(text),
    ...(phaseId ? { phaseId } : {}),
  };
}
