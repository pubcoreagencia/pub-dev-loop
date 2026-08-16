import 'dotenv/config';
import { RouterProvider } from './providers/router.js';

const provider = new RouterProvider();
const health = await provider.health();
console.log(JSON.stringify({
  provider: provider.kind,
  baseUrl: provider.baseUrl,
  model: provider.model,
  available: health.available,
  details: health.details,
}));
process.exitCode = health.available ? 0 : 1;
