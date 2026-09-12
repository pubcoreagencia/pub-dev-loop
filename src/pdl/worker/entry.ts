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

const PORT = Number(process.env.PDL_WORKER_PORT ?? 3003);
const POLL_INTERVAL_MS = Number(process.env.PDL_WORKER_POLL_INTERVAL_MS ?? process.env.WORKER_POLL_INTERVAL_MS ?? 3000);

export function createPdlWorkerDaemon(pool: Pool): BaseWorker {
  const tasks = new PostgresTaskRepository(pool);
  const providerName = process.env.AGENT_PROVIDER;

  if (providerName) {
    const provider = createProvider(providerName);
    if (provider.kind === 'mock') {
      console.error('[PDL Worker] FATAL: Real provider not configured (AGENT_PROVIDER resolves to mock). Worker cannot start.');
      process.exit(1);
    }
    const governance = new PdlGovernanceEngine({ pool });
    return new PdlCorrectionWorker(tasks, provider, 'pdl-router', undefined, pool, governance);
  }

  console.error('[PDL Worker] FATAL: No AGENT_PROVIDER defined. Worker cannot start without a real provider.');
  process.exit(1);
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

      const worker = createPdlWorkerDaemon(activePool);

      console.log(JSON.stringify({
        event: 'PDL_WORKER_STARTED',
        timestamp: new Date().toISOString(),
        intervalMs: POLL_INTERVAL_MS,
      }));

      let isShuttingDown = false;
      let cycleTimer: NodeJS.Timeout | null = null;

      const runCycle = async () => {
        if (isShuttingDown) return;
        try {
          await worker.executeOnce();
        } catch (e) {
          console.error('[PDL Worker] Cycle error:', (e as Error).message);
        } finally {
          if (!isShuttingDown) {
            cycleTimer = setTimeout(runCycle, POLL_INTERVAL_MS);
          }
        }
      };

      const shutdown = async (signal: string) => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        console.log(`[PDL Worker] Received ${signal}, graceful shutdown initiated...`);
        if (cycleTimer) clearTimeout(cycleTimer);
        try {
          if (activePool) await activePool.end();
        } catch {}
        process.exit(0);
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

      runCycle();
    } catch (err) {
      console.error('[PDL Worker] Initialization error:', (err as Error).message);
    }
  }
}
