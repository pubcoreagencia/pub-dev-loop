import { Container, getContainer } from '@cloudflare/containers';
import pkg from 'pg';
const { Pool } = pkg;
import { PostgresTaskRepository } from './repository.js';
import { PostgresPrototypeRepository } from './prototype/repository.js';
import { PrototypeHandoffService, type PrototypeHandoffInput } from './prototype/handoff.js';
import { PrototypeEventStream } from './prototype/events.js';
import { PreviewRecoveryService } from './prototype/preview-recovery.js';
import { prototypeUiHtml } from './prototype/ui.js';
import { prototypeHistoryUiScript } from './prototype/history-ui.js';

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
  AGENT_PROVIDER?: string;
  OPENROUTER_STREAM_ENABLED?: string;
  ROUTER_STREAM_ENABLED?: string;
  PUB_DEV_LOOP_API_KEY?: string;
  PROTOTYPE_TEMPLATE_REPOSITORY?: string;
  PROTOTYPE_PROTOTYPES_REPO?: string;
  PROTOTYPE_PERSISTENT_PUSH?: string;
  PROTOTYPE_BOT_TOKEN?: string;
}

export class PubDevLoopWorkerContainer extends Container<Env> {
  override defaultPort = 3000;
  override enableInternet = true;
  override sleepAfter = '1h';
  override entrypoint = ['npm', 'run', 'worker'];
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

const SCHEMA_MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY,
    project TEXT NOT NULL,
    repository TEXT NOT NULL,
    objective TEXT NOT NULL,
    prompt TEXT NOT NULL,
    branch TEXT,
    workspace_path TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'QUEUED',
    worker_id TEXT,
    lease_expires_at TIMESTAMPTZ,
    heartbeat_at TIMESTAMPTZ,
    result JSONB,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status, priority DESC, created_at ASC);`,
  `CREATE TABLE IF NOT EXISTS prototype_sessions (
    id UUID PRIMARY KEY,
    project TEXT NOT NULL,
    repository TEXT NOT NULL,
    branch TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'PROTOTYPE' CHECK (mode IN ('PROTOTYPE','DEVELOPMENT')),
    status TEXT NOT NULL DEFAULT 'CREATING' CHECK (status IN ('CREATING','READY','BUILDING','PREVIEWING','FAILED','APPROVED','PROMOTED','ARCHIVED')),
    preview_url TEXT,
    preview_runtime TEXT,
    workspace_path TEXT,
    last_checkpoint_sha TEXT,
    prompt_count INTEGER NOT NULL DEFAULT 0 CHECK (prompt_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS prototype_sessions_status_idx ON prototype_sessions (status, updated_at DESC);`,
  `CREATE TABLE IF NOT EXISTS prototype_checkpoints (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES prototype_sessions(id) ON DELETE CASCADE,
    prompt_index INTEGER NOT NULL CHECK (prompt_index > 0),
    prompt TEXT NOT NULL,
    commit_sha TEXT,
    preview_url TEXT,
    build_passed BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS prototype_checkpoints_session_idx ON prototype_checkpoints (session_id, prompt_index DESC);`,
  `ALTER TABLE prototype_sessions ADD COLUMN IF NOT EXISTS workspace_path TEXT;`,
  `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS prototype_session_id UUID REFERENCES prototype_sessions(id) ON DELETE SET NULL;`,
  `CREATE INDEX IF NOT EXISTS tasks_prototype_session_idx ON tasks (prototype_session_id, created_at ASC) WHERE prototype_session_id IS NOT NULL;`,
  `CREATE TABLE IF NOT EXISTS prototype_events (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES prototype_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    sequence BIGINT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS prototype_events_session_idx ON prototype_events (session_id, created_at ASC, sequence ASC);`,
  `CREATE TABLE IF NOT EXISTS prototype_promotions (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES prototype_sessions(id) ON DELETE CASCADE,
    from_mode TEXT NOT NULL DEFAULT 'PROTOTYPE' CHECK (from_mode = 'PROTOTYPE'),
    to_mode TEXT NOT NULL DEFAULT 'DEVELOPMENT' CHECK (to_mode = 'DEVELOPMENT'),
    repository TEXT NOT NULL,
    branch TEXT NOT NULL,
    checkpoint_sha TEXT NOT NULL,
    promoted_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`,
  `CREATE INDEX IF NOT EXISTS prototype_promotions_session_idx ON prototype_promotions (session_id, promoted_at DESC);`,
  `CREATE TABLE IF NOT EXISTS prototype_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES prototype_sessions(id) ON DELETE CASCADE,
    task_id UUID NULL REFERENCES tasks(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('user','assistant','system','tool','progress')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    "order" BIGINT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prototype_messages_session_order_idx ON prototype_messages (session_id, "order" ASC);`,
  `CREATE INDEX IF NOT EXISTS prototype_messages_session_idx ON prototype_messages (session_id, "order" ASC);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS prototype_events_idempotency_idx
    ON prototype_events (
      session_id,
      (payload->>'taskId'),
      ((payload->>'attempt')::int),
      ((payload->>'operationalSeq')::bigint),
      type
    )
    WHERE (payload->>'taskId') IS NOT NULL
      AND (payload->>'attempt') IS NOT NULL
      AND (payload->>'operationalSeq') IS NOT NULL;`
];

let migrationsChecked = false;
async function ensureMigrations(pool: InstanceType<typeof Pool>): Promise<void> {
  if (migrationsChecked) return;
  try {
    for (const sql of SCHEMA_MIGRATIONS) {
      await pool.query(sql).catch(err => {
        console.error('[API Worker] Migration statement notice:', (err as Error).message);
      });
    }
    migrationsChecked = true;
  } catch (err) {
    console.error('[API Worker] Ensure migrations error:', (err as Error).message);
  }
}

/**
 * Cria ou obtém a instância do PostgresTaskRepository para o Worker API.
 * Prioriza a connectionString do Cloudflare Hyperdrive quando disponível.
 */
function getPool(env: Env): InstanceType<typeof Pool> {
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL or HYPERDRIVE binding connection string');
  }
  return new Pool({ connectionString });
}

function getRepository(env: Env): PostgresTaskRepository {
  const pool = getPool(env);
  void ensureMigrations(pool);
  return new PostgresTaskRepository(pool);
}

function getPrototypesRepository(env: Env): PostgresPrototypeRepository {
  const pool = getPool(env);
  void ensureMigrations(pool);
  return new PostgresPrototypeRepository(pool);
}

/**
 * Sinaliza a inicialização/reutilização da instância do container Linux (singleton "main")
 * injetando as variáveis de ambiente necessárias para o worker.ts no container via SDK oficial.
 */
async function triggerContainerWorker(env: Env): Promise<void> {
  if (!env.WORKER_CONTAINER) return;
  try {
    const container = getContainer(env.WORKER_CONTAINER);
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
      AGENT_PROVIDER: env.AGENT_PROVIDER || 'gateway',
      OPENROUTER_STREAM_ENABLED: env.OPENROUTER_STREAM_ENABLED || 'false',
      ROUTER_STREAM_ENABLED: env.ROUTER_STREAM_ENABLED || 'false',
      PROTOTYPE_TEMPLATE_REPOSITORY: env.PROTOTYPE_TEMPLATE_REPOSITORY || 'https://github.com/pubcoreagencia/pub-dev-loop-template.git',
      PROTOTYPE_PROTOTYPES_REPO: env.PROTOTYPE_PROTOTYPES_REPO || 'pubcoreagencia/pub-dev-loop-prototypes',
      PROTOTYPE_PERSISTENT_PUSH: env.PROTOTYPE_PERSISTENT_PUSH || 'false',
      PROTOTYPE_BOT_TOKEN: env.PROTOTYPE_BOT_TOKEN || '',
      PROTOTYPE_WORKSPACES_ROOT: '/tmp/pub-prototype',
      PROTOTYPE_PREVIEW_MODE: 'public',
      WORKER_POLL_INTERVAL_MS: '3000',
      WORKER_LEASE_TIMEOUT_MS: '30000',
      WORKER_HEARTBEAT_MS: '10000',
    };

    console.log(JSON.stringify({
      event: 'CONTAINER_DISPATCH',
      databaseConfigured: Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0),
      openrouterConfigured: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim().length > 0),
      primaryGateway: env.PRIMARY_GATEWAY || 'openrouter',
      fallbackGateway: env.FALLBACK_GATEWAY || '9router',
      timestamp: new Date().toISOString(),
    }));

    await container.startAndWaitForPorts({
      ports: [3000],
      startOptions: {
        envVars: containerEnv,
        enableInternet: true,
        entrypoint: ['npm', 'run', 'worker'],
      },
      cancellationOptions: { portReadyTimeoutMS: 30000 },
    });
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

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, User-Agent',
      'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      // Helper to wrap json responses with CORS
      const jsonResponse = (data: any, status = 200, extraHeaders: Record<string, string> = {}) => {
        return new Response(JSON.stringify(data), {
          status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
            ...extraHeaders,
          },
        });
      };

      // 1. GET /health
      if (method === 'GET' && path === '/health') {
        return jsonResponse({
          status: 'ok',
          runtime: 'cloudflare-worker',
          version: '0.1.11-p5.5',
          databaseConfigured: Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0),
          hyperdriveConfigured: Boolean(env.HYPERDRIVE?.connectionString),
          openrouterConfigured: Boolean(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim().length > 0),
          primaryGateway: env.PRIMARY_GATEWAY || 'openrouter',
          fallbackGateway: env.FALLBACK_GATEWAY || '9router',
          agentProvider: env.AGENT_PROVIDER || 'gateway',
          streamingEnabled: {
            openrouter: env.OPENROUTER_STREAM_ENABLED === 'true',
            router: env.ROUTER_STREAM_ENABLED === 'true',
          },
        });
      }

      // POST /migrate (Synchronously run schema migrations)
      if (method === 'POST' && path === '/migrate') {
        const pool = getPool(env);
        migrationsChecked = false;
        await ensureMigrations(pool);
        return new Response(JSON.stringify({ status: 'ok', message: 'Schema migrations applied successfully' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // POST /debug/trigger-worker
      if (method === 'POST' && path === '/debug/trigger-worker') {
        try {
          if (!env.WORKER_CONTAINER) {
            return new Response(JSON.stringify({ error: 'WORKER_CONTAINER binding missing' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
          }
          const container = getContainer(env.WORKER_CONTAINER);
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
            AGENT_PROVIDER: env.AGENT_PROVIDER || 'gateway',
            OPENROUTER_STREAM_ENABLED: env.OPENROUTER_STREAM_ENABLED || 'false',
            ROUTER_STREAM_ENABLED: env.ROUTER_STREAM_ENABLED || 'false',
            WORKER_POLL_INTERVAL_MS: '3000',
            WORKER_LEASE_TIMEOUT_MS: '30000',
            WORKER_HEARTBEAT_MS: '10000',
          };

          await container.startAndWaitForPorts({
            ports: [3000],
            startOptions: {
              envVars: containerEnv,
              enableInternet: true,
              entrypoint: ['npm', 'run', 'worker'],
            },
            cancellationOptions: { portReadyTimeoutMS: 30000 },
          });

          const res = await container.fetch(new Request('http://localhost:3000/'));
          const containerHealth = await res.json().catch(() => null);

          return new Response(JSON.stringify({
            status: 'ok',
            containerTriggered: true,
            containerHealth,
            databaseConfigured: Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0),
          }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (err) {
          return new Response(JSON.stringify({
            status: 'error',
            error: (err as Error).message,
            stack: (err as Error).stack,
          }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // 2. GET /prototype (Serve Full Prototype Web UI)
      if (method === 'GET' && (path === '/prototype' || path === '/prototype/' || path.match(/^\/prototype\/sessions\/([^\/]+)\/view$/))) {
        const html = prototypeUiHtml() + prototypeHistoryUiScript();
        return new Response(html, {
          status: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      }

      // 3. POST /prototype/sessions (Create Prototype Session)
      if (method === 'POST' && path === '/prototype/sessions') {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const { project, repository, branch } = body ?? {};
        if (!project || typeof project !== 'string' || !project.trim()) {
          return new Response(JSON.stringify({ error: 'project is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const prototypes = getPrototypesRepository(env);

        // Architecture: session.repository = persistent repo (pub-dev-loop-prototypes)
        // The template is only used internally as the base for the first clone.
        // For recovery, PreviewRecoveryService uses a hard-coded whitelist.
        const persistentRepoUrl = 'https://github.com/pubcoreagencia/pub-dev-loop-prototypes.git';

        const session = await prototypes.createSession({
          project: project.trim(),
          repository: persistentRepoUrl,
          branch: (typeof branch === 'string' && branch.trim()) ? branch.trim() : undefined,
        });
        return new Response(JSON.stringify(session), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      // 4. GET /prototype/sessions (List Prototype Sessions)
      if (method === 'GET' && path === '/prototype/sessions') {
        const prototypes = getPrototypesRepository(env);
        const sessions = await prototypes.listSessions();
        return jsonResponse(sessions);
      }

      // 4c. POST /prototype/sessions/:id/preview/refresh
      // Recovery requires git operations which are not available in the
      // Cloudflare Workers runtime (no child_process). Dispatch to the
      // Worker Container which has Node.js + git.
      const previewRefreshMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/preview\/refresh$/);
      if (previewRefreshMatch && method === 'POST') {
        const sessionId = previewRefreshMatch[1];
        if (!env.WORKER_CONTAINER) {
          return new Response(JSON.stringify({ error: 'WORKER_CONTAINER binding missing' }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
          });
        }
        try {
          const container = getContainer(env.WORKER_CONTAINER);

          // Stop the container to force restart with current env vars
          // (Cloudflare Workers Containers are singletons that don't auto-restart)
          try {
            await container.stop();
          } catch (stopErr) {
            // Container might already be stopped - that's fine
          }

          // Start with fresh env vars
          const containerEnv: Record<string, string> = {
            DATABASE_URL: env.DATABASE_URL || env.HYPERDRIVE?.connectionString || '',
            GITHUB_TOKEN: env.GITHUB_TOKEN || '',
            PRIMARY_GATEWAY: env.PRIMARY_GATEWAY || 'openrouter',
            FALLBACK_GATEWAY: env.FALLBACK_GATEWAY || 'openrouter',
            OPENROUTER_API_KEY: env.OPENROUTER_API_KEY || '',
            OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
            OPENROUTER_MODEL: env.OPENROUTER_MODEL || 'openrouter/free',
            OPENROUTER_FALLBACK_MODELS: env.OPENROUTER_FALLBACK_MODELS || '',
            ROUTER_API_KEY: env.ROUTER_API_KEY || '',
            ROUTER_BASE_URL: env.ROUTER_BASE_URL || '',
            ROUTER_MODEL: env.ROUTER_MODEL || '',
            ROUTER_FALLBACK_MODELS: env.ROUTER_FALLBACK_MODELS || '',
            AGENT_PROVIDER: env.AGENT_PROVIDER || 'gateway',
            PROTOTYPE_TEMPLATE_REPOSITORY: env.PROTOTYPE_TEMPLATE_REPOSITORY || 'https://github.com/pubcoreagencia/pub-dev-loop-template.git',
            PROTOTYPE_PROTOTYPES_REPO: env.PROTOTYPE_PROTOTYPES_REPO || 'pubcoreagencia/pub-dev-loop-prototypes',
            PROTOTYPE_PERSISTENT_PUSH: env.PROTOTYPE_PERSISTENT_PUSH || 'false',
            PROTOTYPE_BOT_TOKEN: env.PROTOTYPE_BOT_TOKEN || '',
            PROTOTYPE_WORKSPACES_ROOT: '/tmp/pub-prototype',
            PROTOTYPE_PREVIEW_MODE: 'public',
            WORKER_POLL_INTERVAL_MS: '3000',
            WORKER_LEASE_TIMEOUT_MS: '30000',
            WORKER_HEARTBEAT_MS: '10000',
          };

          await container.startAndWaitForPorts({
            ports: [3000],
            startOptions: {
              envVars: containerEnv,
              enableInternet: true,
              entrypoint: ['npm', 'run', 'worker'],
            },
            cancellationOptions: { portReadyTimeoutMS: 60000 },
          });

          const res = await container.fetch(new Request('http://localhost:3000/internal/prototype/preview/refresh', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          }));
          const result: any = await res.json().catch(() => null);
          if (!result) {
            return new Response(JSON.stringify({ error: 'Invalid response from container', code: 'CONTAINER_INVALID' }), {
              status: 502, headers: { 'Content-Type': 'application/json' },
            });
          }
          if (result.ok) {
            return new Response(JSON.stringify({
              session: {
                id: result.sessionId,
                status: 'READY',
                previewUrl: result.previewUrl,
                previewRuntime: result.previewRuntime,
              }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          const status = result.code === 'SESSION_NOT_FOUND' ? 404
            : result.code === 'NOT_READY' || result.code === 'NO_CHECKPOINT' ? 409
            : result.code === 'WORKSPACE_MISSING' ? 422
            : 502;
          return new Response(JSON.stringify({ error: result.error || 'Preview refresh failed', code: result.code || 'RECOVERY_FAILED' }), {
            status, headers: { 'Content-Type': 'application/json' },
          });
        } catch (containerError: any) {
          console.error('[API Worker] Container recovery error:', containerError.message);
          return new Response(JSON.stringify({ error: `Container recovery failed: ${containerError.message}`, code: 'CONTAINER_ERROR' }), {
            status: 502, headers: { 'Content-Type': 'application/json' },
          });
        }
      }
      // 4b. POST /prototype/sessions/:id/messages
      const sessionMessagesMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/messages$/);
      if (sessionMessagesMatch && method === 'POST') {
        const id = sessionMessagesMatch[1];
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const { role, content, task_id } = body ?? {};
        const allowedRoles = ['user', 'assistant', 'system', 'tool', 'progress'];
        if (!role || !allowedRoles.includes(role)) {
          return new Response(JSON.stringify({ error: `role must be one of: ${allowedRoles.join(', ')}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (!content || typeof content !== 'string' || !content.trim()) {
          return new Response(JSON.stringify({ error: 'content is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const prototypes = getPrototypesRepository(env);
        const session = await prototypes.getSession(id);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }
        // Validate task_id if provided
        if (task_id) {
          const tasksRepo = getRepository(env);
          const t = await tasksRepo.get(task_id);
          if (!t || t.prototypeSessionId !== session.id) {
            return new Response(JSON.stringify({ error: 'task_id does not belong to this session' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
        }
        const { randomUUID } = await import('node:crypto');
        const msg = await prototypes.addMessage({
          id: randomUUID(),
          sessionId: session.id,
          role: role as any,
          content: content.trim(),
          taskId: task_id,
          order: 0, // auto-computed inside addMessage
          createdAt: new Date(),
        });
        return new Response(JSON.stringify(msg), { status: 201, headers: { 'Content-Type': 'application/json' } });
      }

      // 5. Prototype Single Session Routes (/prototype/sessions/:id, /events, /prompts, /checkpoints, /promote)

      const sessionEventsMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/events$/);
      if (sessionEventsMatch && method === 'GET') {
        const id = sessionEventsMatch[1];
        const prototypes = getPrototypesRepository(env);
        const session = await prototypes.getSession(id);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        // Support SSE reconnection via Last-Event-ID header to avoid duplicate events
        const lastEventIdHeader = request.headers.get('Last-Event-ID') || request.headers.get('last-event-id');
        const initialSequence = lastEventIdHeader ? (parseInt(lastEventIdHeader, 10) || 0) : 0;

        const encoder = new TextEncoder();
        let intervalId: any;
        const stream = new ReadableStream({
          async start(controller) {
            try {
              controller.enqueue(encoder.encode(': connected\n\n'));
              const pool = getPool(env);
              let lastSequence = initialSequence;

              intervalId = setInterval(async () => {
                try {
                  const res = await pool.query(
                    `SELECT * FROM prototype_events WHERE session_id = $1 AND sequence > $2 ORDER BY sequence ASC LIMIT 50`,
                    [id, lastSequence]
                  );
                  for (const row of res.rows) {
                    lastSequence = Math.max(lastSequence, Number(row.sequence));
                    // Include id field so browser sets Last-Event-ID automatically
                    controller.enqueue(encoder.encode(`id: ${row.sequence}\nevent: ${row.type}\ndata: ${JSON.stringify({ payload: row.payload, sequence: row.sequence })}\n\n`));
                  }
                  controller.enqueue(encoder.encode(': heartbeat\n\n'));
                } catch {
                  // Keep interval alive
                }
              }, 2000);
            } catch {
              try { controller.close(); } catch {}
            }
          },
          cancel() {
            if (intervalId) clearInterval(intervalId);
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
          },
        });
      }


      const sessionPromptsMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/prompts$/);
      if (sessionPromptsMatch && method === 'POST') {
        const id = sessionPromptsMatch[1];
        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        const { prompt, objective = 'Prototype MVP iteration', priority = 0 } = body ?? {};
        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
          return new Response(JSON.stringify({ error: 'prompt is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const prototypes = getPrototypesRepository(env);
        const tasks = getRepository(env);
        const session = await prototypes.getSession(id);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        if (['BUILDING', 'PREVIEWING'].includes(session.status)) {
          return new Response(JSON.stringify({ error: 'Prototype session is already processing a prompt' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }

        // Persist user message BEFORE acquiring the lock and creating the task
        try {
          await prototypes.addMessage({
            id: (await import('node:crypto')).randomUUID(),
            sessionId: session.id,
            role: 'user',
            content: prompt.trim(),
            order: 0, // Will be auto-computed inside addMessage transaction
            createdAt: new Date(),
          });
        } catch (msgErr) {
          console.error('[API Worker] Failed to persist user message:', (msgErr as Error).message);
          // Non-fatal: continue with prompt processing
        }

        const updated = await prototypes.incrementPromptCount(session.id);
        if (!updated) {
          return new Response(JSON.stringify({ error: 'Session conflict or invalid state' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
        }

        const task = await tasks.create({
          project: updated.project,
          repository: updated.repository,
          objective,
          prompt: prompt.trim(),
          priority: typeof priority === 'number' ? priority : 0,
          prototypeSessionId: updated.id,
        });

        await tasks.update(task.id, {
          branch: updated.branch,
          workspacePath: `/tmp/pub-prototype/${updated.id}`,
        });

        if (ctx && typeof ctx.waitUntil === 'function') {
          ctx.waitUntil(triggerContainerWorker(env));
        }

        return new Response(JSON.stringify({ session: updated, task, mode: 'PROTOTYPE' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      }


      const sessionPromoteMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/promote$/);
      if (sessionPromoteMatch && method === 'POST') {
        const id = sessionPromoteMatch[1];
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const prototypes = getPrototypesRepository(env);
        const tasks = getRepository(env);
        const events = new PrototypeEventStream();
        const handoff = new PrototypeHandoffService(tasks, prototypes, events);

        try {
          const result = await handoff.execute({
            sessionId: id,
            objective: body?.objective,
            prompt: body?.prompt,
            priority: body?.priority,
          });

          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(triggerContainerWorker(env));
          }

          return new Response(JSON.stringify({
            session: result.session,
            promotion: result.promotion,
            task: result.task,
            mode: result.mode,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (message.startsWith('NOT_FOUND:')) {
            return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          if (message.startsWith('CONFLICT:')) {
            return new Response(JSON.stringify({ error: message.replace(/^CONFLICT:\s*/, '') }), { status: 409, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
      }

      const sessionCheckpointsMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/checkpoints$/);
      if (sessionCheckpointsMatch) {
        const id = sessionCheckpointsMatch[1];
        if (method === 'GET') {
          const prototypes = getPrototypesRepository(env);
          const checkpoints = await prototypes.listCheckpoints(id);
          return new Response(JSON.stringify(checkpoints), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        if (method === 'POST') {
          let body: any;
          try {
            body = await request.json();
          } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          const { promptIndex, prompt, commitSha, previewUrl, buildPassed } = body ?? {};
          if (!Number.isInteger(promptIndex) || promptIndex < 1 || typeof prompt !== 'string' || !prompt.trim()) {
            return new Response(JSON.stringify({ error: 'promptIndex and prompt are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
          }
          const prototypes = getPrototypesRepository(env);
          const checkpoint = await prototypes.createCheckpoint({
            sessionId: id,
            promptIndex,
            prompt: prompt.trim(),
            commitSha: commitSha ?? null,
            previewUrl: previewUrl ?? null,
            buildPassed: buildPassed === true,
          });
          const updated = await prototypes.updateSession(id, {
            lastCheckpointSha: checkpoint.commitSha,
            previewUrl: checkpoint.previewUrl,
            status: checkpoint.buildPassed ? 'READY' : 'FAILED',
          });
          return new Response(JSON.stringify(checkpoint), { status: 201, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // GET /prototype/sessions/:id/preview/ (Direct serving & live preview)
      const sessionPreviewMatch = path.match(/^\/prototype\/sessions\/([^\/]+)\/preview(?:\/(.*))?$/);
      if (sessionPreviewMatch && method === 'GET') {
        const id = sessionPreviewMatch[1];
        const subPath = sessionPreviewMatch[2] || 'index.html';
        const prototypes = getPrototypesRepository(env);
        const session = await prototypes.getSession(id);
        if (!session) {
          return new Response(JSON.stringify({ error: 'Session not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 1. Try to serve file directly from GitHub branch if available
        const botToken = (env as any).PROTOTYPE_BOT_TOKEN || (env as any).GITHUB_TOKEN || '';
        const branchName = session.branch || `prototype/${session.project.toLowerCase().replace(/[^a-z0-9-_]/g, '-')}/${session.id}`;
        
        if (botToken) {
          try {
            const ghUrl = `https://api.github.com/repos/pubcoreagencia/pub-dev-loop-prototypes/contents/${subPath}?ref=${encodeURIComponent(branchName)}`;
            const ghRes = await fetch(ghUrl, {
              headers: {
                'Authorization': `Bearer ${botToken}`,
                'User-Agent': 'PUB-DEV-LOOP-API',
                'Accept': 'application/vnd.github.v3.raw',
              },
            });

            if (ghRes.ok) {
              const fileBody = await ghRes.arrayBuffer();
              let contentType = 'text/plain; charset=utf-8';
              const lower = subPath.toLowerCase();
              if (lower.endsWith('.html') || lower === '') contentType = 'text/html; charset=utf-8';
              else if (lower.endsWith('.css')) contentType = 'text/css; charset=utf-8';
              else if (lower.endsWith('.js')) contentType = 'application/javascript; charset=utf-8';
              else if (lower.endsWith('.json')) contentType = 'application/json; charset=utf-8';
              else if (lower.endsWith('.png')) contentType = 'image/png';
              else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) contentType = 'image/jpeg';
              else if (lower.endsWith('.svg')) contentType = 'image/svg+xml';

              return new Response(fileBody, {
                status: 200,
                headers: {
                  'Content-Type': contentType,
                  'Access-Control-Allow-Origin': '*',
                  'Cache-Control': 'no-cache',
                },
              });
            }
          } catch (e) {
            console.error('[Preview] GitHub direct fetch failed:', e);
          }
        }

        // 2. Fallback to redirect if tunnel URL exists
        if (session.previewUrl) {
          return Response.redirect(session.previewUrl, 302);
        }

        return new Response(JSON.stringify({ error: 'Preview not available for this session', status: session.status || 'NOT_FOUND' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const sessionItemMatch = path.match(/^\/prototype\/sessions\/([^\/]+)$/);
      if (sessionItemMatch) {
        const id = sessionItemMatch[1];
        const prototypes = getPrototypesRepository(env);

        if (method === 'GET') {
          const session = await prototypes.getSession(id);
          if (!session) {
            return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          const checkpoints = await prototypes.listCheckpoints(session.id);
          const tasksRepo = getRepository(env);
          const allTasks = await tasksRepo.list();
          const tasks = allTasks.filter((t: any) => t.prototypeSessionId === session.id);
          const messages = await prototypes.listMessages(session.id);
          return jsonResponse({ session, checkpoints, tasks, messages });
        }

        if (method === 'PATCH') {
          const body = await request.json() as any;
          const allowed = ['status', 'mode', 'previewUrl', 'previewRuntime', 'workspacePath', 'lastCheckpointSha'] as const;
          const patch = Object.fromEntries(allowed.filter(k => body?.[k] !== undefined).map(k => [k, body[k]]));
          const session = await prototypes.updateSession(id, patch);
          if (!session) {
            return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify(session), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }

      const taskItemMatch = path.match(/^\/prototype\/tasks\/([^\/]+)$/);
      if (taskItemMatch && method === 'POST') {
        const taskId = taskItemMatch[1];
        const action = url.searchParams.get('action');
        if (action === 'cancel') {
          const tasksRepo = getRepository(env);
          const updated = await tasksRepo.cancel(taskId);
          if (!updated) {
            return new Response(JSON.stringify({ error: 'Task not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response(JSON.stringify({ status: updated.status, id: updated.id }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
      }

      // POST /tasks
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
        return jsonResponse(tasks);
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
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(triggerContainerWorker(env));
          }
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
