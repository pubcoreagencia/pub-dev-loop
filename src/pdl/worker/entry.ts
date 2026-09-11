import 'dotenv/config';
import http from 'node:http';
import { Pool } from 'pg';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createProvider, createAgent } from '../../agent.js';
import { PostgresTaskRepository } from '../../repository.js';
import { RouterWorker } from '../../router-worker.js';
import { CodexWorker, BaseWorker } from '../../worker-service.js';
import { configureGitCredentials } from '../../worker.js';

const PORT = Number(process.env.PDL_WORKER_PORT ?? 3003);
const POLL_INTERVAL_MS = Number(process.env.PDL_WORKER_POLL_INTERVAL_MS ?? process.env.WORKER_POLL_INTERVAL_MS ?? 3000);

export function createPdlWorkerDaemon(pool: Pool): BaseWorker {
  const tasks = new PostgresTaskRepository(pool);
  const providerName = process.env.AGENT_PROVIDER;

  if (providerName) {
    const provider = createProvider(providerName);
    return new RouterWorker(tasks, provider, 'pdl-router');
  }

  return new CodexWorker(tasks, createAgent());
}

export function startPdlHealthServer(port = PORT): http.Server {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      worker: 'PUB Development Loop Dedicated Worker',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'pdl-worker',
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
  startPdlHealthServer();

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[PDL Worker] FATAL: DATABASE_URL is not configured. Worker cannot start.');
  } else {
    try {
      configureGitCredentials();
      const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: isLocal ? false : { rejectUnauthorized: false },
      });

      const worker = createPdlWorkerDaemon(pool);

      console.log(JSON.stringify({
        event: 'PDL_WORKER_STARTED',
        timestamp: new Date().toISOString(),
        intervalMs: POLL_INTERVAL_MS,
      }));

      const runCycle = async () => {
        try {
          await worker.executeOnce();
        } catch (e) {
          console.error('[PDL Worker] Cycle error:', (e as Error).message);
        } finally {
          setTimeout(runCycle, POLL_INTERVAL_MS);
        }
      };

      runCycle();
    } catch (err) {
      console.error('[PDL Worker] Initialization error:', (err as Error).message);
    }
  }
}
