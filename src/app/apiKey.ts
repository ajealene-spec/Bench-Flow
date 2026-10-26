import { getSettings } from '../db/settings';
import type { LabCompanionDB } from '../db';

/** Header that carries the user's own Anthropic key to the app's /api routes. Matches server/handlers/apiKey.ts. */
export const API_KEY_HEADER = 'x-user-api-key';

/** Headers that attach the saved key, or none when no key is saved. Pure, so it is easy to test. */
export function keyHeaderFor(apiKey: string | undefined): Record<string, string> {
  const key = apiKey?.trim();
  return key ? { [API_KEY_HEADER]: key } : {};
}

/** Reads the saved key from local settings and returns the header for it. Never throws. */
export async function apiKeyHeaders(database?: LabCompanionDB): Promise<Record<string, string>> {
  try {
    const settings = await getSettings(database);
    return keyHeaderFor(settings.apiKey);
  } catch {
    return {};
  }
}

export type KeyTestResult = 'valid' | 'invalid' | 'missing' | 'unavailable';

/** Asks the app's own /api/test-key route whether a key works. The key travels only in the header. */
export async function testApiKey(key: string): Promise<KeyTestResult> {
  const headers = keyHeaderFor(key);
  if (!headers[API_KEY_HEADER]) return 'missing';
  try {
    const res = await fetch('/api/test-key', { method: 'POST', headers });
    if (res.status === 503) return 'missing';
    if (!res.ok) return 'unavailable';
    const data = (await res.json()) as { ok?: unknown };
    return data.ok === true ? 'valid' : 'invalid';
  } catch {
    return 'unavailable';
  }
}
