import { loadEnv, type Plugin } from 'vite';
import {
  buildLiteratureRequestBody,
  buildTroubleshootRequestBody,
  collectSearchResults,
  parseLiteratureRequest,
  parseModelJson,
  parseTroubleshootRequest,
  searchErrorOf,
  textOf,
  validateLiteratureResult,
  validateTroubleshootResult,
  type ContentBlock,
} from '../src/features/assist/assistPrompts';

/**
 * Dev-server endpoints for the Ask-AI panels. The API key is read from ANTHROPIC_API_KEY and never leaves the server.
 *   GET  /api/assist        -> { configured: boolean }
 *   POST /api/troubleshoot  body TroubleshootRequest -> { causes, quickChecks }
 *   POST /api/literature    body LiteratureRequest   -> { suggestions, summary }   (web search server tool)
 * Errors are generic: no key, upstream body or stack trace is ever sent to the browser.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_BODY_BYTES = 200_000;
/** The web search tool can pause a long turn; each pause is continued at most this many times. */
const MAX_PAUSE_CONTINUATIONS = 3;
const LITERATURE_UNAVAILABLE = 'literature search unavailable';

const ROUTES = ['/api/assist', '/api/troubleshoot', '/api/literature'] as const;

interface Req {
  method?: string;
  url?: string;
  on(event: string, cb: (chunk?: unknown) => void): unknown;
}

interface Res {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface MessageResponse {
  content?: ContentBlock[];
  stop_reason?: string;
}

function send(res: Res, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req: Req): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    req.on('data', (chunk) => {
      const bytes = chunk as Uint8Array;
      size += bytes.byteLength;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        return;
      }
      chunks.push(bytes);
    });
    req.on('end', () => {
      const merged = new Uint8Array(size);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      resolve(new TextDecoder().decode(merged));
    });
    req.on('error', (err) => reject(err));
  });
}

async function callMessages(apiKey: string, body: Record<string, unknown>): Promise<MessageResponse> {
  const upstream = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });
  if (!upstream.ok) {
    throw Object.assign(new Error(`Anthropic API responded ${upstream.status}`), { status: 502 });
  }
  return (await upstream.json()) as MessageResponse;
}

async function handleTroubleshoot(
  res: Res,
  input: unknown,
  apiKey: string,
  model: string,
): Promise<void> {
  const parsed = parseTroubleshootRequest(input);
  if (!parsed.ok) {
    send(res, 400, { error: parsed.error });
    return;
  }
  const data = await callMessages(apiKey, buildTroubleshootRequestBody(model, parsed.value));
  const json = parseModelJson(textOf(data.content ?? []));
  if (!json.ok) {
    send(res, 422, { error: json.error });
    return;
  }
  const result = validateTroubleshootResult(json.value);
  if (!result.ok) {
    send(res, 422, { error: 'model_output_invalid', message: result.error });
    return;
  }
  send(res, 200, result.value);
}

async function handleLiterature(res: Res, input: unknown, apiKey: string, model: string): Promise<void> {
  const parsed = parseLiteratureRequest(input);
  if (!parsed.ok) {
    send(res, 400, { error: parsed.error });
    return;
  }
  const body = buildLiteratureRequestBody(model, parsed.value);
  let data: MessageResponse;
  try {
    data = await callMessages(apiKey, body);
    // The server tool may pause a long turn. Send the assistant content back and let it continue.
    let pauses = 0;
    while (data.stop_reason === 'pause_turn' && pauses < MAX_PAUSE_CONTINUATIONS) {
      pauses += 1;
      body.messages = [
        ...(body.messages as unknown[]),
        { role: 'assistant', content: data.content ?? [] },
      ];
      data = await callMessages(apiKey, body);
    }
  } catch {
    send(res, 502, { error: LITERATURE_UNAVAILABLE });
    return;
  }

  const blocks = data.content ?? [];
  if (searchErrorOf(blocks) !== undefined) {
    send(res, 502, { error: LITERATURE_UNAVAILABLE });
    return;
  }
  const json = parseModelJson(textOf(blocks));
  if (!json.ok) {
    send(res, 422, { error: json.error });
    return;
  }
  // Keep only citations whose URLs the search actually returned.
  const found = new Set(collectSearchResults(blocks).keys());
  const result = validateLiteratureResult(json.value, found);
  if (!result.ok) {
    send(res, 422, { error: 'model_output_invalid', message: result.error });
    return;
  }
  send(res, 200, result.value);
}

async function handleAssist(path: string, req: Req, res: Res, env: Record<string, string>): Promise<void> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();

  if (path === '/api/assist') {
    if (req.method !== 'GET') {
      send(res, 405, { error: 'method_not_allowed' });
      return;
    }
    send(res, 200, { configured: Boolean(apiKey) });
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'method_not_allowed' });
    return;
  }
  if (!apiKey) {
    send(res, 503, { error: 'not_configured' });
    return;
  }

  try {
    const raw = await readBody(req);
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      send(res, 400, { error: 'invalid_json' });
      return;
    }
    const model = env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
    if (path === '/api/troubleshoot') {
      await handleTroubleshoot(res, input, apiKey, model);
    } else {
      await handleLiterature(res, input, apiKey, model);
    }
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    console.error(`[assist] ${path} failed with status ${status}`);
    send(res, status, { error: status === 413 ? 'body_too_large' : 'request_failed' });
  }
}

export function assistPlugin(): Plugin {
  let env: Record<string, string> = {};
  return {
    name: 'lab-companion-assist',
    apply: 'serve',
    configResolved(config) {
      // Loads .env and .env.* from the project root, plus exported shell variables.
      env = loadEnv(config.mode, config.root, '');
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const request = req as unknown as Req;
        const path = (request.url ?? '').split('?')[0];
        if (!(ROUTES as readonly string[]).includes(path)) {
          next();
          return;
        }
        void handleAssist(path, request, res as unknown as Res, env);
      });
    },
  };
}
