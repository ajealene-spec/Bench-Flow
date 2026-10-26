// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { API_KEY_HEADER } from './apiKey';
import { assistHandler } from './assist';
import { explainHandler } from './explain';
import type { ApiRequest, ServerEnv } from './types';

const USER_KEY = 'sk-ant-api03-user-owned-test-key';
const env: ServerEnv = { allowEnvKeyFallback: false, model: 'test-model' };
const BODY = JSON.stringify({ kind: 'explain', protocolTitle: 'Western blot', title: 'Block', instructions: 'Block in 5% milk for 1 h.' });

function request(method: string, headers: Record<string, string> = {}, body = ''): ApiRequest {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { method, header: (name) => lower[name.toLowerCase()], readBody: async () => body };
}

/** A Messages API reply whose text block is the given string. */
function anthropicReply(text: string, status = 200): Response {
  return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status });
}

let fetchMock: MockInstance<typeof fetch>;

beforeEach(() => {
  fetchMock = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/assist explain', () => {
  it('returns why, mistakes and https links from the model reply', async () => {
    fetchMock.mockResolvedValueOnce(
      anthropicReply(
        '```json\n' +
          JSON.stringify({
            why: 'Milk blocks sticky spots so antibodies bind only the target.',
            mistakes: ['Blocking too briefly'],
            links: [
              { title: 'Protocol A', url: 'https://www.protocols.io/view/example' },
              { title: 'Unsafe', url: 'http://insecure.example' },
            ],
          }) +
          '\n```',
      ),
    );

    const result = await explainHandler(request('POST', { [API_KEY_HEADER]: USER_KEY }, BODY), env);

    expect(result).toEqual({
      status: 200,
      body: {
        why: 'Milk blocks sticky spots so antibodies bind only the target.',
        mistakes: ['Blocking too briefly'],
        links: [{ title: 'Protocol A', url: 'https://www.protocols.io/view/example' }],
      },
    });
  });

  it('sends the step and protocol title to Anthropic with the user key in the header only', async () => {
    fetchMock.mockResolvedValueOnce(anthropicReply(JSON.stringify({ why: 'Because.', mistakes: [], links: [] })));

    await explainHandler(request('POST', { [API_KEY_HEADER]: USER_KEY }, BODY), env);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(USER_KEY);
    const sent = JSON.parse(String(init.body));
    expect(sent.model).toBe('test-model');
    expect(sent.messages[0].content).toContain('Western blot');
    expect(sent.messages[0].content).toContain('Block in 5% milk for 1 h.');
    expect(JSON.stringify(sent)).not.toContain(USER_KEY);
  });

  it('asks for a key when none is sent, without calling Anthropic', async () => {
    const result = await explainHandler(request('POST', {}, BODY), env);
    expect(result.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed key and a body without a title', async () => {
    expect((await explainHandler(request('POST', { [API_KEY_HEADER]: 'bad key' }, BODY), env)).status).toBe(400);
    const noTitle = JSON.stringify({ kind: 'explain', instructions: 'Block.' });
    expect(await explainHandler(request('POST', { [API_KEY_HEADER]: USER_KEY }, noTitle), env)).toEqual({
      status: 400,
      body: { error: 'missing_title' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a model reply that is not the expected JSON, without echoing it', async () => {
    fetchMock.mockResolvedValueOnce(anthropicReply('I cannot help with that.'));
    const result = await explainHandler(request('POST', { [API_KEY_HEADER]: USER_KEY }, BODY), env);
    expect(result).toEqual({ status: 422, body: { error: 'model_output_not_json' } });
    expect(JSON.stringify(result)).not.toContain('cannot help');
  });

  it('reports a model reply with the wrong shape', async () => {
    fetchMock.mockResolvedValueOnce(anthropicReply(JSON.stringify({ why: '', mistakes: 'none' })));
    const result = await explainHandler(request('POST', { [API_KEY_HEADER]: USER_KEY }, BODY), env);
    expect(result).toEqual({ status: 422, body: { error: 'model_output_invalid' } });
  });

  it('returns a generic 502 when Anthropic fails, without its body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(`{"error":"bad key ${USER_KEY}"}`, { status: 500 }));
    const result = await explainHandler(request('POST', { [API_KEY_HEADER]: USER_KEY }, BODY), env);
    expect(result).toEqual({ status: 502, body: { error: 'request_failed' } });
    expect(JSON.stringify(result)).not.toContain(USER_KEY);
  });

  it('rejects other methods', async () => {
    expect((await explainHandler(request('PUT', { [API_KEY_HEADER]: USER_KEY }, BODY), env)).status).toBe(405);
  });
});

describe('/api/assist routing', () => {
  it('keeps GET as the configuration check and sends POST to explain', async () => {
    expect(await assistHandler(request('GET', { [API_KEY_HEADER]: USER_KEY }), env)).toEqual({ status: 200, body: { configured: true } });
    fetchMock.mockResolvedValueOnce(anthropicReply(JSON.stringify({ why: 'Ok.', mistakes: [], links: [] })));
    const posted = await assistHandler(request('POST', { [API_KEY_HEADER]: USER_KEY }, BODY), env);
    expect(posted.status).toBe(200);
    expect(posted.body).toMatchObject({ why: 'Ok.' });
  });
});
