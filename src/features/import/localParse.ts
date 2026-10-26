import type { Step, Timer } from '../../types';

/**
 * Deterministic, offline procedure parser. Used when the AI parser is unavailable.
 * It splits numbered/bulleted lists (or line-per-action notes) into steps and
 * detects durations ("10 min", "1 h", "30 s", "overnight") as timers.
 */

export interface LocalParseResult {
  title?: string;
  steps: Step[];
}

export interface DetectedDuration {
  seconds: number;
  label: string;
}

// "1. x", "2) x", "Step 3: x", "(4) x", "- x", "* x", "• x", "– x" (marker must be followed by a space,
// so "1.5 mL" is not treated as a list item).
const ITEM_RE = /^\s*(?:step\s+\d{1,3}\s*[:.)]|\d{1,3}\s*[.)]|\(\d{1,3}\)|[-*•–])\s+(.+?)\s*$/i;
const INDENT_RE = /^(?:\s{2,}|\t)/;

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

const CAUTION_RE =
  /\b(caution|warning|danger|hazard\w*|toxic|carcinogen\w*|corrosive|flammable|wear\s+(?:gloves|goggles|a\s+lab\s+coat|ppe)|handle with care|do not|don't|never)\b/i;

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
    .filter((s) => s && CAUTION_RE.test(s));
}

/** Short title from a step's text: the part before a colon, else the first sentence, else a word-trimmed prefix. */
export function deriveTitle(text: string): string {
  const colon = text.search(/:\s/);
  if (colon > 0 && colon <= 60) return text.slice(0, colon).trim();

  const sentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  if (sentence.length <= 70) return sentence.replace(/[.!?]$/, '').trim();

  if (text.length <= 70) return text;
  const cut = text.slice(0, 60);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

function makeStep(text: string): Step {
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
    title: deriveTitle(text),
    instructions: text,
    durationSec: durations[0]?.seconds,
    timers,
    reagents: [],
    dataFields: [],
    cautions: detectCautions(text),
  };
}

export function parseLocal(input: string): LocalParseResult {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const hasList = lines.some((line) => ITEM_RE.test(line));

  const texts: string[] = [];
  let title: string | undefined;

  if (hasList) {
    let current: string | null = null;
    for (const line of lines) {
      const match = ITEM_RE.exec(line);
      const indented = INDENT_RE.test(line);
      if (match && (!indented || current === null)) {
        if (current !== null) texts.push(current);
        current = match[1];
      } else if (line.trim()) {
        // Continuation or indented sub-bullet: belongs to the step above.
        if (current !== null) {
          current += ` ${line.trim()}`;
        } else if (!title && line.trim().length <= 100) {
          title = line.trim();
        }
      }
    }
    if (current !== null) texts.push(current);
  } else {
    // Messy notes: one action per line.
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) texts.push(trimmed);
    }
  }

  return {
    title,
    steps: texts.map(makeStep),
  };
}
