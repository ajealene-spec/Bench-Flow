import { parseWithRetry } from '../../src/features/import/aiSchema';
import { clipForModel, SYSTEM_PROMPT } from '../../src/features/import/parsePrompt';
import { callAnthropic, PARSE_MAX_BODY_BYTES, textOfBlocks } from './anthropic';
import { resolveApiKey } from './apiKey';
import { errorBody, json, type ApiHandler } from './types';

/**
 * GET  /api/parse -> { configured }
 * POST /api/parse body { text } -> { protocol, parser: 'ai' }
 *
 * The model returns one complete protocol object. It is validated here; a failed answer is sent
 * back once with the validation error (see parseWithRetry).
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

  // Long PDFs are cut to the model input limit. Evidence quotes must come from the clipped text the model saw.
  const source = clipForModel(text);
  let upstreamFailed = false;
  const ask = async (turns: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    const upstream = await callAnthropic(key.key, {
      model: env.model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: turns,
    });
    if (!upstream.ok) {
      upstreamFailed = true;
      return null;
    }
    return textOfBlocks(upstream.data.content);
  };

  const result = await parseWithRetry(ask, source);
  if (upstreamFailed) return json(502, errorBody('parse_failed'));
  if (!result.ok) return json(422, errorBody('model_output_invalid', result.error));
  return json(200, { protocol: result.protocol, parser: 'ai' });
};
