import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { LabCompanionDB } from '../db';
import { putSettings } from '../db/settings';
import { API_KEY_HEADER, apiKeyHeaders, keyHeaderFor, testApiKey } from './apiKey';

describe('client API key header', () => {
  it('uses the agreed header name', () => {
    expect(API_KEY_HEADER).toBe('x-user-api-key');
  });

  it('attaches a trimmed saved key and nothing when no key is saved', () => {
    expect(keyHeaderFor('  sk-ant-test  ')).toEqual({ 'x-user-api-key': 'sk-ant-test' });
    expect(keyHeaderFor('   ')).toEqual({});
    expect(keyHeaderFor(undefined)).toEqual({});
  });

  it('reads the key from local settings', async () => {
    const db = new LabCompanionDB(`apikey-${crypto.randomUUID()}`);
    await db.open();
    expect(await apiKeyHeaders(db)).toEqual({});
    await putSettings({ apiKey: 'sk-ant-local' }, db);
    expect(await apiKeyHeaders(db)).toEqual({ 'x-user-api-key': 'sk-ant-local' });
    db.close();
  });
});

describe('testApiKey', () => {
  it('sends the key only in the header and maps the server answer', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fake = (body: unknown, status = 200) => async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify(body), { status });
    };
    const original = globalThis.fetch;
    try {
      globalThis.fetch = fake({ ok: true }) as typeof fetch;
      expect(await testApiKey('sk-ant-typed')).toBe('valid');
      expect(calls[0].url).toBe('/api/test-key');
      expect((calls[0].init.headers as Record<string, string>)[API_KEY_HEADER]).toBe('sk-ant-typed');
      expect(calls[0].url).not.toContain('sk-ant');

      globalThis.fetch = fake({ ok: false, error: 'invalid_key' }) as typeof fetch;
      expect(await testApiKey('sk-ant-bad')).toBe('invalid');

      expect(await testApiKey('   ')).toBe('missing');

      globalThis.fetch = fake({ error: 'not_configured' }, 503) as typeof fetch;
      expect(await testApiKey('sk-ant-x')).toBe('missing');

      globalThis.fetch = (async () => {
        throw new TypeError('offline');
      }) as typeof fetch;
      expect(await testApiKey('sk-ant-x')).toBe('unavailable');
    } finally {
      globalThis.fetch = original;
    }
  });
});
