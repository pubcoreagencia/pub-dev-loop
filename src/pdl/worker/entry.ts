import 'dotenv/config';
import http from 'node:http';
import { Pool } from 'pg';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createProvider, createAgent } from '../../agent.js';
import { PostgresTaskRepository } from '../../repository.js';
import { PdlCorrectionWorker } from './correction-worker.js';
import { PdlGovernanceEngine } from '../governance/index.js';
import { CodexWorker, BaseWorker } from '../../worker-service.js';
import { configureGitCredentials } from '../../worker.js';

import { PdlContinuousScheduler } from '../scheduler/index.js';
import { PdlTaskReaper } from '../reaper/index.js';
import { PdlRetryPolicy } from '../retry/index.js';
import { PdlDeadLetterRepository } from '../dlq/index.js';
import type { SchedulerSessionInfo } from '../scheduler/types.js';
import type { AgentProvider } from '../../providers/types.js';

const PORT = Number(process.env.PDL_WORKER_PORT ?? 3003);
const POLL_INTERVAL_MS = Number(process.env.PDL_WORKER_POLL_INTERVAL_MS ?? process.env.WORKER_POLL_INTERVAL_MS ?? 3000);

export function createPdlWorkerDaemon(
  pool: Pool,
  governance?: PdlGovernanceEngine,
  tasks?: PostgresTaskRepository,
  providerOverride?: AgentProvider
): BaseWorker {
  const taskRepo = tasks ?? new PostgresTaskRepository(pool);
  const provider = providerOverride ?? (process.env.AGENT_PROVIDER ? createProvider(process.env.AGENT_PROVIDER) : undefined);

  if (provider) {
    if (provider.kind === 'mock' && process.env.NODE_ENV !== 'test') {
      console.error('[PDL Worker] FATAL: Real provider not configured (AGENT_PROVIDER resolves to mock). Worker cannot start.');
      process.exit(1);
    }
    const gov = governance ?? new PdlGovernanceEngine({ pool });
    return new PdlCorrectionWorker(taskRepo, provider, 'pdl-router', undefined, pool, gov);
  }

  if (process.env.NODE_ENV === 'test') {
    return new CodexWorker(taskRepo, createAgent(), 'codex', pool);
  }

  console.error('[PDL Worker] FATAL: No AGENT_PROVIDER defined. Worker cannot start without a real provider.');
  process.exit(1);
}

export interface PdlContinuousDaemonOptions {
  worker?: BaseWorker;
  governance?: PdlGovernanceEngine;
  tasks?: PostgresTaskRepository;
  dlq?: PdlDeadLetterRepository;
  retryPolicy?: PdlRetryPolicy;
  reaper?: PdlTaskReaper;
  pollIntervalMs?: number;
  authorizedBy?: string;
  provider?: AgentProvider;
}

export interface PdlContinuousDaemon {
  pool: Pool;
  tasks: PostgresTaskRepository;
  governance: PdlGovernanceEngine;
  dlq: PdlDeadLetterRepository;
  retryPolicy: PdlRetryPolicy;
  reaper: PdlTaskReaper;
  worker: BaseWorker;
  scheduler: PdlContinuousScheduler;
  start: () => Promise<SchedulerSessionInfo>;
  stop: (reason?: string) => Promise<SchedulerSessionInfo | null>;
}

export function createPdlContinuousDaemon(
  pool: Pool,
  options?: PdlContinuousDaemonOptions
): PdlContinuousDaemon {
  const tasks = options?.tasks ?? new PostgresTaskRepository(pool);
  const governance = options?.governance ?? new PdlGovernanceEngine({ pool });
  const dlq = options?.dlq ?? new PdlDeadLetterRepository(pool);
  const retryPolicy = options?.retryPolicy ?? new PdlRetryPolicy();
  const reaper = options?.reaper ?? new PdlTaskReaper({
    tasks,
    governance,
    dlq,
    pool,
  });

  const worker = options?.worker ?? createPdlWorkerDaemon(pool, governance, tasks, options?.provider);

  const scheduler = new PdlContinuousScheduler({
    governance,
    worker,
    tasks,
    dlq,
    retryPolicy,
    reaper,
    pool,
    config: {
      pollIntervalMs: options?.pollIntervalMs ?? POLL_INTERVAL_MS,
      authorizedBy: options?.authorizedBy ?? 'pdl-worker-daemon',
      maxConcurrentTasks: 1,
    },
  });

  return {
    pool,
    tasks,
    governance,
    dlq,
    retryPolicy,
    reaper,
    worker,
    scheduler,
    start: async () => {
      return await scheduler.start();
    },
    stop: async (reason?: string) => {
      if (reaper.getStatus().running) {
        reaper.stop();
      }
      return await scheduler.stop(reason ?? 'DAEMON_SHUTDOWN');
    },
  };
}

export function startPdlHealthServer(port = PORT, poolGetter?: () => Pool | undefined): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    if (url === '/ready') {
      try {
        const pool = poolGetter?.();
        if (pool) {
          await pool.query('SELECT 1');
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ready',
          service: 'pdl-worker',
          name: 'PDL Worker',
          database: pool ? 'connected' : 'uninitialized',
          provider: process.env.AGENT_PROVIDER || 'default',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        }));
      } catch (err: any) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'not_ready',
          service: 'pdl-worker',
          name: 'PDL Worker',
          error: err.message,
        }));
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'pdl-worker',
      name: 'PDL Worker',
      worker: 'PUB Development Loop Dedicated Worker',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env: {
        DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'EMPTY',
        GITHUB_TOKEN: process.env.GITHUB_TOKEN ? 'SET' : 'EMPTY',
        OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? 'SET' : 'EMPTY',
      },
    }));
  });

  server.on('error', (err: any) => {
    console.warn(`[PDL Worker] Health server warning on port ${port}:`, err.message);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[PDL Worker] Dedicated health server listening on 0.0.0.0:${port}`);
  });

  return server;
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isMain = Boolean(entryFile && currentFile === entryFile) || process.env.RUN_PDL_WORKER === 'true';

if (isMain) {
  let activePool: Pool | undefined;
  startPdlHealthServer(PORT, () => activePool);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[PDL Worker] FATAL: DATABASE_URL is not configured. Worker cannot start.');
  } else {
    try {
      configureGitCredentials();
      const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
      activePool = new Pool({
        connectionString: dbUrl,
        ssl: isLocal ? false : { rejectUnauthorized: false },
      });

      const daemon = createPdlContinuousDaemon(activePool, {
        pollIntervalMs: POLL_INTERVAL_MS,
        authorizedBy: 'pdl-worker-daemon',
      });

      console.log(JSON.stringify({
        event: 'PDL_AUTONOMOUS_DAEMON_STARTED',
        timestamp: new Date().toISOString(),
        intervalMs: POLL_INTERVAL_MS,
      }));

      let isShuttingDown = false;

      const shutdown = async (signal: string) => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        console.log(`[PDL Worker] Received ${signal}, graceful shutdown initiated...`);
        try {
          await daemon.stop(signal);
        } catch (err: any) {
          console.error('[PDL Worker] Shutdown error:', err.message);
        }
        try {
          if (activePool) await activePool.end();
        } catch {}
        process.exit(0);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

      await daemon.start();
    } catch (err) {
      console.error('[PDL Worker] Initialization error:', (err as Error).message);
    }
  }
}
