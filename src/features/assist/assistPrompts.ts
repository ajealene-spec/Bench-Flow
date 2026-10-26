import { extractJson } from '../import/validateSteps';

/**
 * Prompts, request validation and response validation for the Ask-AI endpoints.
 * Shared by the dev-server plugin (server/assistPlugin.ts), the client panels and the tests,
 * so the rules the model sees are the ones we test.
 */

export const MODEL_MAX_BODY_CHARS = 40_000;
export const MAX_PROBLEM_TEXT_CHARS = 1_000;
export const MAX_TITLE_CHARS = 200;
export const MAX_LITERATURE_STEPS = 80;
export const MAX_STEP_LINE_CHARS = 300;

export const PRESETS = [
  { id: 'high_background', label: 'High background' },
  { id: 'no_signal', label: 'No signal / weak bands' },
  { id: 'smeared_bands', label: 'Smeared bands' },
  { id: 'nonspecific_bands', label: 'Extra/nonspecific bands' },
  { id: 'uneven_transfer', label: 'Uneven transfer' },
  { id: 'bubbles', label: 'Bubbles/blank spots' },
  { id: 'no_amplification', label: 'No amplification' },
  { id: 'primer_dimers', label: 'Primer dimers' },
] as const;

export type PresetId = (typeof PRESETS)[number]['id'];

export const PRESET_IDS: readonly string[] = PRESETS.map((p) => p.id);

export function presetLabel(id: string | undefined): string | undefined {
  return PRESETS.find((p) => p.id === id)?.label;
}

/** Compact run parameters sent to the model. Built on the client from buildReport. */
export interface RunSummary {
  experimentName: string;
  status: string;
  durationSec?: number;
  notes?: string;
  steps: RunSummaryStep[];
  reagents: { name: string; amount?: string; unit?: string; stepNumbers: number[] }[];
  deviations: string[];
}

export interface RunSummaryStep {
  number: number;
  title: string;
  instructions: string;
  completed: boolean;
  cautions?: string[];
  timers?: { label: string; plannedSec?: number; actualSec?: number }[];
  numbers?: { label: string; value?: number; unit?: string; note?: string }[];
  calculations?: { label: string; value: number; unit?: string }[];
}

export interface TroubleshootRequest {
  protocolTitle: string;
  problem: { preset?: PresetId; text?: string };
  report: RunSummary;
}

export interface LiteratureRequest {
  protocolTitle: string;
  steps: string[];
}

export interface TroubleshootCause {
  cause: string;
  evidence: string;
  adjustments: string[];
}

export interface TroubleshootResult {
  causes: TroubleshootCause[];
  quickChecks: string[];
}

export interface LiteratureCitation {
  title: string;
  url: string;
}

export interface LiteratureSuggestion {
  title: string;
  change: string;
  rationale: string;
  citations: LiteratureCitation[];
}

export interface LiteratureResult {
  suggestions: LiteratureSuggestion[];
  summary: string;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/* ----------------------------- request validation ----------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export function parseTroubleshootRequest(body: unknown): ParseResult<TroubleshootRequest> {
  if (!isRecord(body)) return { ok: false, error: 'invalid_body' };
  const protocolTitle = cleanString(body.protocolTitle, MAX_TITLE_CHARS);
  if (!protocolTitle) return { ok: false, error: 'missing_protocol_title' };

  if (!isRecord(body.problem)) return { ok: false, error: 'missing_problem' };
  const presetRaw = body.problem.preset;
  if (presetRaw !== undefined && (typeof presetRaw !== 'string' || !PRESET_IDS.includes(presetRaw))) {
    return { ok: false, error: 'invalid_preset' };
  }
  const text = cleanString(body.problem.text, MAX_PROBLEM_TEXT_CHARS);
  const preset = presetRaw as PresetId | undefined;
  if (!preset && !text) return { ok: false, error: 'missing_problem' };

  if (!isRecord(body.report) || !Array.isArray(body.report.steps)) {
    return { ok: false, error: 'missing_report' };
  }
  if (JSON.stringify(body.report).length > MODEL_MAX_BODY_CHARS) {
    return { ok: false, error: 'report_too_large' };
  }
  return {
    ok: true,
    value: {
      protocolTitle,
      problem: { preset, text },
      report: body.report as unknown as RunSummary,
    },
  };
}

export function parseLiteratureRequest(body: unknown): ParseResult<LiteratureRequest> {
  if (!isRecord(body)) return { ok: false, error: 'invalid_body' };
  const protocolTitle = cleanString(body.protocolTitle, MAX_TITLE_CHARS);
  if (!protocolTitle) return { ok: false, error: 'missing_protocol_title' };
  if (!Array.isArray(body.steps) || body.steps.length === 0) return { ok: false, error: 'missing_steps' };
  if (body.steps.length > MAX_LITERATURE_STEPS) return { ok: false, error: 'too_many_steps' };
  const steps: string[] = [];
  for (const line of body.steps) {
    const clean = cleanString(line, MAX_STEP_LINE_CHARS);
    if (clean) steps.push(clean);
  }
  if (steps.length === 0) return { ok: false, error: 'missing_steps' };
  return { ok: true, value: { protocolTitle, steps } };
}

/* ------------------------------- prompt builders ------------------------------ */

export const TROUBLESHOOT_SYSTEM_PROMPT = `You help a bench scientist find the likely cause of a poor result in a laboratory protocol (neuroscience and molecular biology, often Western blot or PCR).

The user message contains the protocol title, the problem the scientist reported (a preset symptom and/or free text), and the run parameters as JSON: each step with its planned and actual timer durations, recorded numbers, reagents with amounts, cautions, and deviations from the plan.

Rules:
- Rank causes from most to least likely. At most 5 causes.
- Ground every cause in the run data. "evidence" must quote or cite a specific parameter from the run (for example "blocking ran 30 min vs 1 h planned"). If the run data does not show it, say so and lower the rank.
- Each adjustment must be specific and tied to an exact parameter, with a concrete new value. Good: "Blocking was 30 min vs 1 h planned: extend blocking to 1 h." Good: "Primary antibody was 1:500: try 1:2000." Bad: "Optimize the blocking step."
- At most 4 adjustments per cause. Keep each string under 200 characters.
- quickChecks: up to 6 short checks the scientist can do before rerunning (reagent freshness, controls, membrane staining, equipment).
- Do not give advice that goes beyond the protocol's own safety cautions.

Return ONLY a JSON object, no prose and no code fence, with this shape:
{
  "causes": [ { "cause": string, "evidence": string, "adjustments": [ string ] } ],
  "quickChecks": [ string ]
}`;

export const LITERATURE_SYSTEM_PROMPT = `You check recent published literature and manufacturer application notes for optimizations to a laboratory protocol.

You may use the web_search tool. Search for recent sources (roughly the last five years) about this method and its steps. Prefer peer-reviewed articles and manufacturer protocols or application notes. Do not cite blogs, forums or vendor marketing pages as evidence.

Rules:
- You only SUGGEST changes. Nothing is applied automatically; the scientist decides.
- Cite every suggestion with at least one URL that you actually found in the search results. Do not invent URLs. If you cannot find a credible source for a change, leave it out.
- Keep each suggestion to one concrete change to a specific step, with the reason it is expected to help.
- At most 5 suggestions. If nothing credible turns up, return an empty suggestions list and say so in summary.

Return ONLY a JSON object, no prose and no code fence, with this shape:
{
  "suggestions": [ { "title": string, "change": string, "rationale": string, "citations": [ { "title": string, "url": string } ] } ],
  "summary": string
}`;

export function buildTroubleshootUserMessage(req: TroubleshootRequest): string {
  const symptom = presetLabel(req.problem.preset);
  const lines = [`Protocol: ${req.protocolTitle}`];
  if (symptom) lines.push(`Symptom: ${symptom}`);
  if (req.problem.text) lines.push(`Scientist's description: ${req.problem.text}`);
  lines.push('', 'Run parameters (JSON):', JSON.stringify(req.report));
  return lines.join('\n');
}

export function buildLiteratureUserMessage(req: LiteratureRequest): string {
  return [
    `Protocol: ${req.protocolTitle}`,
    'Steps:',
    ...req.steps.map((step, i) => `${i + 1}. ${step}`),
    '',
    'Find recent sources for optimizations to this protocol, then return the JSON object.',
  ].join('\n');
}

export const LITERATURE_MAX_USES = 5;

/** Request body for the Messages API with the web search server tool enabled. */
export function buildLiteratureRequestBody(model: string, req: LiteratureRequest): Record<string, unknown> {
  return {
    model,
    max_tokens: 3000,
    system: LITERATURE_SYSTEM_PROMPT,
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: LITERATURE_MAX_USES }],
    messages: [{ role: 'user', content: buildLiteratureUserMessage(req) }],
  };
}

export function buildTroubleshootRequestBody(model: string, req: TroubleshootRequest): Record<string, unknown> {
  return {
    model,
    max_tokens: 2000,
    system: TROUBLESHOOT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildTroubleshootUserMessage(req) }],
  };
}

/* ------------------------------ response handling ----------------------------- */

/** A content block from the Messages API. Only the fields we read are typed. */
export interface ContentBlock {
  type: string;
  text?: string;
  content?: unknown;
}

export function textOf(blocks: ContentBlock[]): string {
  return blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}

/** URLs and titles from every web search result block, keyed by URL. */
export function collectSearchResults(blocks: ContentBlock[]): Map<string, string> {
  const found = new Map<string, string>();
  for (const block of blocks) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue;
    for (const item of block.content as unknown[]) {
      if (!isRecord(item) || item.type !== 'web_search_result') continue;
      if (typeof item.url === 'string') {
        found.set(item.url, typeof item.title === 'string' ? item.title : item.url);
      }
    }
  }
  return found;
}

/** The error code when the web search tool failed, or undefined when every search block succeeded. */
export function searchErrorOf(blocks: ContentBlock[]): string | undefined {
  for (const block of blocks) {
    if (block.type !== 'web_search_tool_result') continue;
    if (isRecord(block.content) && block.content.type === 'web_search_tool_result_error') {
      return typeof block.content.error_code === 'string' ? block.content.error_code : 'unknown';
    }
  }
  return undefined;
}

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Parses the model's text as JSON and checks the troubleshooting shape. */
export function validateTroubleshootResult(raw: unknown): ParseResult<TroubleshootResult> {
  if (!isRecord(raw) || !Array.isArray(raw.causes)) return { ok: false, error: 'causes must be a list' };
  const causes: TroubleshootCause[] = [];
  for (const item of raw.causes.slice(0, 5)) {
    if (!isRecord(item)) continue;
    const cause = cleanString(item.cause, 300);
    if (!cause) continue;
    const adjustments = Array.isArray(item.adjustments)
      ? item.adjustments.map((a) => cleanString(a, 200)).filter((a): a is string => Boolean(a)).slice(0, 4)
      : [];
    causes.push({ cause, evidence: cleanString(item.evidence, 400) ?? '', adjustments });
  }
  const quickChecks = Array.isArray(raw.quickChecks)
    ? raw.quickChecks.map((q) => cleanString(q, 200)).filter((q): q is string => Boolean(q)).slice(0, 6)
    : [];
  if (causes.length === 0 && quickChecks.length === 0) return { ok: false, error: 'no usable suggestions' };
  return { ok: true, value: { causes, quickChecks } };
}

/**
 * Checks the literature shape. When allowedUrls is given (server side), a citation is kept only if its
 * URL appeared in the search results, and a suggestion without any kept citation is dropped.
 * Citations must be https in every case.
 */
export function validateLiteratureResult(raw: unknown, allowedUrls?: Set<string>): ParseResult<LiteratureResult> {
  if (!isRecord(raw) || !Array.isArray(raw.suggestions)) return { ok: false, error: 'suggestions must be a list' };
  const suggestions: LiteratureSuggestion[] = [];
  for (const item of raw.suggestions.slice(0, 5)) {
    if (!isRecord(item)) continue;
    const title = cleanString(item.title, 200);
    const change = cleanString(item.change, 400);
    const rationale = cleanString(item.rationale, 400);
    if (!title || !change || !rationale || !Array.isArray(item.citations)) continue;
    const citations: LiteratureCitation[] = [];
    for (const c of item.citations) {
      if (!isRecord(c)) continue;
      const url = cleanString(c.url, 2000);
      if (!url || !isHttps(url)) continue;
      if (allowedUrls && !allowedUrls.has(url)) continue;
      citations.push({ title: cleanString(c.title, 300) ?? url, url });
    }
    if (citations.length === 0) continue;
    suggestions.push({ title, change, rationale, citations });
  }
  return { ok: true, value: { suggestions, summary: cleanString(raw.summary, 600) ?? '' } };
}

/** Extracts and validates JSON from model text. Returns an error string instead of throwing. */
export function parseModelJson(text: string): ParseResult<unknown> {
  try {
    return { ok: true, value: extractJson(text) };
  } catch {
    return { ok: false, error: 'model_output_not_json' };
  }
}
