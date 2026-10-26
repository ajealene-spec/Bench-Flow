import { API_KEY_HEADER } from './apiKey';

/**
 * Origins allowed to call the /api routes from another origin. The iOS and Android Capacitor shells
 * load the app from these origins, so their fetches are cross-origin to the Vercel deployment.
 * Browsers on the site itself are same-origin and need no headers.
 */
export const ALLOWED_ORIGINS: readonly string[] = ['capacitor://localhost', 'https://localhost'];

/** CORS headers for a request origin. Empty when the origin is not in the allow list. */
export function corsHeaders(origin: string | undefined): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': `content-type, ${API_KEY_HEADER}`,
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
