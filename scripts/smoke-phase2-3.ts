import 'dotenv/config';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { Pool } from 'pg';
import { PostgresAutonomyStateRepository } from '../src/office/autonomy-state-repository.js';
import { PostgresTaskRepository } from '../src/repository.js';
import { OpenRouterProvider } from '../src/providers/openrouter.js';
import { RouterProvider } from '../src/providers/router.js';
import { DualGatewayProvider } from '../src/providers/gateway.js';
import { RouterWorker } from '../src/router-worker.js';
import {
  AutonomousExecutionController,
  WorkerRuntimeAdapter,
} from '../src/office/autonomous-execution-controller.js';
import {
  createInitialSystemState,
  type Mission,
  type SystemCurrentState,
} from '../src/office/autonomy-loop.js';
import { defaultApprovalManager } from '../src/office/approval.js';
import { resolveOpenRouterApiKey } from '../src/providers/shared.js';

function git(cwd: string, cmd: string): string {
  return execSync(`git ${cmd}`, { cwd, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
}

export interface SmokeTestReport {
  timestamp: string;
  environment: {
    OPENROUTER_API_KEY: 'PRESENT' | 'MISSING';
    ROUTER_API_KEY: 'PRESENT' | 'MISSING';
    DATABASE_URL: 'PRESENT' | 'MISSING';
  };
  model: string;
  fixture: {
    directory: string;
    baselineSha: string;
    baselineTestPassed: boolean;
  };
  execution?: {
    cycleNumber: number;
    durationMs: number;
    executionStatus: string;
    validationStatus: string;
    stopped: boolean;
    stopReason?: string;
    evidence: string[];
    changedFiles: string[];
    commitSha?: string;
    testsPassed?: boolean;
    providerErrorCode?: string;
    providerErrorMessage?: string;
  };
  idempotency?: {
    verified: boolean;
    cycle1Status: string;
  };
  recovery?: {
    verified: boolean;
    missionStatus: string;
  };
  verdict: 'VERIFIED' | 'PARTIAL' | 'BLOCKED_BY_ENVIRONMENT' | 'FAILED';
}

export async function runSmokeTest(options?: { allowHaltIfBlocked?: boolean }): Promise<SmokeTestReport> {
  const allowHalt = options?.allowHaltIfBlocked ?? true;

  console.log('========================================================');
  console.log('PDL PHASE 2.3 — REAL AUTONOMOUS ENGINEERING SMOKE RUNNER');
  console.log('========================================================\n');

  // 1. Environment Preflight
  const resolvedOpenRouterKey = resolveOpenRouterApiKey();
  const resolvedRouterKey = process.env.ROUTER_API_KEY?.trim();
  const resolvedDbUrl = process.env.DATABASE_URL?.trim();

  const envPreflight = {
    OPENROUTER_API_KEY: resolvedOpenRouterKey ? 'PRESENT' as const : 'MISSING' as const,
    ROUTER_API_KEY: resolvedRouterKey ? 'PRESENT' as const : 'MISSING' as const,
    DATABASE_URL: resolvedDbUrl ? 'PRESENT' as const : 'MISSING' as const,
  };

  console.log('[1] ENVIRONMENT PREFLIGHT:');
  console.log(`- OPENROUTER_API_KEY: ${envPreflight.OPENROUTER_API_KEY}`);
  console.log(`- ROUTER_API_KEY:     ${envPreflight.ROUTER_API_KEY}`);
  console.log(`- DATABASE_URL:       ${envPreflight.DATABASE_URL}`);

  const hasModelCredentials = envPreflight.OPENROUTER_API_KEY === 'PRESENT' || envPreflight.ROUTER_API_KEY === 'PRESENT';

  if (!hasModelCredentials && allowHalt) {
    console.log('\n[NOTICE] Model gateway credentials (OPENROUTER_API_KEY or ROUTER_API_KEY) are absent.');
    console.log('[NOTICE] Halting live execution to prevent fake progress or unauthenticated calls.');
    console.log('STATUS: BLOCKED_BY_ENVIRONMENT\n');
    return {
      timestamp: new Date().toISOString(),
      environment: envPreflight,
      model: 'none',
      fixture: {
        directory: 'none',
        baselineSha: 'none',
        baselineTestPassed: false,
      },
      verdict: 'BLOCKED_BY_ENVIRONMENT',
    };
  }

  // 2. Create Isolated Disposable Git Fixture
  const fixtureDir = await mkdtemp(join(tmpdir(), 'pdl-smoke-fixture-'));
  console.log(`\n[2] CREATING ISOLATED DISPOSABLE FIXTURE: ${fixtureDir}`);
  await mkdir(join(fixtureDir, 'src'), { recursive: true });
  await mkdir(join(fixtureDir, 'tests'), { recursive: true });

  await writeFile(
    join(fixtureDir, 'package.json'),
    JSON.stringify({
      name: 'pdl-smoke-fixture',
      version: '1.0.0',
      type: 'module',
      scripts: {
        test: 'node --test tests/*.test.js',
      },
    }, null, 2)
  );

  await writeFile(
    join(fixtureDir, 'src', 'smoke.js'),
    `export function ping() {\n  return 'pong';\n}\n`
  );

  await writeFile(
    join(fixtureDir, 'tests', 'smoke.test.js'),
    `import test from 'node:test';\nimport assert from 'node:assert';\nimport { ping } from '../src/smoke.js';\n\ntest('ping returns pong', () => {\n  assert.strictEqual(ping(), 'pong');\n});\n`
  );

  git(fixtureDir, 'init');
  git(fixtureDir, 'config user.name "PDL Smoke Tester"');
  git(fixtureDir, 'config user.email "smoke@pdl.dev"');
  git(fixtureDir, 'config commit.gpgsign false');
  git(fixtureDir, 'add .');
  git(fixtureDir, 'commit -m "chore: initial fixture baseline"');

  const baselineSha = git(fixtureDir, 'rev-parse HEAD');
  console.log(`- Baseline Git Commit: ${baselineSha}`);

  let baselineTestPassed = false;
  try {
    const testOut = execSync('npm test', { cwd: fixtureDir, stdio: 'pipe' }).toString();
    baselineTestPassed = true;
    console.log(`- Fixture baseline test check: PASS (${testOut.trim().split('\n').pop()})`);
  } catch (err: any) {
    console.log(`- Fixture baseline test check: FAIL (${err.message})`);
  }

  // 3. Assemble Production Components
  console.log('\n[3] ASSEMBLING REAL PRODUCTION COMPONENTS:');
  const pool = resolvedDbUrl ? new Pool({ connectionString: resolvedDbUrl }) : undefined;
  const stateRepo = new PostgresAutonomyStateRepository(pool);
  const taskRepo = new PostgresTaskRepository(pool as any);

  const selectedModel = process.env.OPENROUTER_MODEL || (resolvedOpenRouterKey ? 'anthropic/claude-3.5-haiku' : 'openrouter/free');

  const openRouterProvider = new OpenRouterProvider(
    process.env.OPENROUTER_BASE_URL,
    resolvedOpenRouterKey,
    60000,
    selectedModel
  );

  const routerProvider = new RouterProvider(
    process.env.ROUTER_BASE_URL,
    resolvedRouterKey,
    60000,
    undefined
  );

  const dualGateway = new DualGatewayProvider(openRouterProvider, routerProvider);

  const worker = new RouterWorker(
    taskRepo,
    dualGateway,
    'smoke-worker'
  );

  const workerRuntime = new WorkerRuntimeAdapter(worker, taskRepo);

  const controller = new AutonomousExecutionController(
    taskRepo,
    defaultApprovalManager,
    workerRuntime,
    stateRepo
  );

  console.log(`- Model configured: ${selectedModel}`);
  console.log('- DualGatewayProvider: PRIMARY = OpenRouter, FALLBACK = 9Router');
  console.log('- RouterWorker: WIRED with DualGatewayProvider');
  console.log('- WorkerRuntimeAdapter: WIRED with RouterWorker & TaskRepository');
  console.log('- AutonomousExecutionController: WIRED with AutonomyStateRepository & WorkerRuntimeAdapter');

  // 4. Mission Definition
  const missionId = `mission-smoke-${Date.now()}`;
  const mission: Mission = {
    id: missionId,
    project: fixtureDir,
    title: 'Autonomous Engineering Smoke Test - Ping Pong Feature',
    objective: 'Add an exported function pong() returning "ping" to src/smoke.js, update tests, and make all tests pass.',
    targetCapabilities: ['INTENT_ENGINE'],
    constraints: ['Must keep risk LOW', 'Do not modify package.json'],
    riskPolicy: 'STANDARD',
    maxCycles: 2,
    createdAt: new Date().toISOString(),
    status: 'ACTIVE',
  };

  const initialState: SystemCurrentState = createInitialSystemState(mission);
  await stateRepo.createMission(mission);
  await stateRepo.saveCurrentState(initialState);

  console.log(`\n[4] MISSION CREATED: ${mission.id} (status: ${mission.status})`);

  // 5. Execute Cycle 1 (Real Path)
  console.log('\n[5] EXECUTING CYCLE 1 THROUGH REAL CONTROLLER & WORKER RUNTIME...');
  const cycle1Start = Date.now();
  const { result: cycle1Result, nextState: stateAfterCycle1 } = await controller.executeCycle(
    mission,
    initialState,
    1
  );
  const cycle1Duration = Date.now() - cycle1Start;

  console.log(`- Cycle 1 Duration: ${cycle1Duration}ms`);
  console.log(`- Execution Status: ${cycle1Result.executionStatus}`);
  console.log(`- Validation Status: ${cycle1Result.validationStatus}`);
  console.log(`- Stopped: ${cycle1Result.stopped}, Reason: ${cycle1Result.stopReason}`);
  console.log(`- Evidence items: ${cycle1Result.evidence.length}`);
  cycle1Result.evidence.forEach(e => console.log(`  * ${e}`));

  // Check generated task in repo
  let generatedTask = null;
  if (cycle1Result.taskId) {
    generatedTask = await taskRepo.get(cycle1Result.taskId);
    console.log(`- Generated Task ID: ${cycle1Result.taskId} (status: ${generatedTask?.status})`);
  }

  // Inspect Git state in fixture
  const currentHead = git(fixtureDir, 'rev-parse HEAD');
  const gitDiff = git(fixtureDir, 'status --porcelain');
  console.log(`- Fixture HEAD after execution: ${currentHead} (Baseline: ${baselineSha})`);
  console.log(`- Fixture Uncommitted Changes: ${gitDiff ? gitDiff : 'None'}`);

  // Test Idempotency
  console.log('\n[6] VERIFYING DURABLE CYCLE IDEMPOTENCY:');
  const duplicateAttempt = await controller.executeCycle(mission, stateAfterCycle1, 1);
  const idempotencyVerified = duplicateAttempt.result.executionStatus === cycle1Result.executionStatus;
  console.log(`- Duplicate acquisition safe: ${idempotencyVerified}`);

  // Test Recovery & Coherence
  console.log('\n[7] VERIFYING RECOVERY & COHERENCE:');
  const recovered = await controller.recoverMission(missionId);
  const recoveryVerified = recovered.mission?.status === 'ACTIVE' || recovered.mission?.status === 'COMPLETED';
  console.log(`- Mission recovered coherence: ${recoveryVerified}`);

  // Finalize verdict
  let verdict: SmokeTestReport['verdict'] = 'FAILED';
  if (cycle1Result.executionStatus === 'COMPLETED' && cycle1Result.validationStatus === 'PASSED') {
    verdict = 'VERIFIED';
  } else if (!hasModelCredentials) {
    verdict = 'BLOCKED_BY_ENVIRONMENT';
  } else if (cycle1Result.executionStatus === 'COMPLETED') {
    verdict = 'PARTIAL';
  }

  // Clean up fixture directory
  try {
    await rm(fixtureDir, { recursive: true, force: true });
    console.log(`\n[8] Cleaned up disposable fixture: ${fixtureDir}`);
  } catch {}

  console.log('\n========================================================');
  console.log(`SMOKE RUNNER RESULT: ${verdict}`);
  console.log('========================================================\n');

  return {
    timestamp: new Date().toISOString(),
    environment: envPreflight,
    model: selectedModel,
    fixture: {
      directory: fixtureDir,
      baselineSha,
      baselineTestPassed,
    },
    execution: {
      cycleNumber: 1,
      durationMs: cycle1Duration,
      executionStatus: cycle1Result.executionStatus,
      validationStatus: cycle1Result.validationStatus,
      stopped: cycle1Result.stopped,
      stopReason: cycle1Result.stopReason,
      evidence: cycle1Result.evidence,
      changedFiles: generatedTask?.result ? (generatedTask.result as any).changedFiles || [] : [],
      commitSha: generatedTask?.commitSha || undefined,
      testsPassed: generatedTask?.result ? (generatedTask.result as any).finalize?.testsPassed : undefined,
      providerErrorCode: (generatedTask?.result as any)?.errorCode,
      providerErrorMessage: generatedTask?.error || undefined,
    },
    idempotency: {
      verified: idempotencyVerified,
      cycle1Status: cycle1Result.executionStatus,
    },
    recovery: {
      verified: recoveryVerified,
      missionStatus: recovered.mission?.status || 'UNKNOWN',
    },
    verdict,
  };
}

// Direct execution entrypoint
const isDirectExecution = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/smoke-phase2-3.ts');
if (isDirectExecution) {
  runSmokeTest().catch(err => {
    console.error('Fatal error in smoke test runner:', err);
    process.exit(1);
  });
}
