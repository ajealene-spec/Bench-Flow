import { explainHandler } from './explain';
import { resolveApiKey } from './apiKey';
import { errorBody, json, type ApiHandler } from './types';

/** GET /api/assist -> { configured }. Tells the client whether a key is available for the Ask-AI panels. */
export const assistConfigHandler: ApiHandler = async (req, env) => {
  if (req.method !== 'GET') return json(405, errorBody('method_not_allowed'));
  return json(200, { configured: resolveApiKey(req, env).kind === 'key' });
};

/**
 * /api/assist. GET reports whether a key is configured. POST with kind "explain" returns a beginner
 * explanation of one step (see explain.ts).
 */
export const assistHandler: ApiHandler = async (req, env) => {
  if (req.method === 'GET') return assistConfigHandler(req, env);
  if (req.method === 'POST') return explainHandler(req, env);
  return json(405, errorBody('method_not_allowed'));
};
