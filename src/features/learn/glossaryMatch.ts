/*
 * Finds glossary terms inside step text. Pure: no React, no database.
 * Longer terms win over shorter ones, and terms must match whole words.
 */

export interface GlossaryEntry {
  term: string;
  aliases?: string[];
  definition: string;
}

export type GlossarySegment = { kind: 'text'; text: string } | { kind: 'term'; text: string; entry: GlossaryEntry };

/**
 * Short all-caps style terms (PBS, Ra, C1V1) only match their exact case, so "ra" in ordinary
 * words does not light up. Longer words match in any case.
 */
export function isCaseSensitive(word: string): boolean {
  return /[A-Z]/.test(word) && word.length <= 6;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Splits text into plain runs and known terms. Each term is returned once per occurrence. */
export function splitGlossary(text: string, entries: GlossaryEntry[]): GlossarySegment[] {
  if (!text) return [];
  const lookup = new Map<string, GlossaryEntry>();
  for (const entry of entries) {
    for (const word of [entry.term, ...(entry.aliases ?? [])]) {
      const key = word.trim();
      if (key.length < 2 && !/[A-Za-zµ]/.test(key)) continue;
      if (!lookup.has(key)) lookup.set(key, entry);
    }
  }
  if (lookup.size === 0) return [{ kind: 'text', text }];

  const words = [...lookup.keys()].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(?<![\\w])(${words.map(escapeRe).join('|')})(?![\\w])`, 'gi');
  const segments: GlossarySegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    const matched = m[0];
    const entry = findEntry(matched, lookup);
    if (!entry) continue;
    if (m.index > last) segments.push({ kind: 'text', text: text.slice(last, m.index) });
    segments.push({ kind: 'term', text: matched, entry });
    last = m.index + matched.length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}

function findEntry(matched: string, lookup: Map<string, GlossaryEntry>): GlossaryEntry | undefined {
  const exact = lookup.get(matched);
  if (exact) return exact;
  for (const [key, entry] of lookup) {
    if (isCaseSensitive(key)) continue;
    if (key.toLowerCase() === matched.toLowerCase()) return entry;
  }
  return undefined;
}

/** Looks up one term by its name or alias, ignoring case. */
export function findGlossaryEntry(word: string, entries: GlossaryEntry[]): GlossaryEntry | undefined {
  const key = word.trim().toLowerCase();
  return entries.find((e) => e.term.toLowerCase() === key || (e.aliases ?? []).some((a) => a.toLowerCase() === key));
}
