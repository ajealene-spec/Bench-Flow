import type { Step, Timer } from '../../types';

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

    if (!inSection) continue;

    const last = items[items.length - 1];
    if (hasList) {
      const match = ITEM_RE.exec(raw);
      const indented = INDENT_RE.test(raw);
      if (match && (!indented || !open)) {
        items.push({ text: match[1], group });
        open = true;
      } else if (open && last) {
        last.text += ` ${line}`;
      } else if (!title && items.length === 0 && line.length <= 100) {
        title = line;
      }
    } else if (open && last && !blankBefore && continuesPrevious(last.text, line)) {
      last.text += ` ${line}`;
    } else {
      items.push({ text: line, group });
      open = true;
    }
    blankBefore = false;
  }

  if (!title && hasList && firstLine && firstLine.length <= 80 && !/[.!?]$/.test(firstLine)) {
    if (!ITEM_RE.test(firstLine) && !isProcedureHeading(firstLine) && !END_HEADING_RE.test(firstLine)) {
      title = firstLine;
    }
  }

  return {
    title,
    steps: items.map((item) => makeStep(item.text, item.group)),
  };
}

function makeStep(text: string, group?: string): Step {
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
  };
}
