import type { DataField, Reagent, Step, Timer } from '../../types';
import { cleanStepTitle } from './localParse';

/**
 * Validates the JSON returned by the AI parser and turns it into Step objects.
 * Shared by the dev-server endpoint (server/parsePlugin.ts) and the client, so the
 * UI never trusts raw model output.
 */

export const MAX_STEPS = 200;

export type ValidationResult =
  | { ok: true; title?: string; steps: Step[] }
  | { ok: false; error: string };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

const seconds = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;

/** Pulls a JSON object out of model text, tolerating ```json fences and surrounding prose. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found in model output');
  return JSON.parse(candidate.slice(start, end + 1));
}

export function validateParsedProcedure(raw: unknown): ValidationResult {
  if (!isObj(raw) || !Array.isArray(raw.steps)) {
    return { ok: false, error: 'Expected an object with a "steps" array' };
  }
  if (raw.steps.length === 0) return { ok: false, error: 'No steps found' };
  if (raw.steps.length > MAX_STEPS) return { ok: false, error: `Too many steps (max ${MAX_STEPS})` };

  const steps: Step[] = [];
  for (let i = 0; i < raw.steps.length; i++) {
    const item = raw.steps[i];
    if (!isObj(item)) return { ok: false, error: `Step ${i + 1} is not an object` };
    const rawTitle = str(item.title);
    if (!rawTitle) return { ok: false, error: `Step ${i + 1} has no title` };
    const title = cleanStepTitle(rawTitle);

    const id = crypto.randomUUID();

    const timers: Timer[] = [];
    if (Array.isArray(item.timers)) {
      for (const t of item.timers) {
        const durationSec = isObj(t) ? seconds(t.durationSec) : undefined;
        if (!isObj(t) || durationSec === undefined) continue;
        timers.push({
          id: crypto.randomUUID(),
          stepId: id,
          label: str(t.label) ?? 'Timer',
          durationSec,
          status: 'idle',
        });
      }
    }

    const reagents: Reagent[] = [];
    if (Array.isArray(item.reagents)) {
      for (const r of item.reagents) {
        const name = isObj(r) ? str(r.name) : undefined;
        if (!isObj(r) || !name) continue;
        const amount = typeof r.amount === 'number' ? String(r.amount) : str(r.amount);
        reagents.push({ name, amount, unit: str(r.unit) });
      }
    }

    const dataFields: DataField[] = [];
    if (Array.isArray(item.dataFields)) {
      for (const f of item.dataFields) {
        const label = isObj(f) ? str(f.label) : undefined;
        if (!isObj(f) || !label) continue;
        dataFields.push({
          id: crypto.randomUUID(),
          label,
          unit: str(f.unit),
          type: f.type === 'number' ? 'number' : 'text',
        });
      }
    }

    const cautions = Array.isArray(item.cautions)
      ? item.cautions.map(str).filter((c): c is string => Boolean(c))
      : [];

    steps.push({
      id,
      title,
      instructions: str(item.instructions) ?? '',
      durationSec: seconds(item.durationSec),
      timers,
      reagents,
      dataFields,
      cautions,
    });
  }

  const procedureTitle = str(raw.title);
  return { ok: true, title: procedureTitle ? cleanStepTitle(procedureTitle) : undefined, steps };
}
