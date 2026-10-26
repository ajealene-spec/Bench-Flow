// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { API_KEY_HEADER, resolveApiKey } from './apiKey';
import { parseHandler } from './parse';
import { testKeyHandler } from './testKey';
import { assistConfigHandler } from './assist';
import { createNodeListener, vercelServerEnv } from '../nodeAdapter';
import type { ApiRequest, ServerEnv } from './types';

const USER_KEY = 'sk-ant-api03-user-owned-test-key';
const ENV_KEY = 'sk-ant-api03-owner-env-key';

const devEnv: ServerEnv = { fallbackApiKey: ENV_KEY, allowEnvKeyFallback: true, model: 'test-model' };
const prodEnv: ServerEnv = { fallbackApiKey: ENV_KEY, allowEnvKeyFallback: false, model: 'test-model' };
const noKeyEnv: ServerEnv = { allowEnvKeyFallback: false, model: 'test-model' };

function request(method: string, headers: Record<string, string> = {}, body = ''): ApiRequest {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method,
    header: (name) => lower[name.toLowerCase()],
    readBody: async () => body,
  };
}

const PARSE_BODY = JSON.stringify({ text: '1. Add 10 uL of buffer to each tube.' });

let fetchMock: MockInstance<typeof fetch>;
let consoleSpies: Array<MockInstance<(...args: unknown[]) => void>>;

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ content: [{ type: 'text', text: 'not json' }] }), { status: 200 }),
  );
  consoleSpies = [
    vi.spyOn(console, 'log'),
    vi.spyOn(console, 'error'),
    vi.spyOn(console, 'warn'),
    vi.spyOn(console, 'info'),
  ];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Everything the server printed. A key must never appear here. */
function loggedText(): string {
  return consoleSpies.flatMap((spy) => spy.mock.calls.map((args) => JSON.stringify(args))).join('\n');
}

describe('resolveApiKey', () => {
  it('uses the key from the request header, trimmed, ahead of the environment key', () => {
    const result = resolveApiKey(request('POST', { [API_KEY_HEADER]: `  ${USER_KEY}  ` }), devEnv);
    expect(result).toEqual({ kind: 'key', key: USER_KEY, source: 'header' });
  });

  it('falls back to the environment key only when the environment allows it', () => {
    expect(resolveApiKey(request('POST'), devEnv)).toEqual({ kind: 'key', key: ENV_KEY, source: 'environment' });
    expect(resolveApiKey(request('POST'), prodEnv)).toEqual({ kind: 'missing' });
  });

  it('reports missing when there is no header and no allowed fallback', () => {
    expect(resolveApiKey(request('POST'), noKeyEnv)).toEqual({ kind: 'missing' });
    expect(resolveApiKey(request('POST', { [API_KEY_HEADER]: '   ' }), noKeyEnv)).toEqual({ kind: 'missing' });
  });

  it('rejects a malformed header instead of replacing it with the environment key', () => {
    expect(resolveApiKey(request('POST', { [API_KEY_HEADER]: 'sk ant with spaces' }), devEnv)).toEqual({ kind: 'invalid' });
    expect(resolveApiKey(request('POST', { [API_KEY_HEADER]: 'k'.repeat(301) }), devEnv)).toEqual({ kind: 'invalid' });
  });
});

describe('/api/parse key handling', () => {
  it('reports configured from the header alone in production', async () => {
    const withHeader = await parseHandler(request('GET', { [API_KEY_HEADER]: USER_KEY }), prodEnv);
    const withoutHeader = await parseHandler(request('GET'), prodEnv);
    expect(withHeader).toEqual({ status: 200, body: { configured: true } });
    expect(withoutHeader).toEqual({ status: 200, body: { configured: false } });
  });

  it('forwards the user key to Anthropic as x-api-key and never echoes it', async () => {
    const result = await parseHandler(request('POST', { [API_KEY_HEADER]: USER_KEY }, PARSE_BODY), prodEnv);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(USER_KEY);
    expect(JSON.stringify(result)).not.toContain(USER_KEY);
    expect(loggedText()).not.toContain(USER_KEY);
  });

  it('does not call Anthropic without a key, and does not use the owner key in production', async () => {
    const result = await parseHandler(request('POST', {}, PARSE_BODY), prodEnv);
    expect(result.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the owner key only in local development', async () => {
    await parseHandler(request('POST', {}, PARSE_BODY), devEnv);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(ENV_KEY);
  });

  it('rejects a malformed key before any upstream call', async () => {
    const result = await parseHandler(request('POST', { [API_KEY_HEADER]: 'bad key' }, PARSE_BODY), prodEnv);
    expect(result).toEqual({ status: 400, body: { error: 'invalid_api_key' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('/api/test-key', () => {
  it('reports a valid key', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const result = await testKeyHandler(request('POST', { [API_KEY_HEADER]: USER_KEY }), prodEnv);
    expect(result).toEqual({ status: 200, body: { ok: true } });
  });

  it('reports a rejected key without echoing the upstream body or the key', async () => {
    fetchMock.mockResolvedValueOnce(new Response(`{"error":"invalid x-api-key ${USER_KEY}"}`, { status: 401 }));
    const result = await testKeyHandler(request('POST', { [API_KEY_HEADER]: USER_KEY }), prodEnv);
    expect(result).toEqual({ status: 200, body: { ok: false, error: 'invalid_key' } });
    expect(JSON.stringify(result)).not.toContain(USER_KEY);
  });

  it('asks for a key when none is sent', async () => {
    const result = await testKeyHandler(request('POST'), prodEnv);
    expect(result.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('/api/assist configuration', () => {
  it('reports configured based on the header', async () => {
    expect((await assistConfigHandler(request('GET', { [API_KEY_HEADER]: USER_KEY }), prodEnv)).body).toEqual({ configured: true });
    expect((await assistConfigHandler(request('GET'), prodEnv)).body).toEqual({ configured: false });
  });
});

describe('Node listener', () => {
  /** Minimal stand-ins for the Node request and response the listener touches. */
  function nodeReq(method: string, headers: Record<string, string>, body: string) {
    const listeners: Record<string, Array<(chunk?: unknown) => void>> = {};
    const req = {
      method,
      headers,
      on(event: string, cb: (chunk?: unknown) => void) {
        (listeners[event] ??= []).push(cb);
        if (event === 'end') queueMicrotask(() => {
          if (body) listeners.data?.forEach((cb2) => cb2(Buffer.from(body)));
          listeners.end?.forEach((cb2) => cb2());
        });
        return req;
      },
      resume() {},
    };
    return req;
  }

  function nodeRes() {
    const res = { statusCode: 0, headers: {} as Record<string, string>, body: '' };
    return {
      res: {
        get statusCode() { return res.statusCode; },
        set statusCode(v: number) { res.statusCode = v; },
        setHeader(name: string, value: string) { res.headers[name] = value; },
        end(text?: string) { res.body = text ?? ''; },
      },
      res_: res,
    };
  }

  it('passes the header through and writes the JSON result', async () => {
    const listener = createNodeListener(parseHandler, () => prodEnv);
    const { res, res_ } = nodeRes();
    // The Node request object has lowercase header keys, which the listener relies on.
    const req = nodeReq('GET', { [API_KEY_HEADER]: USER_KEY }, '');
    await listener(req as never, res as never);
    expect(res_.statusCode).toBe(200);
    expect(JSON.parse(res_.body)).toEqual({ configured: true });
    expect(res_.body).not.toContain(USER_KEY);
  });

  it('returns a generic error when a handler throws, with no details', async () => {
    const boom = async () => {
      throw new Error(`leaked ${USER_KEY}`);
    };
    const listener = createNodeListener(boom, () => prodEnv);
    const { res, res_ } = nodeRes();
    await listener(nodeReq('POST', {}, '') as never, res as never);
    expect(res_.statusCode).toBe(500);
    expect(res_.body).toBe(JSON.stringify({ error: 'server_error' }));
  });
});

describe('vercelServerEnv', () => {
  it('allows the owner key only outside a deployed Vercel site', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', ENV_KEY);

    vi.stubEnv('VERCEL', '');
    expect(vercelServerEnv().allowEnvKeyFallback).toBe(true);

    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_ENV', 'development');
    expect(vercelServerEnv().allowEnvKeyFallback).toBe(true);

    vi.stubEnv('VERCEL_ENV', 'production');
    expect(vercelServerEnv().allowEnvKeyFallback).toBe(false);
    expect(vercelServerEnv().fallbackApiKey).toBe(ENV_KEY);

    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(vercelServerEnv().allowEnvKeyFallback).toBe(false);
  });
});
