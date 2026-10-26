import { loadEnv, type Plugin } from 'vite';
import { extractJson, validateParsedProcedure } from '../src/features/import/validateSteps';
import { clipForModel, SYSTEM_PROMPT } from '../src/features/import/parsePrompt';

/**
 * Dev-server endpoint that turns lab text into structured steps with the Claude Messages API.
 *   GET  /api/parse  -> { configured: boolean }
 *   POST /api/parse  body { text } -> { title?, steps, parser: 'ai' }
 * The API key is read from ANTHROPIC_API_KEY (.env or the shell) and never leaves the server.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const MAX_BODY_BYTES = 1_000_000;

interface Req {
  method?: string;
  on(event: string, cb: (chunk?: unknown) => void): unknown;
}

interface Res {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
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

async function callClaude(apiKey: string, model: string, text: string): Promise<string> {
  const upstream = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 6000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: text }],
    }),
  });
  if (!upstream.ok) {
    throw Object.assign(new Error(`Anthropic API responded ${upstream.status}`), { status: 502 });
  }
  const data = (await upstream.json()) as { content?: Array<{ type: string; text?: string }> };
  return (data.content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}

async function handleParse(req: Req, res: Res, env: Record<string, string>): Promise<void> {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();

  if (req.method === 'GET') {
    send(res, 200, { configured: Boolean(apiKey) });
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { error: 'method_not_allowed' });
    return;
  }
  if (!apiKey) {
    send(res, 503, { error: 'not_configured', message: 'ANTHROPIC_API_KEY is not set' });
    return;
  }

  try {
    const raw = await readBody(req);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      send(res, 400, { error: 'invalid_json' });
      return;
    }
    const text = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.trim() : '';
    if (!text) {
      send(res, 400, { error: 'empty_text' });
      return;
    }
    // Long PDFs are cut to the model input limit; the start of a protocol carries the steps.
    const model = env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
    const modelText = await callClaude(apiKey, model, clipForModel(text));

    let parsed: unknown;
    try {
      parsed = extractJson(modelText);
    } catch {
      send(res, 422, { error: 'model_output_not_json' });
      return;
    }
    const result = validateParsedProcedure(parsed);
    if (!result.ok) {
      send(res, 422, { error: 'model_output_invalid', message: result.error });
      return;
    }
    send(res, 200, { title: result.title, steps: result.steps, hazards: result.hazards, parser: 'ai' });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    console.error('[parse] failed:', (err as Error).message);
    send(res, status, { error: status === 413 ? 'body_too_large' : 'parse_failed' });
  }
}

export function parsePlugin(): Plugin {
  let env: Record<string, string> = {};
  return {
    name: 'lab-companion-parse',
    apply: 'serve',
    configResolved(config) {
      // Loads .env and .env.* from the project root, plus exported shell variables.
      env = loadEnv(config.mode, config.root, '');
    },
    configureServer(server) {
      server.middlewares.use('/api/parse', (req, res) => {
        void handleParse(req as unknown as Req, res as unknown as Res, env);
      });
    },
  };
}
