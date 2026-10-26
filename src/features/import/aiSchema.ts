import type { Step, StepVariable, Timer } from '../../types';
import { detectVariables } from '../assist/detectVariables';
import { cleanStepTitle } from './localParse';
import { MAX_STEPS } from './validateSteps';

/**
 * Strict validator for the AI parser output (see parsePrompt.ts) and the mapping from that output
 * to the app's Step type. Shared by the dev-server endpoint and the client.
 */

export const AI_DURATION_UNITS = ['seconds', 'minutes', 'hours'] as const;
export type AiDurationUnit = (typeof AI_DURATION_UNITS)[number];

export interface AiVariable {
  name: string;
  default_value: number;
  unit: string;
}

export interface AiDuration {
  value: number | null;
  unit: AiDurationUnit | null;
}

export interface AiStep {
  step_number: number;
  title: string;
  instruction_text: string;
  variables: AiVariable[];
  duration: AiDuration;
}

export type AiParseResult = { ok: true; steps: AiStep[] } | { ok: false; error: string };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const nonEmpty = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * Pulls the JSON array out of model text. Tolerates ```json fences and leading or trailing prose
 * by taking the text from the first "[" to the last "]".
 */
export function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  const object = candidate.indexOf('{');
  // An object wrapper such as {"steps": [...]} is not the shape the prompt asks for.
  if (start === -1 || end <= start || (object !== -1 && object < start)) {
    throw new Error('No JSON array found in model output');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

function validateDuration(raw: unknown, at: string): AiDuration | string {
  // A missing or null duration means the step has no time.
  if (raw === undefined || raw === null) return { value: null, unit: null };
  if (!isObj(raw)) return `${at} "duration" must be an object or null`;
  const { value, unit } = raw;
  if (value === null && unit === null) return { value: null, unit: null };
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return `${at} "duration.value" must be a positive number, or null when unit is null`;
  }
  if (typeof unit !== 'string' || !(AI_DURATION_UNITS as readonly string[]).includes(unit)) {
    return `${at} "duration.unit" must be "seconds", "minutes" or "hours"`;
  }
  return { value, unit: unit as AiDurationUnit };
}

function validateVariables(raw: unknown, at: string): AiVariable[] | string {
  if (!Array.isArray(raw)) return `${at} "variables" must be an array`;
  const out: AiVariable[] = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    const where = `${at} variable ${i + 1}`;
    if (!isObj(v)) return `${where} must be an object`;
    const name = nonEmpty(v.name);
    if (!name) return `${where} needs a "name"`;
    if (typeof v.default_value !== 'number' || !Number.isFinite(v.default_value)) {
      return `${where} "default_value" must be a number`;
    }
    if (typeof v.unit !== 'string') return `${where} "unit" must be a string`;
    out.push({ name, default_value: v.default_value, unit: v.unit.trim() });
  }
  return out;
}

/** Checks the parsed JSON has the shape the prompt asks for. Returns a clear error for the first problem. */
export function validateAiSteps(raw: unknown): AiParseResult {
  if (!Array.isArray(raw)) return { ok: false, error: 'Expected a JSON array of steps' };
  if (raw.length === 0) return { ok: false, error: 'No steps found' };
  if (raw.length > MAX_STEPS) return { ok: false, error: `Too many steps (max ${MAX_STEPS})` };

  const steps: AiStep[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    const at = `Step ${i + 1}`;
    if (!isObj(item)) return { ok: false, error: `${at} is not an object` };

    const n = item.step_number;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
      return { ok: false, error: `${at} "step_number" must be a positive integer` };
    }
    const title = nonEmpty(item.title);
    if (!title) return { ok: false, error: `${at} needs a non-empty "title"` };
    const instruction = nonEmpty(item.instruction_text);
    if (!instruction) return { ok: false, error: `${at} needs a non-empty "instruction_text"` };

    const variables = validateVariables(item.variables, at);
    if (typeof variables === 'string') return { ok: false, error: variables };
    const duration = validateDuration(item.duration, at);
    if (typeof duration === 'string') return { ok: false, error: duration };

    steps.push({
      step_number: n,
      title,
      instruction_text: instruction,
      variables,
      duration,
    });
  }
  return { ok: true, steps };
}

/** Full pipeline for raw model text: extract the array, then validate it. Never throws. */
export function parseAiSteps(modelText: string): AiParseResult {
  let parsed: unknown;
  try {
    parsed = extractJsonArray(modelText);
  } catch {
    return { ok: false, error: 'Model output is not a JSON array' };
  }
  return validateAiSteps(parsed);
}

/** Seconds for a duration object; undefined when the step has no time. */
export function durationToSeconds(duration: AiDuration): number | undefined {
  if (duration.value === null || duration.unit === null) return undefined;
  const factor = duration.unit === 'hours' ? 3600 : duration.unit === 'minutes' ? 60 : 1;
  const sec = Math.round(duration.value * factor);
  return sec > 0 ? sec : undefined;
}

/** Units a model value can be written in, in the text. "µ" and "u" are both accepted for micro. */
function unitPattern(unit: string): string {
  return unit
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[µμu]/g, '(?:µ|μ|u)');
}

/** The text as written for a value and unit (e.g. "10 mL"), or undefined when the text does not state it. */
export function findTokenInText(text: string, value: number, unit: string): string | undefined {
  const valueSource = String(value).replace('.', '\\.');
  const unitSource = unit ? `\\s*${unitPattern(unit)}` : '';
  const re = new RegExp(`(?<![\\d.,])${valueSource}${unitSource}(?![A-Za-z])`);
  const m = re.exec(text);
  return m ? m[0] : undefined;
}

/**
 * AI variables become role 'input' StepVariables. The token is the value and unit as written in the
 * text when it is found there, else the variable name. Inputs that detectVariables already found
 * (same value and unit) are not added twice.
 */
export function mergeVariables(aiVars: AiVariable[], text: string): StepVariable[] {
  const detected = detectVariables(text);
  const detectedInputs = detected.filter((v) => v.role === 'input');
  const extra: StepVariable[] = [];
  aiVars.forEach((v, i) => {
    const duplicate = detectedInputs.some(
      (d) => Math.abs(d.value - v.default_value) < 1e-9 && d.unit === v.unit,
    ) || extra.some((e) => Math.abs(e.value - v.default_value) < 1e-9 && e.unit === v.unit);
    if (duplicate) return;
    extra.push({
      id: `ai${i + 1}`,
      token: findTokenInText(text, v.default_value, v.unit) ?? v.name,
      value: v.default_value,
      unit: v.unit,
      role: 'input',
    });
  });
  // Detected variables go first so their derived formulas keep pointing at ids that still exist.
  return [...detected, ...extra];
}

/** Maps validated AI steps to Step objects, in step_number order. Ids are fresh UUIDs. */
export function mapAiSteps(steps: AiStep[]): Step[] {
  return [...steps]
    .sort((a, b) => a.step_number - b.step_number)
    .map((s) => {
      const id = crypto.randomUUID();
      const instructions = s.instruction_text.trim();
      const durationSec = durationToSeconds(s.duration);
      // The first timer mirrors the step duration, as the import page does when the duration is edited.
      const timers: Timer[] =
        durationSec === undefined
          ? []
          : [{ id: crypto.randomUUID(), stepId: id, label: 'Timer', durationSec, status: 'idle' }];
      const variables = mergeVariables(s.variables, instructions);
      return {
        id,
        title: cleanStepTitle(s.title),
        instructions,
        durationSec,
        timers,
        reagents: [],
        dataFields: [],
        cautions: [],
        ...(variables.length > 0 ? { variables } : {}),
      };
    });
}
