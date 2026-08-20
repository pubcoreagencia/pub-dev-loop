import { Container, getContainer } from '@cloudflare/containers';
import apiWorker, { type Env as ApiEnv } from './api-worker.js';

export interface Env extends ApiEnv {
  PROTOTYPE_API_CONTAINER: DurableObjectNamespace<PubDevLoopApiContainer>;
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

export class PubDevLoopApiContainer extends Container<Env> {
  defaultPort = 3000;
  sleepAfter = '15m';
  entrypoint = ['npm', 'run', 'start'];
  enableInternet = true;
}

function buildContainerEnv(env: Env): Record<string, string> {
  const values: Record<string, string | undefined> = {
    DATABASE_URL: env.DATABASE_URL || env.HYPERDRIVE?.connectionString,
    GITHUB_TOKEN: env.GITHUB_TOKEN,
    PUB_DEV_LOOP_API_KEY: env.PUB_DEV_LOOP_API_KEY,
    PRIMARY_GATEWAY: env.PRIMARY_GATEWAY || 'openrouter',
    FALLBACK_GATEWAY: env.FALLBACK_GATEWAY || '9router',
    OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
    OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    OPENROUTER_MODEL: env.OPENROUTER_MODEL || 'openrouter/free',
    OPENROUTER_FALLBACK_MODELS: env.OPENROUTER_FALLBACK_MODELS,
    ROUTER_API_KEY: env.ROUTER_API_KEY,
    ROUTER_BASE_URL: env.ROUTER_BASE_URL,
    ROUTER_MODEL: env.ROUTER_MODEL,
    ROUTER_FALLBACK_MODELS: env.ROUTER_FALLBACK_MODELS,
    PROTOTYPE_TEMPLATE_REPOSITORY: env.PROTOTYPE_TEMPLATE_REPOSITORY,
    PROTOTYPE_WORKSPACES_ROOT: env.PROTOTYPE_WORKSPACES_ROOT || '/tmp/pub-prototype',
    PROTOTYPE_PREVIEW_MODE: env.PROTOTYPE_PREVIEW_MODE || 'public',
    PROTOTYPE_PREVIEW_BASE_URL: env.PROTOTYPE_PREVIEW_BASE_URL,
    PROTOTYPE_PREVIEW_COMMAND: env.PROTOTYPE_PREVIEW_COMMAND || 'npm',
    PROTOTYPE_PREVIEW_ARGS: env.PROTOTYPE_PREVIEW_ARGS || 'run dev -- --host 0.0.0.0 --port {PORT}',
    PROTOTYPE_PREVIEW_STARTUP_TIMEOUT_MS: env.PROTOTYPE_PREVIEW_STARTUP_TIMEOUT_MS,
    PROTOTYPE_TUNNEL_STARTUP_TIMEOUT_MS: env.PROTOTYPE_TUNNEL_STARTUP_TIMEOUT_MS,
    CLOUDFLARED_COMMAND: env.CLOUDFLARED_COMMAND || 'cloudflared',
    NODE_ENV: 'production',
  };

  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== '')) as Record<string, string>;
}

async function proxyPrototype(request: Request, env: Env): Promise<Response> {
  const container = getContainer(env.PROTOTYPE_API_CONTAINER, 'pp-main');
  await container.startAndWaitForPorts({
    ports: [3000],
    startOptions: {
      entrypoint: ['npm', 'run', 'start'],
      envVars: buildContainerEnv(env),
      enableInternet: true,
    },
    cancellationOptions: { portReadyTimeoutMS: 30000 },
  });
  return container.fetch(request);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/prototype' || path.startsWith('/prototype/')) {
      return proxyPrototype(request, env);
    }
    return apiWorker.fetch(request, env, ctx);
  },
};
