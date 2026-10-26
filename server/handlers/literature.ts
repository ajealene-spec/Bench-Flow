import {
  buildLiteratureRequestBody,
  collectSearchResults,
  parseLiteratureRequest,
  parseModelJson,
  searchErrorOf,
  textOf,
  validateLiteratureResult,
  type ContentBlock,
} from '../../src/features/assist/assistPrompts';
import { ASSIST_MAX_BODY_BYTES, callAnthropic, type MessageResponse } from './anthropic';
import { resolveApiKey } from './apiKey';
import { readJson } from './body';
import { errorBody, json, type ApiHandler } from './types';

/** The web search tool can pause a long turn; each pause is continued at most this many times. */
const MAX_PAUSE_CONTINUATIONS = 3;
const LITERATURE_UNAVAILABLE = 'literature search unavailable';

/** POST /api/literature body LiteratureRequest -> { suggestions, summary } (web search server tool). */
export const literatureHandler: ApiHandler = async (req, env) => {
  if (req.method !== 'POST') return json(405, errorBody('method_not_allowed'));
  const key = resolveApiKey(req, env);
  if (key.kind === 'missing') return json(503, errorBody('not_configured'));
  if (key.kind === 'invalid') return json(400, errorBody('invalid_api_key'));

  const input = await readJson(req, ASSIST_MAX_BODY_BYTES);
  if (!input.ok) return input.response;
  const parsed = parseLiteratureRequest(input.value);
  if (!parsed.ok) return json(400, errorBody(parsed.error));

  const body = buildLiteratureRequestBody(env.model, parsed.value);
  let upstream = await callAnthropic(key.key, body);
  if (!upstream.ok) return json(502, errorBody(LITERATURE_UNAVAILABLE));

  // The server tool may pause a long turn. Send the assistant content back and let it continue.
  let data: MessageResponse = upstream.data;
  let pauses = 0;
  while (data.stop_reason === 'pause_turn' && pauses < MAX_PAUSE_CONTINUATIONS) {
    pauses += 1;
    body.messages = [...(body.messages as unknown[]), { role: 'assistant', content: data.content ?? [] }];
    upstream = await callAnthropic(key.key, body);
    if (!upstream.ok) return json(502, errorBody(LITERATURE_UNAVAILABLE));
    data = upstream.data;
  }

  const blocks = (data.content ?? []) as ContentBlock[];
  if (searchErrorOf(blocks) !== undefined) return json(502, errorBody(LITERATURE_UNAVAILABLE));
  const parsedJson = parseModelJson(textOf(blocks));
  if (!parsedJson.ok) return json(422, errorBody(parsedJson.error));
  // Keep only citations whose URLs the search actually returned.
  const found = new Set(collectSearchResults(blocks).keys());
  const result = validateLiteratureResult(parsedJson.value, found);
  if (!result.ok) return json(422, errorBody('model_output_invalid', result.error));
  return json(200, result.value);
};
