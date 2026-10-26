import { troubleshootHandler } from '../server/handlers/troubleshoot';
import { createNodeListener, vercelServerEnv } from '../server/nodeAdapter';

// Vercel serverless function. Logic lives in server/handlers/troubleshoot.ts; see server/nodeAdapter.ts for env rules.
export default createNodeListener(troubleshootHandler, vercelServerEnv);
