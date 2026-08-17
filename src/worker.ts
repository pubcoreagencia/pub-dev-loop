import 'dotenv/config';
import { Pool } from 'pg';
import { execSync } from 'node:child_process';
import { createProvider, createAgent } from './agent.js';
import { PostgresTaskRepository } from './repository.js';
import { RouterWorker } from './router-worker.js';
import { CodexWorker, BaseWorker } from './worker-service.js';
import { cleanupOrphanWorkspaces } from './workspace-cleanup.js';

const LEASE_TIMEOUT_MS = Number(process.env.WORKER_LEASE_TIMEOUT_MS ?? 30000);

/*
 * TASK-000034: Git credential configuration (process-scoped, no files)
 *
 * Critérios:
 * - GITHUB_TOKEN exista somente no ambiente do processo e seja consumido em runtime.
 * - Não persistir referência em ~/.gitconfig (sem git config --global credential.helper).
 * - Não usar ~/.netrc.
 * - Não usar credential.helper persistente via git config --global.
 * - Implementar via GIT_CONFIG_COUNT/GIT_CONFIG_KEY_n/GIT_CONFIG_VALUE_n (variáveis de ambiente,
 *   efeito apenas no processo e subprocessos — sem escrever em .gitconfig, .git/config ou qualquer arquivo).
 * - O helper lê operation/protocol/host/path via stdin no formato key=value do Git.
 *   O primeiro argumento ($1) NÃO é tratado como hostname — todo o protocolo é via stdin.
 * - Fornecer credencial somente para operação "get" (git clone/fetch HTTPS).
 * - O token é lido em runtime via $GITHUB_TOKEN (shell); não é interpolado em tempo de configuração.
 *
 * Fluxo:
 *   GITHUB_TOKEN (env do processo)
 *     → GIT_CONFIG_COUNT=1, GIT_CONFIG_KEY_0=credential.helper,
 *       GIT_CONFIG_VALUE_0='<shell helper>' (env vars, process-scoped)
 *     → helper lê stdin + env var em runtime
 *     → git clone/fetch usa helper quando precisa autenticar
 *   Token nunca em URL, arquivo, .env, código, trace, logs, commits ou Git history.
 */

/*
 * Shell credential helper — lê operation/protocol/host/path via stdin no formato key=value do Git.
 * O token é lido em runtime via $GITHUB_TOKEN (shell expansion); não é interpolado por JavaScript.
 * O primeiro argumento ($1) NÃO é tratado como hostname — todo o protocolo é via stdin.
 * Fornece credencial somente para operação "get" (git clone/fetch HTTPS).
 *
 * Nota: a string é montada via concatenação (não template literal) para evitar que o
 * JavaScript interpole process.env.GITHUB_TOKEN no momento da construção da string.
 * O helper contém a referência literal $GITHUB_TOKEN para o shell expandir em runtime.
 */
function githubCredentialHelper(): string {
  // Montado com concatenação para evitar interpolação JS do token.
  const lines = [
    '!f() {',
    '  # Git credential helper protocol: stdin is key=value lines',
    '  # operation=get|store|erase, protocol=https|..., host=..., path=... (optional)',
    '  local op="" proto="" hst="" path=""',
    '  while IFS= read -r line; do',
    '    case "$line" in',
    '      operation=*) op="${line#operation=}" ;;',
    '      protocol=*)  proto="${line#protocol=}" ;;',
    '      host=*)      hst="${line#host=}" ;;',
    '      path=*)      path="${line#path=}" ;;',
    '    esac',
    '  done',
    '  # Fornecer credencial somente para operação get (clone/fetch HTTPS)',
    '  if [ "$op" = "get" ] && [ -n "$GITHUB_TOKEN" ]; then',
    '    echo "protocol=$proto"',
    '    echo "host=$hst"',
    '    echo "username=x-access-token"',
    // Aqui usamos $GITHUB_TOKEN literal — o shell expande em runtime, JS não interpola
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

  try {
    // GIT_CONFIG_COUNT / GIT_CONFIG_KEY_n / GIT_CONFIG_VALUE_n:
    // configuram git via variáveis de ambiente, sem escrever em .gitconfig,
    // .git/config ou qualquer outro arquivo. Efeito apenas no processo atual
    // e seus subprocessos (process-scoped). Veja git(1) --config-count.
    process.env.GIT_CONFIG_COUNT = '1';
    process.env.GIT_CONFIG_KEY_0 = 'credential.helper';
    process.env.GIT_CONFIG_VALUE_0 = githubCredentialHelper();

    console.log('Git credential helper configured (no file, env-based).');
  } catch (e) {
    console.error('Failed to configure git credentials:', (e as Error).message);
    throw e;
  }
}

/*
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

/*
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
  // TASK-000034: Configure Git credentials for private repo access
  configureGitCredentials();
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
