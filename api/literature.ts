import { literatureHandler } from '../server/handlers/literature';
import { createNodeListener, vercelServerEnv } from '../server/nodeAdapter';

// Vercel serverless function. Logic lives in server/handlers/literature.ts; see server/nodeAdapter.ts for env rules.
export default createNodeListener(literatureHandler, vercelServerEnv);
