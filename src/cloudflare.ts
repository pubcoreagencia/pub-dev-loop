import { Container } from '@cloudflare/containers';
import apiWorker, { type Env as ApiEnv, PubDevLoopWorkerContainer, defaultAutonomousOrchestrator } from './api-worker.js';

export interface Env extends ApiEnv {
  PROTOTYPE_TEMPLATE_REPOSITORY?: string;
  PROTOTYPE_WORKSPACES_ROOT?: string;
  PROTOTYPE_PREVIEW_MODE?: string;
  PROTOTYPE_PREVIEW_BASE_URL?: string;
  PROTOTYPE_PREVIEW_COMMAND?: string;
  PROTOTYPE_PREVIEW_ARGS?: string;
  PROTOTYPE_PREVIEW_STARTUP_TIMEOUT_MS?: string;
  PROTOTYPE_TUNNEL_STARTUP_TIMEOUT_MS?: string;
  CLOUDFLARED_COMMAND?: string;
}

export class PubDevLoopApiContainer extends Container<Env> {}

export { PubDevLoopWorkerContainer };

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    return apiWorker.fetch(request, env, ctx);
  },
  async scheduled(controller: any, env: Env, ctx: any): Promise<void> {
    console.warn('[CEO RECOVERY PROTOCOL HARD STOP] Scheduled autonomous holding tick is PERMANENTLY DISABLED / HARD STOPPED. Zero ticks executed.');
    return;
  },
};
