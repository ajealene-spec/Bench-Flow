import { parseAiSteps } from '../../src/features/import/aiSchema';
import { clipForModel, SYSTEM_PROMPT } from '../../src/features/import/parsePrompt';
import { callAnthropic, PARSE_MAX_BODY_BYTES, textOfBlocks } from './anthropic';
import { resolveApiKey } from './apiKey';
import { errorBody, json, type ApiHandler } from './types';

/**
 * GET  /api/parse -> { configured }
 * POST /api/parse body { text } -> { aiSteps, parser: 'ai' }
 */
export const parseHandler: ApiHandler = async (req, env) => {
  const key = resolveApiKey(req, env);

  if (req.method === 'GET') {
    return json(200, { configured: key.kind === 'key' });
  }
  if (req.method !== 'POST') return json(405, errorBody('method_not_allowed'));
  if (key.kind === 'missing') return json(503, errorBody('not_configured', 'Add an Anthropic API key in Settings'));
  if (key.kind === 'invalid') return json(400, errorBody('invalid_api_key'));

  let raw: string;
  try {
    raw = await req.readBody(PARSE_MAX_BODY_BYTES);
  } catch {
    return json(413, errorBody('body_too_large'));
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, errorBody('invalid_json'));
  }
  const text = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.trim() : '';
  if (!text) return json(400, errorBody('empty_text'));

  // Long PDFs are cut to the model input limit; the start of a protocol carries the steps.
  const upstream = await callAnthropic(key.key, {
    model: env.model,
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: clipForModel(text) }],
  });
  if (!upstream.ok) return json(502, errorBody('parse_failed'));

  const result = parseAiSteps(textOfBlocks(upstream.data.content));
  if (!result.ok) return json(422, errorBody('model_output_invalid', result.error));
  return json(200, { aiSteps: result.steps, parser: 'ai' });
};
