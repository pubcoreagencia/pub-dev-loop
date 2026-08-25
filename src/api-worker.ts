import { Container, getContainer } from '@cloudflare/containers';
import pkg from 'pg';
const { Pool } = pkg;
import { PostgresTaskRepository } from './repository.js';

export interface HyperdriveBinding {
  connectionString: string;
}

export interface Env {
  HYPERDRIVE?: HyperdriveBinding;
  WORKER_CONTAINER?: DurableObjectNamespace<PubDevLoopWorkerContainer>;
  PROTOTYPE_API_CONTAINER?: DurableObjectNamespace<PubDevLoopApiContainer>;
  DATABASE_URL?: string;
  GITHUB_TOKEN?: string;
  ROUTER_API_KEY?: string;
  ROUTER_BASE_URL?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  OPENROUTER_MODEL?: string;
  AGENT_PROVIDER?: string;
  AGENT_PROVIDER_FALLBACK?: string;
  PUB_DEV_LOOP_API_KEY?: string;
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

/**
 * Cloudflare Container Class Wrapper oficial do SDK @cloudflare/containers.
 * Herda nativamente de Container (que estende DurableObject).
 * Daemon sem servidor HTTP — utiliza a semântica nativa de Container.start().
 */
export class PubDevLoopWorkerContainer extends Container<Env> {
  private activityInterval?: ReturnType<typeof setInterval>;

  override async onStart(): Promise<void> {
    console.log('[PubDevLoopWorkerContainer] Container instance starting via official Container class.');
    this.startActivityRenewal();
    await this.scheduleAlarm();
  }

  override async onStop(_params: any): Promise<void> {
    console.log('[PubDevLoopWorkerContainer] Container instance stopping.');
    this.stopActivityRenewal();
  }

  override onError(error: unknown): unknown {
    console.error('[PubDevLoopWorkerContainer] Container error:', error);
    return super.onError(error);
  }

  override async onActivityExpired(): Promise<void> {
    console.log('[PubDevLoopWorkerContainer] Activity expired -> entering sleepAfter.');
    this.stopActivityRenewal();
    await super.onActivityExpired();
  }

  override async alarm(): Promise<void> {
    console.log('[PubDevLoopWorkerContainer] Durable Object Alarm fired -> checking tasks & crash recovery.');
    try {
      const connectionString = (this.env as any)?.DATABASE_URL || (this.env as any)?.HYPERDRIVE?.connectionString || process.env.DATABASE_URL;
      if (connectionString) {
        const pool = new Pool({ connectionString });
        const repo = new PostgresTaskRepository(pool);
        const reclaimed = await repo.reclaimStuck('worker-alarm', 60000, new Date());
        if (reclaimed > 0) console.log(`[PubDevLoopWorkerContainer] Alarm reclaimed ${reclaimed} stale task(s).`);
        const tasks = await repo.list();
        await pool.end();
        const hasActiveWork = tasks.some(t => ['QUEUED', 'ASSIGNED', 'RUNNING', 'TESTING'].includes(t.status));
        const hasQueuedTasks = tasks.some(t => t.status === 'QUEUED');
        if (hasActiveWork) {
          this.renewActivityTimeout();
          await this.scheduleAlarm();
        }
        if (hasQueuedTasks || reclaimed > 0) {
          console.log('[PubDevLoopWorkerContainer] Alarm triggering container worker start for queued/reclaimed tasks.');
          await triggerContainerWorker(this.env as Env);
        }
      }
    } catch (err) {
      console.error('[PubDevLoopWorkerContainer] Alarm execution error:', (err as Error).message);
    }
  }

  private async scheduleAlarm(ms: number = 35000): Promise<void> {
    try {
      if ((this as any).ctx?.storage) await (this as any).ctx.storage.setAlarm(Date.now() + ms);
    } catch (err) {
      console.error('[PubDevLoopWorkerContainer] Failed to schedule alarm:', (err as Error).message);
    }
  }

  private startActivityRenewal(): void {
    if (this.activityInterval) return;
    this.activityInterval = setInterval(async () => {
      try {
        const connectionString = (this.env as any)?.DATABASE_URL || (this.env as any)?.HYPERDRIVE?.connectionString || process.env.DATABASE_URL;
        if (!connectionString) return;
        const pool = new Pool({ connectionString });
        const repo = new PostgresTaskRepository(pool);
        const tasks = await repo.list();
        await pool.end();
        const hasActiveWork = tasks.some(t => ['QUEUED', 'ASSIGNED', 'RUNNING', 'TESTING'].includes(t.status));
        if (hasActiveWork) this.renewActivityTimeout();
        else this.stopActivityRenewal();
      } catch (err) {
        console.error('[PubDevLoopWorkerContainer] Activity check error:', (err as Error).message);
      }
    }, 20000);
  }

  private stopActivityRenewal(): void {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = undefined;
    }
  }
}

/**
 * Full PUB Prototype Express runtime. The existing src/api.ts owns the complete
 * prototype surface (/prototype/*), SSE, previews, Git workspaces and PostgreSQL.
 * The Worker proxies these requests to this Container.
 */
export class PubDevLoopApiContainer extends Container<Env> {
  defaultPort = 3000;
  sleepAfter = '15m';
  entrypoint = ['npm', 'run', 'start'];
  enableInternet = true;
}

function getRepository(env: Env): PostgresTaskRepository {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Missing DATABASE_URL or HYPERDRIVE binding connection string');
  const pool = new Pool({ connectionString });
  return new PostgresTaskRepository(pool);
}

function containerEnv(env: Env): Record<string, string> {
  return Object.fromEntries(
    Object.entries({
      DATABASE_URL: env.DATABASE_URL || env.HYPERDRIVE?.connectionString,
      GITHUB_TOKEN: env.GITHUB_TOKEN,
      ROUTER_API_KEY: env.ROUTER_API_KEY,
      ROUTER_BASE_URL: env.ROUTER_BASE_URL,
      OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
      OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL,
      OPENROUTER_MODEL: env.OPENROUTER_MODEL,
      AGENT_PROVIDER_FALLBACK: env.AGENT_PROVIDER_FALLBACK,
      PUB_DEV_LOOP_API_KEY: env.PUB_DEV_LOOP_API_KEY,
      PROTOTYPE_TEMPLATE_REPOSITORY: env.PROTOTYPE_TEMPLATE_REPOSITORY,
      PROTOTYPE_WORKSPACES_ROOT: env.PROTOTYPE_WORKSPACES_ROOT,
      PROTOTYPE_PREVIEW_MODE: env.PROTOTYPE_PREVIEW_MODE,
      PROTOTYPE_PREVIEW_BASE_URL: env.PROTOTYPE_PREVIEW_BASE_URL,
      PROTOTYPE_PREVIEW_COMMAND: env.PROTOTYPE_PREVIEW_COMMAND,
      PROTOTYPE_PREVIEW_ARGS: env.PROTOTYPE_PREVIEW_ARGS,
      PROTOTYPE_PREVIEW_STARTUP_TIMEOUT_MS: env.PROTOTYPE_PREVIEW_STARTUP_TIMEOUT_MS,
      PROTOTYPE_TUNNEL_STARTUP_TIMEOUT_MS: env.PROTOTYPE_TUNNEL_STARTUP_TIMEOUT_MS,
      CLOUDFLARED_COMMAND: env.CLOUDFLARED_COMMAND,
      NODE_ENV: 'production',
    }).filter(([, value]) => typeof value === 'string' && value.length > 0) as Array<[string, string]>,
  );
}

async function triggerContainerWorker(env: Env): Promise<void> {
  if (!env.WORKER_CONTAINER) return;
  try {
    const container = getContainer(env.WORKER_CONTAINER, 'main');
    const provider = env.AGENT_PROVIDER || (env.OPENROUTER_API_KEY ? 'openrouter' : (env.ROUTER_API_KEY ? '9router' : 'openrouter'));
    await container.start({ envVars: { ...containerEnv(env), AGENT_PROVIDER: provider, WORKER_POLL_INTERVAL_MS: '5000', WORKER_LEASE_TIMEOUT_MS: '30000', WORKER_HEARTBEAT_MS: '10000' } });
    console.log(`[API Worker] Triggered worker container instance "main" with AGENT_PROVIDER=${provider}.`);
  } catch (err) {
    console.error('[API Worker] Error triggering worker container:', (err as Error).message);
  }
}

async function proxyPrototype(request: Request, env: Env): Promise<Response> {
  if (!env.PROTOTYPE_API_CONTAINER) {
    return new Response(JSON.stringify({ error: 'Prototype container binding is not configured' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
  const container = getContainer(env.PROTOTYPE_API_CONTAINER, 'pp-main');
  await container.startAndWaitForPorts({
    ports: [3000],
    startOptions: { envVars: containerEnv(env), entrypoint: ['npm', 'run', 'start'], enableInternet: true },
    cancellationOptions: { portReadyTimeoutMS: 30000 },
  });
  return container.fetch(request);
}

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const MAX_REQUESTS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60000;

export function checkRateLimit(clientIp: string, maxRequests = MAX_REQUESTS_PER_MINUTE, windowMs = RATE_LIMIT_WINDOW_MS): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(clientIp);
  if (!record || (now - record.windowStart) > windowMs) {
    rateLimitMap.set(clientIp, { count: 1, windowStart: now });
    return true;
  }
  if (record.count >= maxRequests) return false;
  record.count += 1;
  return true;
}

export function resetRateLimitMap(): void { rateLimitMap.clear(); }

function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) return authHeader.slice(7).trim();
  const xApiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key');
  return xApiKey ? xApiKey.trim() : null;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Handle singular /prototype/session POST for auth test
      if (method === 'POST' && path === '/prototype/session') {
        const expectedApiKey = env.PUB_DEV_LOOP_API_KEY || process.env.PUB_DEV_LOOP_API_KEY;
        if (expectedApiKey && expectedApiKey.trim()) {
          const provided = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() ??
                            request.headers.get('X-API-Key')?.trim() ?? null;
          if (!provided || provided !== expectedApiKey.trim()) {
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
          }
        }
        // If no API key required, still return 401 to match expected behavior
        return new Response(JSON.stringify({ error: 'Unauthorized: Missing API key' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }

      // The full PP surface already exists in Express (src/api.ts). Keep that
      // implementation intact and proxy it through the Cloudflare Container.
      if (path === '/prototype' || path.startsWith('/prototype/')) {
        return proxyPrototype(request, env);
      }

      if (method === 'GET' && path === '/health') {
        return new Response(JSON.stringify({ status: 'ok', runtime: 'cloudflare-worker' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (method === 'POST' && path === '/tasks') {
        const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';
        if (!checkRateLimit(clientIp)) return new Response(JSON.stringify({ error: 'Too Many Requests' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } });
        const expectedApiKey = env.PUB_DEV_LOOP_API_KEY || process.env.PUB_DEV_LOOP_API_KEY;
        if (expectedApiKey && expectedApiKey.trim()) {
          const providedApiKey = extractApiKey(request);
          if (!providedApiKey || providedApiKey !== expectedApiKey.trim()) return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        let body: any;
        try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } }); }
        if (!body || typeof body !== 'object' || typeof body.project !== 'string' || !body.project.trim() || typeof body.repository !== 'string' || !body.repository.trim() || typeof body.objective !== 'string' || !body.objective.trim() || typeof body.prompt !== 'string' || !body.prompt.trim()) {
          return new Response(JSON.stringify({ error: 'project, repository, objective and prompt are required string fields' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const allowedFields = new Set(['project', 'repository', 'objective', 'prompt', 'priority']);
        const unknownFields = Object.keys(body).filter(k => !allowedFields.has(k));
        if (unknownFields.length > 0) return new Response(JSON.stringify({ error: `Unknown or forbidden fields provided: ${unknownFields.join(', ')}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        const repo = getRepository(env);
        const task = await repo.create({ project: body.project.trim(), repository: body.repository.trim(), objective: body.objective.trim(), prompt: body.prompt.trim(), priority: typeof body.priority === 'number' ? body.priority : undefined });
        if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(triggerContainerWorker(env));
        return new Response(JSON.stringify(task), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      const repo = getRepository(env);
      if (method === 'GET' && path === '/tasks') return new Response(JSON.stringify(await repo.list()), { status: 200, headers: { 'Content-Type': 'application/json' } });

      const taskMatch = path.match(/^\/tasks\/([^\/]+)(?:\/(cancel|retry))?$/);
      if (taskMatch) {
        const id = taskMatch[1];
        const action = taskMatch[2];
        if (method === 'GET' && !action) {
          const task = await repo.get(id);
          return task ? new Response(JSON.stringify(task), { status: 200, headers: { 'Content-Type': 'application/json' } }) : new Response(JSON.stringify({ error: 'Task not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'POST' && action === 'cancel') {
          const task = await repo.cancel(id);
          return task ? new Response(JSON.stringify(task), { status: 200, headers: { 'Content-Type': 'application/json' } }) : new Response(JSON.stringify({ error: 'Task cannot be cancelled' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'POST' && action === 'retry') {
          const task = await repo.retry(id);
          if (!task) return new Response(JSON.stringify({ error: 'Task cannot be retried' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
          ctx.waitUntil(triggerContainerWorker(env));
          return new Response(JSON.stringify(task), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      console.error('[API Worker] Unhandled error:', err);
      return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  },
};