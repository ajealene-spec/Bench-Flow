import type { ApiRequest, ServerEnv } from './types';

/** The header the browser uses to send the user's own Anthropic key. Never logged, never echoed back. */
export const API_KEY_HEADER = 'x-user-api-key';

const MAX_KEY_LENGTH = 300;
/** Printable ASCII without spaces. Anything else is not a key and is rejected before it reaches a header. */
const KEY_PATTERN = /^[\x21-\x7e]+$/;

export type KeyResolution =
  | { kind: 'key'; key: string; source: 'header' | 'environment' }
  | { kind: 'missing' }
  | { kind: 'invalid' };

/**
 * Picks the key for one request. The request's own header wins. The server's environment key is used
 * only when the environment allows it (local development). A malformed header is rejected, not replaced.
 */
export function resolveApiKey(req: ApiRequest, env: ServerEnv): KeyResolution {
  const header = req.header(API_KEY_HEADER)?.trim();
  if (header) {
    return header.length <= MAX_KEY_LENGTH && KEY_PATTERN.test(header)
      ? { kind: 'key', key: header, source: 'header' }
      : { kind: 'invalid' };
  }
  const fallback = env.fallbackApiKey?.trim();
  if (env.allowEnvKeyFallback && fallback) {
    return { kind: 'key', key: fallback, source: 'environment' };
  }
  return { kind: 'missing' };
}
