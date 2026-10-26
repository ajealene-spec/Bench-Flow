import { buildTroubleshootRequestBody, parseModelJson, parseTroubleshootRequest, textOf, validateTroubleshootResult } from '../../src/features/assist/assistPrompts';
import { callAnthropic, ASSIST_MAX_BODY_BYTES } from './anthropic';
import { resolveApiKey } from './apiKey';
import { readJson } from './body';
import { errorBody, json, type ApiHandler } from './types';

/** POST /api/troubleshoot body TroubleshootRequest -> { causes, quickChecks }. */
export const troubleshootHandler: ApiHandler = async (req, env) => {
  if (req.method !== 'POST') return json(405, errorBody('method_not_allowed'));
  const key = resolveApiKey(req, env);
  if (key.kind === 'missing') return json(503, errorBody('not_configured'));
  if (key.kind === 'invalid') return json(400, errorBody('invalid_api_key'));

  const input = await readJson(req, ASSIST_MAX_BODY_BYTES);
  if (!input.ok) return input.response;
  const parsed = parseTroubleshootRequest(input.value);
  if (!parsed.ok) return json(400, errorBody(parsed.error));

  const upstream = await callAnthropic(key.key, buildTroubleshootRequestBody(env.model, parsed.value));
  if (!upstream.ok) return json(502, errorBody('request_failed'));
  const parsedJson = parseModelJson(textOf(upstream.data.content ?? []));
  if (!parsedJson.ok) return json(422, errorBody(parsedJson.error));
  const result = validateTroubleshootResult(parsedJson.value);
  if (!result.ok) return json(422, errorBody('model_output_invalid', result.error));
  return json(200, result.value);
};
