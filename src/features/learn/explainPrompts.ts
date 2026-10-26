/*
 * Prompt, request and response rules for the "explain this step" call. Pure, so the server handler, the
 * client and the tests all use the same rules.
 */

import { extractJson } from '../import/validateSteps';

export const EXPLAIN_MAX_BODY_CHARS = 12_000;
export const EXPLAIN_MAX_TITLE_CHARS = 200;
export const EXPLAIN_MAX_INSTRUCTION_CHARS = 4_000;
export const EXPLAIN_MAX_WHY_CHARS = 800;
export const EXPLAIN_MAX_MISTAKES = 6;
export const EXPLAIN_MAX_MISTAKE_CHARS = 200;
export const EXPLAIN_MAX_LINKS = 4;

export interface ExplainRequest {
  protocolTitle: string;
  title: string;
  instructions: string;
}

export interface ExplainLinkOut {
  title: string;
  url: string;
}

export interface ExplainResult {
  why: string;
  mistakes: string[];
  links: ExplainLinkOut[];
}

export const EXPLAIN_SYSTEM_PROMPT = `You explain one step of a laboratory protocol to a beginner at the bench (neuroscience and molecular biology).

Reply with JSON only, no prose and no code fence, in exactly this shape:
{"why": "...", "mistakes": ["..."], "links": [{"title": "...", "url": "https://..."}]}

Rules:
- "why": two to four plain sentences on why this step matters and what it does to the sample. No greetings.
- "mistakes": up to 5 short, common errors for this step, each under 25 words.
- "links": up to 3 well-known public references (protocol sites, methods journals, vendor guides). Only give a URL you are sure exists. Use an empty list if unsure.
- Do not change or repeat the amounts or the instructions. Do not give medical or safety advice beyond the step itself.`;

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clean(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Checks the request body. The step text is capped so a huge paste cannot run up the bill. */
export function parseExplainRequest(body: unknown): { ok: true; value: ExplainRequest } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: 'invalid_body' };
  const title = clean(body.title, EXPLAIN_MAX_TITLE_CHARS);
  if (!title) return { ok: false, error: 'missing_title' };
  const protocolTitle = clean(body.protocolTitle, EXPLAIN_MAX_TITLE_CHARS) ?? 'Lab protocol';
  const instructions = clean(body.instructions, EXPLAIN_MAX_INSTRUCTION_CHARS) ?? '';
  return { ok: true, value: { protocolTitle, title, instructions } };
}

export function buildExplainUserMessage(req: ExplainRequest): string {
  return ['Protocol: ' + req.protocolTitle, 'Step title: ' + req.title, 'Step text:', req.instructions || '(none)'].join('\n');
}

export function buildExplainRequestBody(model: string, req: ExplainRequest): Rec {
  return {
    model,
    max_tokens: 900,
    system: EXPLAIN_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildExplainUserMessage(req) }],
  };
}

/** Only https links with a title are kept. Anything else from the model is dropped. */
export function cleanLinks(value: unknown): ExplainLinkOut[] {
  if (!Array.isArray(value)) return [];
  const out: ExplainLinkOut[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const title = clean(item.title, 120);
    const url = clean(item.url, 500);
    if (!title || !url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') continue;
      out.push({ title, url: parsed.toString() });
    } catch {
      continue;
    }
    if (out.length >= EXPLAIN_MAX_LINKS) break;
  }
  return out;
}

/** Checks a model reply (or a server reply) against the explanation shape. Null when it does not fit. */
export function validateExplainResult(data: unknown): ExplainResult | null {
  if (!isRecord(data)) return null;
  const why = clean(data.why, EXPLAIN_MAX_WHY_CHARS);
  if (!why) return null;
  const mistakesRaw = data.mistakes;
  if (!Array.isArray(mistakesRaw) || !mistakesRaw.every((m) => typeof m === 'string')) return null;
  const mistakes = mistakesRaw
    .map((m) => m.trim().slice(0, EXPLAIN_MAX_MISTAKE_CHARS))
    .filter(Boolean)
    .slice(0, EXPLAIN_MAX_MISTAKES);
  return { why, mistakes, links: cleanLinks(data.links) };
}

/** Reads the JSON object out of the model's text. Undefined when there is none. */
export function parseExplainText(text: string): unknown {
  try {
    return extractJson(text);
  } catch {
    return undefined;
  }
}
