import type { Plugin } from 'vite';
import { apiDevPlugin } from './devRoutes';

/** Dev-server route for procedure parsing. Logic lives in server/handlers/parse.ts. */
export function parsePlugin(): Plugin {
  return apiDevPlugin('lab-companion-parse', ['/api/parse']);
}
