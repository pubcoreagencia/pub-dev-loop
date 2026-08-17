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

  override async onStop(params: any): Promise<void> {
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
        
        // Reclaim stale tasks after crash (30s lease timeout * 2)
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
          // Fila vazia: interrompe renovação periódica para permitir sleepAfter
          this.stopActivityRenewal();
        }
      } catch (err) {
        console.error('[PubDevLoopWorkerContainer] Activity check error:', (err as Error).message);
      }
    }, 20000); // Checa a cada 20 segundos
  }

  private stopActivityRenewal(): void {
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
      this.activityInterval = undefined;
    }
  }
}

/**
 * Cria ou obtém a instância do PostgresTaskRepository para o Worker API.
 * Prioriza a connectionString do Cloudflare Hyperdrive quando disponível.
 */
function getRepository(env: Env): PostgresTaskRepository {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL or HYPERDRIVE binding connection string');
  }
  const pool = new Pool({ connectionString });
  return new PostgresTaskRepository(pool);
}

/**
 * Sinaliza a inicialização/reutilização da instância do container Linux (singleton "main")
 * injetando as variáveis de ambiente necessárias para o worker.ts no container via SDK oficial.
 */
async function triggerContainerWorker(env: Env): Promise<void> {
  if (!env.WORKER_CONTAINER) return;
  try {
    const container = getContainer(env.WORKER_CONTAINER, 'main');
    const containerEnv: Record<string, string> = {
      DATABASE_URL: env.DATABASE_URL || env.HYPERDRIVE?.connectionString || '',
      GITHUB_TOKEN: env.GITHUB_TOKEN || '',
      ROUTER_API_KEY: env.ROUTER_API_KEY || '',
      ROUTER_BASE_URL: env.ROUTER_BASE_URL || '',
      AGENT_PROVIDER: '9router',
      WORKER_POLL_INTERVAL_MS: '5000',
      WORKER_LEASE_TIMEOUT_MS: '30000',
      WORKER_HEARTBEAT_MS: '10000'
    };

    await container.start({ envVars: containerEnv });
    console.log('[API Worker] Triggered container worker instance "main" via getContainer().start() with envVars.');
  } catch (err) {
    console.error('[API Worker] Error triggering container worker:', (err as Error).message);
  }
}

/**
 * Adaptador de API Gateway para Cloudflare Workers.
 * Implementa requisições HTTP REST usando Web Standard fetch().
 */
export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // GET /health
      if (method === 'GET' && path === '/health') {
        return new Response(JSON.stringify({ status: 'ok', runtime: 'cloudflare-worker' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const repo = getRepository(env);

      // POST /tasks
      if (method === 'POST' && path === '/tasks') {
        const body = (await request.json().catch(() => ({}))) as {
          project?: string;
          repository?: string;
          objective?: string;
          prompt?: string;
          priority?: number;
        };

        if (!body.project || !body.repository || !body.objective || !body.prompt) {
          return new Response(
            JSON.stringify({ error: 'project, repository, objective and prompt are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const task = await repo.create({
          project: body.project,
          repository: body.repository,
          objective: body.objective,
          prompt: body.prompt,
          priority: body.priority,
        });

        // Trigger container startup on new task via start()
        ctx.waitUntil(triggerContainerWorker(env));

        return new Response(JSON.stringify(task), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // GET /tasks
      if (method === 'GET' && path === '/tasks') {
        const tasks = await repo.list();
        return new Response(JSON.stringify(tasks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Match /tasks/:id or /tasks/:id/cancel or /tasks/:id/retry
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
