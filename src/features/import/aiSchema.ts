import type { Hazard, MaterialItem, MaterialKind, ProtocolPhase, Step, StepVariable, Timer } from '../../types';
import { detectVariables } from '../assist/detectVariables';
import { cleanStepTitle } from './localParse';
import { MAX_STEPS } from './validateSteps';
import {
  DEFAULT_TITLE,
  isCategory,
  isVerbatimEvidence,
  summarizeTotalTime,
  type ProtocolCategory,
  type ProtocolDraft,
} from './draft';
import { findRuleByName, hasAnimalContext } from './hazards';
import { materialsForText, mergeMaterials, type MaterialCandidate } from './materials';
import { repairMessage } from './parsePrompt';

/**
 * Strict schema for the AI parser's single JSON object (see parsePrompt.ts), validation, and the
 * mapping to the app's Step, Hazard and MaterialItem types. Shared by the dev-server endpoint and
 * the client, so the UI never trusts raw model output.
 */

export const AI_DURATION_UNITS = ['seconds', 'minutes', 'hours'] as const;
export type AiDurationUnit = (typeof AI_DURATION_UNITS)[number];
const TOTAL_UNITS = ['min', 'h'] as const;
const MATERIAL_KINDS: MaterialKind[] = ['consumable', 'solution', 'reagent', 'equipment'];
const HAZARD_TYPES = ['chemical', 'biological', 'physical', 'animal'] as const;

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
  phase: number | null;
  title: string;
  instruction_text: string;
  duration: AiDuration | null;
  variables: AiVariable[];
}

export interface AiProtocol {
  title: string;
  category: ProtocolCategory;
  objective: string;
  expectedOutput: string;
  totalTime: { value: number | null; unit: 'min' | 'h' | null; display: string };
  phases: Array<{ name: string }>;
  materials: Array<{ name: string; kind: MaterialKind; quantity: string | null }>;
  hazards: Array<{ agent: string; type: (typeof HAZARD_TYPES)[number]; evidence: string; ppe: string[] }>;
  steps: AiStep[];
}

export type AiValidation = { ok: true; protocol: AiProtocol } | { ok: false; error: string };

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Pulls the JSON object out of model text. Tolerates ```json fences and leading or trailing prose. */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found in model output');
  return JSON.parse(candidate.slice(start, end + 1));
}

function validateDuration(raw: unknown, at: string): AiDuration | null | string {
  if (raw === undefined || raw === null) return null;
  if (!isObj(raw)) return `${at} "duration" must be an object or null`;
  const { value, unit } = raw;
  if (value === null && unit === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return `${at} "duration.value" must be a positive number`;
  }
  if (typeof unit !== 'string' || !(AI_DURATION_UNITS as readonly string[]).includes(unit)) {
    return `${at} "duration.unit" must be "seconds", "minutes" or "hours"`;
  }
  return { value, unit: unit as AiDurationUnit };
}

function validateVariables(raw: unknown, at: string): AiVariable[] | string {
  if (raw === undefined) return [];
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

/**
 * Checks the parsed object against the schema. When `source` is given (the text the model read),
 * each hazard evidence quote must appear verbatim in it, and animal hazards need animal words in it.
 * Returns the first problem as a short message that is sent back to the model on a retry.
 */
export function validateAiProtocol(raw: unknown, source?: string): AiValidation {
  if (!isObj(raw)) return { ok: false, error: 'Expected one JSON object' };

  const title = typeof raw.title === 'string' ? raw.title : undefined;
  if (title === undefined) return { ok: false, error: '"title" must be a string' };
  if (!isCategory(raw.category)) return { ok: false, error: `"category" must be one of the listed categories` };
  if (typeof raw.objective !== 'string') return { ok: false, error: '"objective" must be a string' };
  if (typeof raw.expectedOutput !== 'string') return { ok: false, error: '"expectedOutput" must be a string' };

  const tt = raw.totalTime;
  if (!isObj(tt) || typeof tt.display !== 'string') return { ok: false, error: '"totalTime" needs a "display" string' };
  if (tt.unit !== null && tt.unit !== undefined && !(TOTAL_UNITS as readonly unknown[]).includes(tt.unit)) {
    return { ok: false, error: '"totalTime.unit" must be "min", "h" or null' };
  }

  if (!Array.isArray(raw.phases)) return { ok: false, error: '"phases" must be an array' };
  const phases: Array<{ name: string }> = [];
  for (let i = 0; i < raw.phases.length; i++) {
    const name = isObj(raw.phases[i]) ? nonEmpty((raw.phases[i] as Obj).name) : undefined;
    if (!name) return { ok: false, error: `Phase ${i + 1} needs a "name"` };
    phases.push({ name });
  }

  if (!Array.isArray(raw.materials)) return { ok: false, error: '"materials" must be an array' };
  const materials: AiProtocol['materials'] = [];
  for (let i = 0; i < raw.materials.length; i++) {
    const m = raw.materials[i];
    const name = isObj(m) ? nonEmpty(m.name) : undefined;
    if (!isObj(m) || !name) return { ok: false, error: `Material ${i + 1} needs a "name"` };
    if (!MATERIAL_KINDS.includes(m.kind as MaterialKind)) {
      return { ok: false, error: `Material "${name}" has an unknown "kind"` };
    }
    materials.push({ name, kind: m.kind as MaterialKind, quantity: nonEmpty(m.quantity) ?? null });
  }

  if (!Array.isArray(raw.hazards)) return { ok: false, error: '"hazards" must be an array' };
  const hazards: AiProtocol['hazards'] = [];
  for (let i = 0; i < raw.hazards.length; i++) {
    const h = raw.hazards[i];
    const where = `Hazard ${i + 1}`;
    if (!isObj(h)) return { ok: false, error: `${where} must be an object` };
    const agent = nonEmpty(h.agent);
    if (!agent) return { ok: false, error: `${where} needs an "agent"` };
    if (!(HAZARD_TYPES as readonly unknown[]).includes(h.type)) {
      return { ok: false, error: `${where} "type" must be chemical, biological, physical or animal` };
    }
    const evidence = nonEmpty(h.evidence);
    if (!evidence) return { ok: false, error: `${where} ("${agent}") needs an exact "evidence" quote` };
    if (source !== undefined && !isVerbatimEvidence(evidence, source)) {
      return { ok: false, error: `evidence for "${agent}" is not an exact quote from the text` };
    }
    if (source !== undefined && h.type === 'animal' && !hasAnimalContext(source)) {
      return { ok: false, error: `"${agent}" is an animal hazard but the text names no animals` };
    }
    const ppe = Array.isArray(h.ppe) ? h.ppe.filter((p): p is string => typeof p === 'string' && p.trim() !== '') : [];
    hazards.push({ agent, type: h.type as AiProtocol['hazards'][number]['type'], evidence, ppe });
  }

  if (!Array.isArray(raw.steps) || raw.steps.length === 0) return { ok: false, error: 'No steps found' };
  if (raw.steps.length > MAX_STEPS) return { ok: false, error: `Too many steps (max ${MAX_STEPS})` };
  const steps: AiStep[] = [];
  for (let i = 0; i < raw.steps.length; i++) {
    const item = raw.steps[i];
    const at = `Step ${i + 1}`;
    if (!isObj(item)) return { ok: false, error: `${at} is not an object` };
    if (!isInt(item.step_number) || item.step_number < 1) {
      return { ok: false, error: `${at} "step_number" must be a positive integer` };
    }
    if (item.phase !== null && (!isInt(item.phase) || item.phase < 0 || item.phase >= phases.length)) {
      return { ok: false, error: `${at} "phase" must be null or an index into "phases"` };
    }
    const stepTitle = nonEmpty(item.title);
    if (!stepTitle) return { ok: false, error: `${at} needs a non-empty "title"` };
    const instruction = nonEmpty(item.instruction_text);
    if (!instruction) return { ok: false, error: `${at} needs a non-empty "instruction_text"` };
    const variables = validateVariables(item.variables, at);
    if (typeof variables === 'string') return { ok: false, error: variables };
    const duration = validateDuration(item.duration, at);
    if (typeof duration === 'string') return { ok: false, error: duration };
    steps.push({
      step_number: item.step_number,
      phase: item.phase as number | null,
      title: stepTitle,
      instruction_text: instruction,
      duration,
      variables,
    });
  }

  return {
    ok: true,
    protocol: {
      title,
      category: raw.category,
      objective: raw.objective.trim(),
      expectedOutput: raw.expectedOutput.trim(),
      totalTime: {
        value: typeof tt.value === 'number' ? tt.value : null,
        unit: (tt.unit as 'min' | 'h' | null | undefined) ?? null,
        display: tt.display.trim(),
      },
      phases,
      materials,
      hazards,
      steps,
    },
  };
}

/** Full pipeline for raw model text: extract the object, then validate it. Never throws. */
export function parseAiProtocol(modelText: string, source?: string): AiValidation {
  let parsed: unknown;
  try {
    parsed = extractJsonObject(modelText);
  } catch {
    return { ok: false, error: 'the output was not a JSON object' };
  }
  return validateAiProtocol(parsed, source);
}

/**
 * Asks the model, validates the answer, and retries once with the validation error when it fails.
 * `ask` sends a list of chat turns and returns the model's text. Returns the validated protocol or
 * the last error.
 */
export async function parseWithRetry(
  ask: (turns: Array<{ role: 'user' | 'assistant'; content: string }>) => Promise<string | null>,
  source: string,
): Promise<AiValidation> {
  const first = await ask([{ role: 'user', content: source }]);
  if (first === null) return { ok: false, error: 'the model request failed' };
  const firstResult = parseAiProtocol(first, source);
  if (firstResult.ok) return firstResult;

  const second = await ask([
    { role: 'user', content: source },
    { role: 'assistant', content: first },
    { role: 'user', content: repairMessage(firstResult.error) },
  ]);
  if (second === null) return { ok: false, error: firstResult.error };
  return parseAiProtocol(second, source);
}

/** Seconds for a duration object; undefined when the step has no time. */
export function durationToSeconds(duration: AiDuration | null): number | undefined {
  if (!duration || duration.value === null || duration.unit === null) return undefined;
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
    const duplicate =
      detectedInputs.some((d) => Math.abs(d.value - v.default_value) < 1e-9 && d.unit === v.unit) ||
      extra.some((e) => Math.abs(e.value - v.default_value) < 1e-9 && e.unit === v.unit);
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

/** Hazards from the validated output. Known agents take the rule's name, reason and PPE. */
function mapHazards(hazards: AiProtocol['hazards'], steps: Step[]): Hazard[] {
  const out: Hazard[] = [];
  for (const h of hazards) {
    const rule = findRuleByName(h.agent);
    const stepIds = steps
      .filter((s) => {
        const text = `${s.title} ${s.instructions}`;
        if (rule) return rule.patterns.some((p) => p.test(text));
        return text.toLowerCase().includes(h.agent.toLowerCase());
      })
      .map((s) => s.id);
    const existing = rule ? out.find((x) => x.id === rule.id) : undefined;
    if (existing) {
      existing.stepIds = [...new Set([...existing.stepIds, ...stepIds])];
      existing.ppe = [...new Set([...existing.ppe, ...h.ppe])];
      continue;
    }
    out.push({
      id: rule?.id ?? crypto.randomUUID(),
      name: rule?.name ?? h.agent,
      kind: rule?.kind ?? h.type,
      reason: rule?.reason ?? '',
      ppe: rule ? [...rule.ppe] : [...new Set(h.ppe)],
      stepIds,
      evidence: h.evidence,
    });
  }
  return out;
}

/**
 * Maps a validated AI protocol to the shared draft. Steps are ordered by step_number. The materials
 * list is the AI's list plus any reagent or equipment the text names that the AI missed.
 */
export function mapAiProtocol(protocol: AiProtocol, source: string): ProtocolDraft {
  const phases: ProtocolPhase[] = protocol.phases.map((p) => ({ id: crypto.randomUUID(), name: p.name.slice(0, 60) }));

  const steps: Step[] = [...protocol.steps]
    .sort((a, b) => a.step_number - b.step_number)
    .map((s) => {
      const id = crypto.randomUUID();
      const instructions = s.instruction_text.trim();
      const durationSec = durationToSeconds(s.duration);
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
        ...(s.phase !== null ? { phaseId: phases[s.phase].id } : {}),
        ...(variables.length > 0 ? { variables } : {}),
      };
    });

  const aiMaterials: MaterialCandidate[] = protocol.materials.map((m) => ({
    name: m.name,
    kind: m.kind,
    ...(m.quantity ? { quantity: m.quantity } : {}),
  }));
  const materials: MaterialItem[] = mergeMaterials(aiMaterials, materialsForText(source));

  const totals = summarizeTotalTime(steps, phases.filter((p) => /^day\s+\d/i.test(p.name)).length);
  const title = protocol.title.trim().slice(0, 120) || DEFAULT_TITLE;
  return {
    title,
    category: protocol.category,
    overview: {
      objective: protocol.objective || `To perform ${protocol.category === 'Other' ? title : protocol.category}.`,
      outputs: protocol.expectedOutput,
      totalTime: totals.display ?? (protocol.totalTime.display || 'Not stated'),
    },
    phases,
    materials,
    hazards: mapHazards(protocol.hazards, steps),
    steps,
    parser: 'ai',
    note: '',
  };
}
