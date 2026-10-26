import type { ProtocolTemplate } from '../../types';
import { validateParsedProcedure, type ValidationResult } from '../import/validateSteps';

/*
 * Raw source for a template: JSON (the same shape the AI parser returns) or a simple Markdown
 * outline. Both turn into the same raw object, which goes through validateParsedProcedure before
 * anything is saved.
 *
 * Markdown outline:
 *   # Protocol title
 *   ## Step title
 *   Instructions as plain paragraphs.
 *   - timer: Incubate, 30 min
 *   - reagent: PBS | 10 mL
 *   - caution: Wear gloves
 */

export type SourceFormat = 'json' | 'markdown';

export function templateToJson(template: ProtocolTemplate): string {
  const raw = {
    title: template.title,
    steps: template.steps.map((s) => ({
      title: s.title,
      instructions: s.instructions,
      durationSec: s.durationSec,
      timers: s.timers.map((t) => ({ label: t.label, durationSec: t.durationSec })),
      reagents: s.reagents,
      cautions: s.cautions,
      dataFields: s.dataFields.map((f) => ({ label: f.label, unit: f.unit, type: f.type })),
    })),
  };
  return JSON.stringify(raw, null, 2);
}

export function templateToMarkdown(template: ProtocolTemplate): string {
  const lines = [`# ${template.title}`, ''];
  for (const step of template.steps) {
    lines.push(`## ${step.title}`);
    if (step.instructions) lines.push(step.instructions);
    for (const timer of step.timers) lines.push(`- timer: ${timer.label}, ${timer.durationSec} s`);
    for (const reagent of step.reagents) {
      const amount = [reagent.amount, reagent.unit].filter(Boolean).join(' ');
      lines.push(amount ? `- reagent: ${reagent.name} | ${amount}` : `- reagent: ${reagent.name}`);
    }
    for (const caution of step.cautions) lines.push(`- caution: ${caution}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** "30 min", "90 s", "2 h" or a bare number of seconds. Returns undefined when it cannot read the value. */
export function parseDuration(text: string): number | undefined {
  const m = text.trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)?$/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = (m[2] ?? 's').toLowerCase();
  if (unit.startsWith('h')) return Math.round(n * 3600);
  if (unit.startsWith('m')) return Math.round(n * 60);
  return Math.round(n);
}

type Obj = Record<string, unknown>;

/** Reads the Markdown outline into the raw object the validator expects. */
export function markdownToRaw(markdown: string): { ok: true; raw: Obj } | { ok: false; error: string } {
  let title: string | undefined;
  const steps: Obj[] = [];
  let current: Obj | null = null;
  const body: string[] = [];
  const flush = () => {
    if (current) current.instructions = body.join('\n').trim();
    body.length = 0;
  };

  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('# ') && title === undefined) {
      title = line.slice(2).trim();
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      current = { title: line.slice(3).trim(), timers: [], reagents: [], cautions: [] };
      steps.push(current);
      continue;
    }
    if (!current) continue; // Text before the first step is ignored.
    const bullet = line.match(/^[-*]\s*(timer|reagent|caution):\s*(.+)$/i);
    if (!bullet) {
      body.push(line);
      continue;
    }
    const kind = bullet[1].toLowerCase();
    const value = bullet[2].trim();
    if (kind === 'caution') {
      (current.cautions as string[]).push(value);
    } else if (kind === 'reagent') {
      const [name, amount] = value.split('|').map((part) => part.trim());
      (current.reagents as Obj[]).push(amount ? { name, amount } : { name });
    } else {
      const comma = value.lastIndexOf(',');
      const label = comma === -1 ? value : value.slice(0, comma).trim();
      const duration = comma === -1 ? undefined : parseDuration(value.slice(comma + 1));
      if (duration === undefined) return { ok: false, error: `Timer "${label}" needs a duration such as "30 min" or "90 s".` };
      (current.timers as Obj[]).push({ label, durationSec: duration });
    }
  }
  flush();
  if (steps.length === 0) return { ok: false, error: 'Add at least one "## Step title" heading.' };
  return { ok: true, raw: { title, steps } };
}

/** Parses source text in the chosen format and validates it. Never throws. */
export function parseTemplateSource(format: SourceFormat, text: string): ValidationResult {
  let raw: unknown;
  if (format === 'json') {
    try {
      raw = JSON.parse(text);
    } catch {
      return { ok: false, error: 'That is not valid JSON. Check commas and quotes.' };
    }
  } else {
    const converted = markdownToRaw(text);
    if (!converted.ok) return { ok: false, error: converted.error };
    raw = converted.raw;
  }
  return validateParsedProcedure(raw);
}
