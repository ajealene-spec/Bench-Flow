import type { IncomingMessage, ServerResponse } from 'node:http';
import { corsHeaders } from './handlers/cors';
import { DEFAULT_MODEL, type ApiHandler, type ServerEnv } from './handlers/types';

/**
 * Turns an API handler into a Node request listener. Vite's dev middleware and Vercel's Node functions
 * both pass (req, res) in this shape, so the same handler serves both.
 */
export function createNodeListener(handler: ApiHandler, resolveEnv: () => ServerEnv) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const preParsed = (req as IncomingMessage & { body?: unknown }).body;
    const apiRequest = {
      method: req.method ?? 'GET',
      header(name: string): string | undefined {
        const value = req.headers[name.toLowerCase()];
        return Array.isArray(value) ? value.join(',') : value;
      },
      readBody(maxBytes: number): Promise<string> {
        // Vercel may pre-parse JSON bodies and consume the stream. Use the parsed copy when it is there.
        if (preParsed !== undefined) {
          const text = typeof preParsed === 'string' ? preParsed : JSON.stringify(preParsed);
          if (Buffer.byteLength(text) > maxBytes) return Promise.reject(Object.assign(new Error('too large'), { status: 413 }));
          return Promise.resolve(text);
        }
        return readStream(req, maxBytes);
      },
    };

    // CORS for the native app shells (see cors.ts). Preflight gets an empty 204 before any handler runs.
    const cors = corsHeaders(apiRequest.header('origin'));
    for (const [name, value] of Object.entries(cors)) res.setHeader(name, value);
    if (apiRequest.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      const result = await handler(apiRequest, resolveEnv());
      res.statusCode = result.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result.body));
    } catch {
      // Never send the error text: it may contain request details.
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'server_error' }));
    }
  };
}

function readStream(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Request body too large'), { status: 413 }));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Dev server: the key may come from .env or the shell. Fallback is allowed here only. */
export function devServerEnv(loaded: Record<string, string>): ServerEnv {
  return {
    fallbackApiKey: loaded.ANTHROPIC_API_KEY,
    allowEnvKeyFallback: true,
    model: loaded.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
  };
}

/**
 * Vercel: the owner's environment key is used only under `vercel dev` or plain Node. A deployed site
 * (VERCEL set, VERCEL_ENV preview or production) uses only the key each visitor sends.
 */
export function vercelServerEnv(): ServerEnv {
  const localDev = !process.env.VERCEL || process.env.VERCEL_ENV === 'development';
  return {
    fallbackApiKey: process.env.ANTHROPIC_API_KEY,
    allowEnvKeyFallback: localDev,
    model: process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL,
  };
}
