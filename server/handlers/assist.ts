import { resolveApiKey } from './apiKey';
import { errorBody, json, type ApiHandler } from './types';

/** GET /api/assist -> { configured }. Tells the client whether a key is available for the Ask-AI panels. */
export const assistConfigHandler: ApiHandler = async (req, env) => {
  if (req.method !== 'GET') return json(405, errorBody('method_not_allowed'));
  return json(200, { configured: resolveApiKey(req, env).kind === 'key' });
};
