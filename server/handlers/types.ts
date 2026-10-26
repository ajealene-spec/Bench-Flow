/**
 * Framework-free request and response types for the /api routes. The Vite dev plugins and the Vercel
 * functions both adapt their Node request to these, so the logic is written once and tested directly.
 */

export interface ApiRequest {
  method: string;
  /** Case-insensitive header lookup. */
  header(name: string): string | undefined;
  /** Reads the raw body. Throws with status 413 when it is larger than maxBytes. */
  readBody(maxBytes: number): Promise<string>;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface ServerEnv {
  /** Server-side key from the environment. Only used when allowEnvKeyFallback is true. */
  fallbackApiKey?: string;
  /** True in local development only. Production never spends the owner's key on other people's requests. */
  allowEnvKeyFallback: boolean;
  model: string;
}

export type ApiHandler = (req: ApiRequest, env: ServerEnv) => Promise<ApiResponse>;

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

export function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}

export function errorBody(error: string, message?: string): { error: string; message?: string } {
  return message === undefined ? { error } : { error, message };
}
