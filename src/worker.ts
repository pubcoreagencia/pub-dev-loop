import 'dotenv/config';
import { Pool } from 'pg';
import { execSync } from 'node:child_process';
import { createProvider, createAgent } from './agent.js';
import { PostgresTaskRepository } from './repository.js';
import { RouterWorker } from './router-worker.js';
import { CodexWorker, BaseWorker } from './worker-service.js';
import { cleanupOrphanWorkspaces } from './workspace-cleanup.js';

const LEASE_TIMEOUT_MS = Number(process.env.WORKER_LEASE_TIMEOUT_MS ?? 30000);

/**
 * TASK-000032 Phase 5: Git identity configuration
 *
 * Configures git user.name and user.email at runtime (NOT via .gitconfig global).
 * Uses explicit environment-controlled identity for security and reproducibility.
 *
 * Identity is NOT user-controlled — always a fixed app identity unless overridden
 * by environment (allowing production/stage differentiation).
 */
const GIT_AUTHOR_NAME = process.env.GIT_AUTHOR_NAME ?? 'PUB DEV LOOP Worker';
const GIT_AUTHOR_EMAIL = process.env.GIT_AUTHOR_EMAIL ?? 'worker@pub-dev-loop.internal';

function configureGitIdentity(): void {
  try {
    execSync(`git config --global user.name "${GIT_AUTHOR_NAME}"`, { stdio: 'pipe' });
    execSync(`git config --global user.email "${GIT_AUTHOR_EMAIL}"`, { stdio: 'pipe' });
    execSync('git config --global init.defaultBranch main', { stdio: 'pipe' });
    // Mark all directories as safe (container environment)
    execSync('git config --global --add safe.directory "*"', { stdio: 'pipe' });
    console.log(`Git identity configured: ${GIT_AUTHOR_NAME} <${GIT_AUTHOR_EMAIL}>`);
  } catch (e) {
    console.error('Failed to configure git identity:', (e as Error).message);
    throw e;
  }
}

/**
 * PRODUCTION PATH UNIFICATION (TASK-000032 Phase 1)
 *
 * When AGENT_PROVIDER is set (e.g. '9router'), use RouterWorker which
 * has the full TASK-000030 retry/fallback + workspace isolation + trace.
 * When AGENT_MODE=codex (Codex CLI), use CodexWorker (single attempt, CLI agent).
 * When neither is set, defaults to mock via CodexWorker.
 */
export function createProductionWorker(): BaseWorker {
  const tasks = new PostgresTaskRepository(new Pool({ connectionString: process.env.DATABASE_URL }));
  const provider = process.env.AGENT_PROVIDER;

  if (provider) {
    const agentProvider = createProvider(provider);
    return new RouterWorker(tasks, agentProvider, provider);
  }

  const agent = createAgent();
  return new CodexWorker(tasks, agent);
}

// --- Entrypoint (only runs when executed directly, not imported) ---

const isMain = import.meta.url === `file://${process.argv[1]}`;

async function startupRecovery(tasks: PostgresTaskRepository): Promise<void> {
  // TASK-000032 Phase 5: Configure Git identity (runtime, not .gitconfig file)
  configureGitIdentity();

  // TASK-000032 Phase 3: Reclaim stale tasks (crash recovery)
  const reclaimCount = await tasks.reclaimStuck(
    'worker-startup',
    LEASE_TIMEOUT_MS * 2,
    new Date(),
  );
  if (reclaimCount > 0) {
    console.log(`Reclaimed ${reclaimCount} stale task(s) after restart`);
  }

  // TASK-000032 Phase 4: Cleanup orphan workspaces
  const cleaned = await cleanupOrphanWorkspaces();
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} orphan workspace(s)`);
  }
}

if (isMain) {
  const tasks = new PostgresTaskRepository(new Pool({ connectionString: process.env.DATABASE_URL }));
  startupRecovery(tasks).catch(e => console.error('Startup recovery failed:', e.message));

  const worker = createProductionWorker();
  const interval = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 3000);
  console.log(`Worker started (${worker.constructor.name})`);
  setInterval(
    () => worker.executeOnce().catch(e => console.error('Worker cycle failed', e.message)),
    interval,
  );
  worker.executeOnce().catch(e => console.error('Worker cycle failed', e.message));
}
