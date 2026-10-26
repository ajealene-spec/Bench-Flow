import type { Step } from '../../types';

/** One token-level change inside a line of text. */
export interface WordSegment {
  type: 'equal' | 'added' | 'removed';
  text: string;
}

export type StepDiffKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface StepDiffRow {
  kind: StepDiffKind;
  before?: Step;
  after?: Step;
  /** Which parts of a changed step differ, for a quick summary. */
  fields: string[];
  /** Word-level diff of the title, when the step changed. */
  titleWords?: WordSegment[];
  /** Word-level diff of the instructions, when the step changed. */
  instructionWords?: WordSegment[];
}

/** Above this many tokens on either side, word diffs fall back to whole-text replacement to keep the LCS cheap. */
const MAX_WORD_TOKENS = 2000;

/**
 * Longest common subsequence by dynamic programming. Returns index pairs [i, j] in increasing order.
 * Plain O(n*m) is fine for protocol-sized lists (tens of steps, hundreds of words).
 */
export function lcsPairs<T>(a: readonly T[], b: readonly T[], eq: (x: T, y: T) => boolean): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const table: Uint32Array[] = [];
  for (let i = 0; i <= n; i++) table.push(new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = eq(a[i], b[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

/** Word-level diff. Whitespace is kept as tokens so the output can be rendered back as text. */
export function diffWords(before: string, after: string): WordSegment[] {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length > MAX_WORD_TOKENS || b.length > MAX_WORD_TOKENS) {
    const out: WordSegment[] = [];
    if (before) out.push({ type: 'removed', text: before });
    if (after) out.push({ type: 'added', text: after });
    return out;
  }
  const pairs = lcsPairs(a, b, (x, y) => x === y);
  const segments: WordSegment[] = [];
  const push = (type: WordSegment['type'], text: string) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.text += text;
    else segments.push({ type, text });
  };
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    while (i < pi) push('removed', a[i++]);
    while (j < pj) push('added', b[j++]);
    if (pi < a.length) {
      push('equal', a[i]);
      i++;
      j++;
    }
  }
  return segments;
}

/** Everything about a step that a reviewer would care about. Ids are excluded: a re-created step with the same content is unchanged. */
function stepContentKey(step: Step): string {
  return JSON.stringify({
    title: step.title,
    instructions: step.instructions,
    durationSec: step.durationSec ?? null,
    timers: step.timers.map((t) => [t.label, t.durationSec]),
    reagents: step.reagents,
    dataFields: step.dataFields,
    cautions: step.cautions,
    phaseId: step.phaseId ?? null,
  });
}

function changedFields(before: Step, after: Step): string[] {
  const fields: string[] = [];
  if (before.title !== after.title) fields.push('title');
  if (before.instructions !== after.instructions) fields.push('instructions');
  if ((before.durationSec ?? null) !== (after.durationSec ?? null)) fields.push('duration');
  if (JSON.stringify(before.timers.map((t) => [t.label, t.durationSec])) !== JSON.stringify(after.timers.map((t) => [t.label, t.durationSec]))) {
    fields.push('timers');
  }
  if (JSON.stringify(before.reagents) !== JSON.stringify(after.reagents)) fields.push('reagents');
  if (JSON.stringify(before.dataFields) !== JSON.stringify(after.dataFields)) fields.push('data fields');
  if (JSON.stringify(before.cautions) !== JSON.stringify(after.cautions)) fields.push('cautions');
  if ((before.phaseId ?? null) !== (after.phaseId ?? null)) fields.push('phase');
  return fields;
}

function changedRow(before: Step, after: Step): StepDiffRow {
  const fields = changedFields(before, after);
  return {
    kind: fields.length === 0 ? 'unchanged' : 'changed',
    before,
    after,
    fields,
    titleWords: diffWords(before.title, after.title),
    instructionWords: diffWords(before.instructions, after.instructions),
  };
}

/**
 * Compares two step lists. Steps are aligned by id first (LCS over ids keeps their order). Steps
 * between two aligned steps that are not matched by id are paired by title, so a step that was
 * re-created with the same title shows as changed rather than removed plus added.
 */
export function diffSteps(before: readonly Step[], after: readonly Step[]): StepDiffRow[] {
  const anchors = lcsPairs(before, after, (x, y) => x.id === y.id);
  const rows: StepDiffRow[] = [];
  let bi = 0;
  let ai = 0;

  const flushGap = (bEnd: number, aEnd: number) => {
    const removed = before.slice(bi, bEnd);
    const added = after.slice(ai, aEnd);
    const usedAdded = new Set<number>();
    const pairs: Array<[Step, Step]> = [];
    for (const b of removed) {
      const idx = added.findIndex((a, k) => !usedAdded.has(k) && a.title === b.title);
      if (idx >= 0) {
        usedAdded.add(idx);
        pairs.push([b, added[idx]]);
      }
    }
    const pairedBefore = new Set(pairs.map(([b]) => b.id));
    // Emit in the order the steps appear in the before list, then the leftover added steps.
    for (const b of removed) {
      const pair = pairs.find(([pb]) => pb.id === b.id);
      if (pair) rows.push(changedRow(pair[0], pair[1]));
      else if (!pairedBefore.has(b.id)) rows.push({ kind: 'removed', before: b, fields: [] });
    }
    added.forEach((a, k) => {
      if (!usedAdded.has(k)) rows.push({ kind: 'added', after: a, fields: [] });
    });
  };

  for (const [pb, pa] of anchors) {
    flushGap(pb, pa);
    const b = before[pb];
    const a = after[pa];
    rows.push(
      stepContentKey(b) === stepContentKey(a)
        ? { kind: 'unchanged', before: b, after: a, fields: [] }
        : changedRow(b, a),
    );
    bi = pb + 1;
    ai = pa + 1;
  }
  flushGap(before.length, after.length);
  return rows;
}

/** Counts of each kind of step change, for a one-line summary. */
export function summarizeStepDiff(rows: readonly StepDiffRow[]): Record<StepDiffKind, number> {
  const counts: Record<StepDiffKind, number> = { added: 0, removed: 0, changed: 0, unchanged: 0 };
  for (const row of rows) counts[row.kind]++;
  return counts;
}
