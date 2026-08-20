import { Container, getContainer } from '@cloudflare/containers';
import pkg from 'pg';
const { Pool } = pkg;
import { PostgresTaskRepository } from './repository.js';

export interface HyperdriveBinding {
  connectionString: string;
}

export interface Env {
  HYPERDRIVE?: HyperdriveBinding;
  WORKER_CONTAINER?: any;
  DATABASE_URL?: string;
  GITHUB_TOKEN?: string;
  ROUTER_API_KEY?: string;
  ROUTER_BASE_URL?: string;
  ROUTER_MODEL?: string;
  ROUTER_FALLBACK_MODELS?: string;
  OPENROUTER_API_KEY?: string;
  OPENROUTER_BASE_URL?: string;
  OPENROUTER_MODEL?: string;
  OPENROUTER_FALLBACK_MODELS?: string;
  PRIMARY_GATEWAY?: string;
  FALLBACK_GATEWAY?: string;
  PUB_DEV_LOOP_API_KEY?: string;
}

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
        if (reclaimed > 0) {
          console.log(`[PubDevLoopWorkerContainer] Alarm reclaimed ${reclaimed} stale task(s).`);
        }

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
      if ((this as any).ctx?.storage) {
        await (this as any).ctx.storage.setAlarm(Date.now() + ms);
        console.log(`[PubDevLoopWorkerContainer] Alarm scheduled for +${ms}ms.`);
      }
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

        if (hasActiveWork) {
          this.renewActivityTimeout();
        } else {
          this.stopActivityRenewal();
        }
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

function getRepository(env: Env): PostgresTaskRepository {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL or HYPERDRIVE binding connection string');
  }
  const pool = new Pool({ connectionString });
  return new PostgresTaskRepository(pool);
}

async function triggerContainerWorker(env: Env): Promise<void> {
  if (!env.WORKER_CONTAINER) return;
  try {
    const container = getContainer(env.WORKER_CONTAINER, 'main');
    const containerEnv: Record<string, string> = {
      DATABASE_URL: env.DATABASE_URL || env.HYPERDRIVE?.connectionString || '',
      GITHUB_TOKEN: env.GITHUB_TOKEN || '',
      PRIMARY_GATEWAY: env.PRIMARY_GATEWAY || 'openrouter',
      FALLBACK_GATEWAY: env.FALLBACK_GATEWAY || '9router',
      OPENROUTER_API_KEY: env.OPENROUTER_API_KEY || '',
      OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      OPENROUTER_MODEL: env.OPENROUTER_MODEL || 'openrouter/free',
      OPENROUTER_FALLBACK_MODELS: env.OPENROUTER_FALLBACK_MODELS || '',
      ROUTER_API_KEY: env.ROUTER_API_KEY || '',
      ROUTER_BASE_URL: env.ROUTER_BASE_URL || '',
      ROUTER_MODEL: env.ROUTER_MODEL || '',
      ROUTER_FALLBACK_MODELS: env.ROUTER_FALLBACK_MODELS || '',
      WORKER_POLL_INTERVAL_MS: '5000',
      WORKER_LEASE_TIMEOUT_MS: '30000',
      WORKER_HEARTBEAT_MS: '10000'
    };

    await container.start({ envVars: containerEnv });
    console.log('[API Worker] Triggered container worker instance "main" with OpenRouter -> 9Router gateway policy.');
  } catch (err) {
    console.error('[API Worker] Error triggering container worker:', (err as Error).message);
  }
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

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
}

export function resetRateLimitMap(): void {
  rateLimitMap.clear();
}

function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const xApiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key');
  if (xApiKey) {
    return xApiKey.trim();
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === 'GET' && path === '/health') {
        return new Response(JSON.stringify({ status: 'ok', runtime: 'cloudflare-worker' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'POST' && path === '/tasks') {
        const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

        if (!checkRateLimit(clientIp)) {
          console.log(JSON.stringify({ event: 'RATE_LIMITED', clientIp, path, timestamp: new Date().toISOString() }));
          return new Response(JSON.stringify({ error: 'Too Many Requests' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
          });
        }

        const expectedApiKey = env.PUB_DEV_LOOP_API_KEY || process.env.PUB_DEV_LOOP_API_KEY;
        if (expectedApiKey && expectedApiKey.trim()) {
          const providedApiKey = extractApiKey(request);
          if (!providedApiKey || providedApiKey !== expectedApiKey.trim()) {
            console.log(JSON.stringify({ event: 'AUTH_FAILED', clientIp, path, timestamp: new Date().toISOString() }));
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or missing API key' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          console.log(JSON.stringify({ event: 'TASK_REQUEST_REJECTED', reason: 'Invalid JSON payload', clientIp, path, timestamp: new Date().toISOString() }));
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (
          !body ||
          typeof body !== 'object' ||
          typeof body.project !== 'string' || !body.project.trim() ||
          typeof body.repository !== 'string' || !body.repository.trim() ||
          typeof body.objective !== 'string' || !body.objective.trim() ||
          typeof body.prompt !== 'string' || !body.prompt.trim()
        ) {
          console.log(JSON.stringify({ event: 'TASK_REQUEST_REJECTED', reason: 'Missing required fields', clientIp, path, timestamp: new Date().toISOString() }));
          return new Response(
            JSON.stringify({ error: 'project, repository, objective and prompt are required string fields' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const allowedFields = new Set(['project', 'repository', 'objective', 'prompt', 'priority']);
        const unknownFields = Object.keys(body).filter(k => !allowedFields.has(k));
        if (unknownFields.length > 0) {
          console.log(JSON.stringify({ event: 'TASK_REQUEST_REJECTED', reason: `Unknown fields: ${unknownFields.join(', ')}`, clientIp, path, timestamp: new Date().toISOString() }));
          return new Response(
            JSON.stringify({ error: `Unknown or forbidden fields provided: ${unknownFields.join(', ')}` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const repo = getRepository(env);
        const task = await repo.create({
          project: body.project.trim(),
          repository: body.repository.trim(),
          objective: body.objective.trim(),
          prompt: body.prompt.trim(),
          priority: typeof body.priority === 'number' ? body.priority : undefined,
        });

        console.log(JSON.stringify({ event: 'TASK_REQUEST_ACCEPTED', taskId: task.id, project: task.project, clientIp, timestamp: new Date().toISOString() }));

        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(triggerContainerWorker(env));
        }

        return new Response(JSON.stringify(task), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const repo = getRepository(env);

      if (method === 'GET' && path === '/tasks') {
        const tasks = await repo.list();
        return new Response(JSON.stringify(tasks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const taskMatch = path.match(/^\/tasks\/([^\/]+)(?:\/(cancel|retry))?$/);
      if (taskMatch) {
        const id = taskMatch[1];
        const action = taskMatch[2];

        if (method === 'GET' && !action) {
          const task = await repo.get(id);
          if (!task) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify(task), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST' && action === 'cancel') {
          const task = await repo.cancel(id);
          if (!task) {
            return new Response(JSON.stringify({ error: 'Task cannot be cancelled' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify(task), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (method === 'POST' && action === 'retry') {
          const task = await repo.retry(id);
          if (!task) {
            return new Response(JSON.stringify({ error: 'Task cannot be retried' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            });
          }
          ctx.waitUntil(triggerContainerWorker(env));
          return new Response(JSON.stringify(task), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('[API Worker] Unhandled error:', err);
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
