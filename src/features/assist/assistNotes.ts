import type { LiteratureSuggestion, TroubleshootResult } from './assistPrompts';

/** Appends an entry to existing notes, separated by a blank line. Never drops existing text. */
export function appendNote(existing: string | undefined, entry: string): string {
  const current = existing?.trimEnd() ?? '';
  return current ? `${current}\n\n${entry}` : entry;
}

function dateStamp(when: Date): string {
  return when.toISOString().slice(0, 10);
}

/** Dated note summarizing a troubleshooting result: the top causes and their adjustments. */
export function troubleshootNoteText(
  result: TroubleshootResult,
  opts: { symptom?: string; problemText?: string; when: Date },
): string {
  const heading = [`[${dateStamp(opts.when)}] Troubleshooting`];
  if (opts.symptom) heading.push(`(${opts.symptom})`);
  const lines = [heading.join(' ')];
  if (opts.problemText) lines.push(`Problem: ${opts.problemText}`);
  if (result.causes.length === 0) {
    lines.push('No specific causes suggested.');
  } else {
    lines.push('Likely causes:');
    for (const c of result.causes.slice(0, 3)) {
      lines.push(`- ${c.cause}: ${c.adjustments.join(' ')}`);
    }
  }
  return lines.join('\n');
}

/** Dated note for one literature suggestion the user chose to keep. Nothing is applied to the steps. */
export function literatureNoteText(suggestion: LiteratureSuggestion, when: Date): string {
  const sources = suggestion.citations.map((c) => `${c.title} (${c.url})`).join('; ');
  return [
    `[${dateStamp(when)}] Literature suggestion: ${suggestion.title}`,
    `Change: ${suggestion.change}`,
    `Why: ${suggestion.rationale}`,
    `Sources: ${sources}`,
  ].join('\n');
}
