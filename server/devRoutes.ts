import { loadEnv, type Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { API_ROUTES } from './handlers/routes';
import { createNodeListener, devServerEnv } from './nodeAdapter';

/**
 * Serves the listed /api paths from the Vite dev server. Other requests fall through to Vite.
 * The key comes from the x-user-api-key header; ANTHROPIC_API_KEY from .env is a dev-only fallback.
 */
export function apiDevPlugin(name: string, paths: readonly string[]): Plugin {
  let loaded: Record<string, string> = {};
  return {
    name,
    apply: 'serve',
    configResolved(config) {
      // loadEnv reads .env and .env.* from the project root, plus exported shell variables.
      loaded = loadEnv(config.mode, config.root, '');
    },
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        const path = (req.url ?? '').split('?')[0];
        const handler = API_ROUTES[path];
        if (!paths.includes(path) || !handler) {
          next();
          return;
        }
        void createNodeListener(handler, () => devServerEnv(loaded))(req, res);
      });
    },
  };
}
