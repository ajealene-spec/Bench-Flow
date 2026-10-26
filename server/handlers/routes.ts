import { assistConfigHandler } from './assist';
import { literatureHandler } from './literature';
import { parseHandler } from './parse';
import { testKeyHandler } from './testKey';
import { troubleshootHandler } from './troubleshoot';
import type { ApiHandler } from './types';

/** Every /api route. The dev plugins and the Vercel functions both serve from this table. */
export const API_ROUTES: Readonly<Record<string, ApiHandler>> = {
  '/api/parse': parseHandler,
  '/api/assist': assistConfigHandler,
  '/api/troubleshoot': troubleshootHandler,
  '/api/literature': literatureHandler,
  '/api/test-key': testKeyHandler,
};
