import type { Plugin } from 'vite';
import { apiDevPlugin } from './devRoutes';

/** Dev-server routes for the Ask-AI panels and the Settings key test. Logic lives in server/handlers/. */
export function assistPlugin(): Plugin {
  return apiDevPlugin('lab-companion-assist', ['/api/assist', '/api/troubleshoot', '/api/literature', '/api/test-key']);
}
