import 'dotenv/config';
import { Pool } from 'pg';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createProvider, createAgent } from './agent.js';
import { PostgresTaskRepository } from './repository.js';
import { PostgresPrototypeRepository } from './prototype/repository.js';
import { PostgresPrototypeEventPublisher } from './prototype/events.js';
import { CodexWorker, BaseWorker } from './worker-service.js';
import { ModeAwareWorker } from './mode-aware-worker.js';
import { cleanupOrphanWorkspaces } from './workspace-cleanup.js';

const LEASE_TIMEOUT_MS = Number(process.env.WORKER_LEASE_TIMEOUT_MS ?? 30000);

function githubCredentialHelper(): string {
  const lines = [
    '!f() {',
    '  local op="" proto="" hst="" path=""',
    '  while IFS= read -r line; do',
    '    case "$line" in',
    '      operation=*) op="${line#operation=}" ;;',
    '      protocol=*)  proto="${line#protocol=}" ;;',
    '      host=*)      hst="${line#host=}" ;;',
    '      path=*)      path="${line#path=}" ;;',
    '    esac',
    '  done',
    '  if [ "$op" = "get" ] && [ -n "$GITHUB_TOKEN" ]; then',
    '    echo "protocol=$proto"',
    '    echo "host=$hst"',
    '    echo "username=x-access-token"',
    '    echo "password=$GITHUB_TOKEN"',
    '  fi',
    '}; f',
  ];
  return lines.join('\n');
}

export function configureGitCredentials(): void {
  if (!process.env.GITHUB_TOKEN) {
    console.log('No GITHUB_TOKEN set — public repos only.');
    return;
  }
  process.env.GIT_CONFIG_COUNT = '1';
  process.env.GIT_CONFIG_KEY_0 = 'credential.helper';
  process.env.GIT_CONFIG_VALUE_0 = githubCredentialHelper();
  console.log('Git credential helper configured (no file, env-based).');
}

const GIT_AUTHOR_NAME = process.env.GIT_AUTHOR_NAME ?? 'PUB DEV LOOP Worker';
const GIT_AUTHOR_EMAIL = process.env.GIT_AUTHOR_EMAIL ?? 'worker@pub-dev-loop.internal';

function configureGitIdentity(): void {
  try {
    execSync(`git config --global user.name "${GIT_AUTHOR_NAME}"`, { stdio: 'pipe' });
    execSync(`git config --global user.email "${GIT_AUTHOR_EMAIL}"`, { stdio: 'pipe' });
    execSync('git config --global init.defaultBranch main', { stdio: 'pipe' });
    execSync('git config --global --add safe.directory "*"', { stdio: 'pipe' });
  } catch (e) {
    console.error('Failed to configure git identity:', (e as Error).message);
    throw e;
  }
}

export function createProductionWorker(): BaseWorker | ModeAwareWorker {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured in worker environment');
  }

  const pool = new Pool({ connectionString });
  const tasks = new PostgresTaskRepository(pool);
  const providerName = process.env.AGENT_PROVIDER;

  if (providerName) {
    const provider = createProvider(providerName);
    const prototypes = new PostgresPrototypeRepository(pool);
    const events = new PostgresPrototypeEventPublisher(pool);
    return new ModeAwareWorker(tasks, prototypes, provider, events);
  }

  return new CodexWorker(tasks, createAgent());
}

const currentFile = fileURLToPath(import.meta.url);
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isMain = Boolean(entryFile && currentFile === entryFile);
const shouldRunWorker = isMain || (!process.env.VITEST && process.env.NODE_ENV !== 'test');

async function startupRecovery(tasks: PostgresTaskRepository): Promise<void> {
  configureGitCredentials();
  configureGitIdentity();

  const reclaimCount = await tasks.reclaimStuck(
    'worker-startup',
    LEASE_TIMEOUT_MS * 2,
    new Date(),
  );
  if (reclaimCount > 0) {
    console.log(`Reclaimed ${reclaimCount} stale task(s) after restart`);
  }

  const cleaned = await cleanupOrphanWorkspaces();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} orphan workspace(s)`);
  }
}

if (shouldRunWorker) {
  const dbUrl = process.env.DATABASE_URL;
  const isDbConfigured = Boolean(dbUrl && dbUrl.trim().length > 0);
  const isOpenRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim().length > 0);

  console.log(JSON.stringify({
    event: 'CONTAINER_START',
    timestamp: new Date().toISOString(),
    databaseConfigured: isDbConfigured,
    openrouterConfigured: isOpenRouterConfigured,
    primaryGateway: process.env.PRIMARY_GATEWAY || 'openrouter',
    fallbackGateway: process.env.FALLBACK_GATEWAY || '9router',
    agentProvider: process.env.AGENT_PROVIDER || 'gateway',
  }));

  if (!isDbConfigured) {
    console.error('[Worker Container] FATAL: DATABASE_URL is not configured in container environment. Worker cannot start.');
  } else {
    try {
      const pool = new Pool({ connectionString: dbUrl });
      const tasks = new PostgresTaskRepository(pool);

      console.log(JSON.stringify({
        event: 'DATABASE_CONFIGURED',
        timestamp: new Date().toISOString(),
        databaseConfigured: true,
      }));

      startupRecovery(tasks).catch(e => console.error('[Worker Container] Startup recovery notice:', e.message));

      const worker = createProductionWorker();
      const interval = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 3000);

      console.log(JSON.stringify({
        event: 'WORKER_LOOP_STARTED',
        timestamp: new Date().toISOString(),
        workerClass: worker.constructor.name,
        intervalMs: interval,
      }));

      const runCycle = async () => {
        try {
          await worker.executeOnce();
        } catch (e) {
          console.error('[Worker Container] Worker cycle error:', (e as Error).message);
        } finally {
          setTimeout(runCycle, interval);
        }
      };

      runCycle();
    } catch (err) {
      console.error('[Worker Container] Initialization error:', (err as Error).message);
    }
  }
}
