import { parseHandler } from '../server/handlers/parse';
import { createNodeListener, vercelServerEnv } from '../server/nodeAdapter';

// Vercel serverless function. Logic lives in server/handlers/parse.ts; see server/nodeAdapter.ts for env rules.
export default createNodeListener(parseHandler, vercelServerEnv);
