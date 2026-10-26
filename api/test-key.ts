import { testKeyHandler } from '../server/handlers/testKey';
import { createNodeListener, vercelServerEnv } from '../server/nodeAdapter';

// Vercel serverless function. Logic lives in server/handlers/testKey.ts; see server/nodeAdapter.ts for env rules.
export default createNodeListener(testKeyHandler, vercelServerEnv);
