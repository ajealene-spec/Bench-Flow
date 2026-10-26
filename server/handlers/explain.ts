import {
  buildExplainRequestBody,
  EXPLAIN_MAX_BODY_CHARS,
  parseExplainRequest,
  parseExplainText,
  validateExplainResult,
} from '../../src/features/learn/explainPrompts';
import { callAnthropic, textOfBlocks } from './anthropic';
import { resolveApiKey } from './apiKey';
import { readJson } from './body';
import { errorBody, json, type ApiHandler } from './types';

/** Largest body the explain action accepts. Matches the client-side cap on the step text. */
const EXPLAIN_MAX_BODY_BYTES = EXPLAIN_MAX_BODY_CHARS * 4;

/**
 * POST /api/assist with { kind: "explain", protocolTitle, title, instructions }
 * -> { why, mistakes[], links[] }. The step text is sent to Anthropic with the user's key in the header.
 */
export const explainHandler: ApiHandler = async (req, env) => {
  if (req.method !== 'POST') return json(405, errorBody('method_not_allowed'));
  const key = resolveApiKey(req, env);
  if (key.kind === 'missing') return json(503, errorBody('not_configured'));
  if (key.kind === 'invalid') return json(400, errorBody('invalid_api_key'));

  const input = await readJson(req, EXPLAIN_MAX_BODY_BYTES);
  if (!input.ok) return input.response;
  const parsed = parseExplainRequest(input.value);
  if (!parsed.ok) return json(400, errorBody(parsed.error));

  const upstream = await callAnthropic(key.key, buildExplainRequestBody(env.model, parsed.value));
  if (!upstream.ok) return json(502, errorBody('request_failed'));
  const parsedJson = parseExplainText(textOfBlocks(upstream.data.content));
  if (parsedJson === undefined) return json(422, errorBody('model_output_not_json'));
  const result = validateExplainResult(parsedJson);
  if (!result) return json(422, errorBody('model_output_invalid'));
  return json(200, result);
};
