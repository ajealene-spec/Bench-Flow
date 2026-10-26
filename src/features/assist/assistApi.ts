import {
  validateLiteratureResult,
  validateTroubleshootResult,
  type LiteratureRequest,
  type LiteratureResult,
  type TroubleshootRequest,
  type TroubleshootResult,
} from './assistPrompts';
import { apiKeyHeaders } from '../../app/apiKey';

export type AssistCall<T> = { ok: true; value: T } | { ok: false; error: string };

/** Whether the dev server has an API key. False when the server is unreachable. */
export async function fetchAssistConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/assist', { method: 'GET', headers: await apiKeyHeaders() });
    if (!res.ok) return false;
    const data = (await res.json()) as { configured?: unknown };
    return data.configured === true;
  } catch {
    return false;
  }
}

async function post(path: string, body: unknown): Promise<{ status: number; data: unknown } | { error: string }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await apiKeyHeaders()) },
      body: JSON.stringify(body),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  } catch {
    return { error: 'network' };
  }
}

function errorOf(data: unknown, fallback: string): string {
  const code = (data as { error?: unknown })?.error;
  return typeof code === 'string' && code ? code : fallback;
}

export async function requestTroubleshoot(req: TroubleshootRequest): Promise<AssistCall<TroubleshootResult>> {
  const res = await post('/api/troubleshoot', req);
  if ('error' in res) return { ok: false, error: 'offline' };
  if (res.status !== 200) return { ok: false, error: errorOf(res.data, 'troubleshoot_failed') };
  const parsed = validateTroubleshootResult(res.data);
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, error: parsed.error };
}

export async function requestLiterature(req: LiteratureRequest): Promise<AssistCall<LiteratureResult>> {
  const res = await post('/api/literature', req);
  if ('error' in res) return { ok: false, error: 'offline' };
  if (res.status !== 200) return { ok: false, error: errorOf(res.data, 'literature search unavailable') };
  const parsed = validateLiteratureResult(res.data);
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, error: parsed.error };
}

