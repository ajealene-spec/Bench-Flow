import { assistConfigHandler } from '../server/handlers/assist';
import { createNodeListener, vercelServerEnv } from '../server/nodeAdapter';

// Vercel serverless function. Logic lives in server/handlers/assist.ts; see server/nodeAdapter.ts for env rules.
export default createNodeListener(assistConfigHandler, vercelServerEnv);
