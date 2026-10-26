import { callAnthropic } from './anthropic';
import { resolveApiKey } from './apiKey';
import { errorBody, json, type ApiHandler } from './types';

/**
 * POST /api/test-key -> { ok: true } or { ok: false, error: 'invalid_key' }.
 * Sends the smallest possible request. The key comes from the header, so a key can be tested before it is saved.
 */
export const testKeyHandler: ApiHandler = async (req, env) => {
  if (req.method !== 'POST') return json(405, errorBody('method_not_allowed'));
  const key = resolveApiKey(req, env);
  if (key.kind === 'missing') return json(503, errorBody('not_configured'));
  if (key.kind === 'invalid') return json(400, errorBody('invalid_api_key'));

  const upstream = await callAnthropic(key.key, {
    model: env.model,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'Reply with OK.' }],
  });
  if (upstream.ok) return json(200, { ok: true });
  if (upstream.status === 401 || upstream.status === 403) return json(200, { ok: false, error: 'invalid_key' });
  return json(502, errorBody('key_check_failed'));
};
