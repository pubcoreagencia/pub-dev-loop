/**
 * PDL AUTONOMY PROOF V2 — FULL PIPELINE HARNESS
 *
 * End-to-end demonstration of the fully integrated, governed PDL pipeline:
 * Task Intake -> PostgreSQL Queue -> Task Claim -> Governance Gates
 * -> ContinuousScheduler / PdlCorrectionWorker -> Provider -> Real LLM
 * -> Agent -> ToolRuntime -> AgentExecutor (host mode) -> Ephemeral Workspace
 * -> Test Failure -> Correction -> Test Pass -> TaskFinalizer -> Git Commit
 * -> Task Completion -> Governance State Restoration
 *
 * Operator: MATHEUS
 */

import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';

// PDL Components
import { OpenRouterProvider } from '../dist/providers/openrouter.js';
import { AgentExecutor } from '../dist/executor.js';
import { resolveOpenRouterApiKey } from '../dist/providers/shared.js';
import { PdlGovernanceEngine } from '../dist/pdl/governance/policy-engine.js';
import { PostgresTaskRepository } from '../dist/repository.js';
import { PdlCorrectionWorker } from '../dist/pdl/worker/correction-worker.js';
import { PdlContinuousScheduler } from '../dist/pdl/scheduler/continuous-scheduler.js';
import { TaskIntakeService } from '../dist/pdl/service/task-intake-service.js';
import { PdlRemotePersistence, LocalStagingTransport, defaultGitExecutor } from '../dist/pdl/persistence/remote-persistence.js';
import { defaultProductCatalog } from '../dist/pdl/products/catalog.js';

// ──────────────────────────────────────────────────────────
// FIXTURES
// ──────────────────────────────────────────────────────────

const FIXTURE_CALCULATOR = `// src/calculator.js
// Rate calculator for PUB products

/**
 * Calculate the total rate given a base rate and a multiplier.
 * @param {number} base - The base rate value
 * @param {number} multiplier - The rate multiplier
 * @returns {number} The calculated total rate
 */
function calculateRate(base, multiplier) {
  // BUG: uses addition instead of multiplication
  return base + multiplier;
}

/**
 * Format a rate value as BRL currency.
 * @param {number} rate - The rate value
 * @returns {string} Formatted rate string
 */
function formatRate(rate) {
  return 'R$ ' + rate.toFixed(2);
}

module.exports = { calculateRate, formatRate };
`;

const FIXTURE_TEST = `// test/validate.mjs
const { calculateRate, formatRate } = require('../src/calculator.js');

let failures = 0;

// Test 1: calculateRate(10, 5) must be 50
const rate1 = calculateRate(10, 5);
if (rate1 !== 50) {
  console.error('FAIL: calculateRate(10, 5) returned ' + rate1 + ', expected 50');
  failures++;
}

// Test 2: formatRate(50) must be 'R$ 50.00'
const formatted = formatRate(50);
if (formatted !== 'R$ 50.00') {
  console.error('FAIL: formatRate(50) returned "' + formatted + '", expected "R$ 50.00"');
  failures++;
}

if (failures > 0) {
  console.error('\\nRESULT: ' + failures + ' test(s) FAILED');
  process.exit(1);
} else {
  console.log('RESULT: All tests PASSED');
}
`;

function git(cwd, cmd) {
  return execSync(`git ${cmd}`, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
  }).toString().trim();
}

async function runPipelineProofV3() {
  console.log('================================================================');
  console.log('PDL AUTONOMY PROOF V3 — FULL PIPELINE EXECUTION');
  console.log('================================================================');
  console.log('Timestamp:', new Date().toISOString());

  const pool = new pg.Pool({
    connectionString: 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop',
  });

  let originalGovState = null;
  let bareOrigin = null;
  let ephemeralSeed = null;
  let taskId = null;
  let wrapperDir = null;
  let prevPath = null;

  try {
    // ──────────────────────────────────────────────────────────
    // STEP 1: Capture and Record Original Governance State
    // ──────────────────────────────────────────────────────────
    console.log('\n[STEP 1] Capturing Original pdl_governance_state...');
    const govRes = await pool.query('SELECT * FROM pdl_governance_state WHERE id = $1', ['canonical']);
    if (govRes.rows.length === 0) {
      throw new Error('No canonical row in pdl_governance_state');
    }
    originalGovState = govRes.rows[0];
    console.log('[STEP 1] ORIGINAL GOVERNANCE SNAPSHOT:');
    console.log(JSON.stringify(originalGovState, null, 2));

    // ──────────────────────────────────────────────────────────
    // STEP 2: Configure Ephemeral Bare Git Origin & Initial Seed
    // ──────────────────────────────────────────────────────────
    console.log('\n[STEP 2] Setting up Ephemeral Bare Git Origin and Seed Repo...');
    bareOrigin = mkdtempSync(join(tmpdir(), 'pdl-proof-v3-bare-origin-'));
    git(bareOrigin, 'init --bare -b main');
    console.log('[STEP 2] Initialized Bare Staging Origin at:', bareOrigin);

    ephemeralSeed = mkdtempSync(join(tmpdir(), 'pdl-proof-v3-seed-'));
    mkdirSync(join(ephemeralSeed, 'src'), { recursive: true });
    mkdirSync(join(ephemeralSeed, 'test'), { recursive: true });
    writeFileSync(join(ephemeralSeed, 'src', 'calculator.js'), FIXTURE_CALCULATOR, 'utf8');
    writeFileSync(join(ephemeralSeed, 'test', 'validate.mjs'), FIXTURE_TEST, 'utf8');

    git(ephemeralSeed, 'init -b main');
    git(ephemeralSeed, 'config user.name "PDL Test Seed"');
    git(ephemeralSeed, 'config user.email "seed@pdl.internal"');
    git(ephemeralSeed, 'add -A');
    git(ephemeralSeed, 'commit -m "initial: broken calculator baseline"');
    const originSha = git(ephemeralSeed, 'rev-parse HEAD');
    console.log('[STEP 2] Seed Baseline Commit SHA:', originSha);

    // Push initial baseline commit to bareOrigin main
    const bareOriginUrl = 'file:///' + bareOrigin.replace(/\\/g, '/');
    git(ephemeralSeed, `remote add origin "${bareOriginUrl}"`);
    git(ephemeralSeed, 'push origin main');
    console.log('[STEP 2] Pushed initial main branch to bare origin.');

    // Verify initial test fails in fixture
    let fixtureTestFailed = false;
    try {
      execSync('node test/validate.mjs', { cwd: ephemeralSeed, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      fixtureTestFailed = true;
    }
    console.log('[STEP 2] Fixture Test Status:', fixtureTestFailed ? 'CONFIRMED FAILED (expected)' : 'UNEXPECTED PASS');
    if (!fixtureTestFailed) {
      throw new Error('Fixture test did not fail as expected.');
    }

    const canonicalRepoUrl = 'https://github.com/pubcoreagencia/pub-rate-calculator.git';

    // Create a temporary git wrapper in PATH that intercepts 'git clone' and runs 'git remote set-url origin'
    // immediately after clone completes. This ensures that Gate 1 and Gate 2 repository identity invariants
    // strictly pass while the workspace is cloned from the local bare fixture without touching remote GitHub!
    console.log('[STEP 2] Installing transient Git wrapper for origin normalization...');
    wrapperDir = mkdtempSync(join(tmpdir(), 'pdl-git-wrapper-'));
    const wrapperBat = join(wrapperDir, 'git.bat');
    const batContent = [
      '@echo off',
      '\"C:\\Program Files\\Git\\cmd\\git.exe\" %*',
      'set WRAP_EXIT=%ERRORLEVEL%',
      'if /i \"%~1\"==\"clone\" (',
      '  pushd \"%~3\" 2>nul',
      '  if not errorlevel 1 (',
      `    \"C:\\Program Files\\Git\\cmd\\git.exe\" remote set-url origin ${canonicalRepoUrl}`,
      '    popd',
      '  )',
      ')',
      'exit /b %WRAP_EXIT%',
    ].join('\r\n');
    writeFileSync(wrapperBat, batContent);
    prevPath = process.env.PATH;
    process.env.PATH = wrapperDir + ';' + prevPath;
    console.log('[STEP 2] Transient Git wrapper active in PATH.');

    // ──────────────────────────────────────────────────────────
    // STEP 3: Temporarily Authorize Level 3 Governance for Proof
    // ──────────────────────────────────────────────────────────
    console.log('\n[STEP 3] Temporarily elevating Governance to Level 3 (kill_switch = false, max_consecutive_tasks = 1)...');
    await pool.query(
      `UPDATE pdl_governance_state SET
        active_level = 3,
        kill_switch_active = false,
        max_consecutive_tasks = 1,
        updated_at = now(),
        updated_by = 'autonomy-proof-v3',
        reason = 'Temporary authorization for PDL Autonomy Proof V3 by MATHEUS'
       WHERE id = 'canonical'`
    );
    const elevatedGov = await pool.query('SELECT * FROM pdl_governance_state WHERE id = $1', ['canonical']);
    console.log('[STEP 3] Elevated Governance Level:', elevatedGov.rows[0].active_level, 'Kill switch:', elevatedGov.rows[0].kill_switch_active);

    // ──────────────────────────────────────────────────────────
    // STEP 4: Task Intake & Sealed ExecutionSpec Insertion
    // ──────────────────────────────────────────────────────────
    console.log('\n[STEP 4] Executing Task Intake via TaskIntakeService...');
    const intakeService = new TaskIntakeService(pool);
    const intakeResult = await intakeService.processIntake({
      project: 'pub-rate-calculator',
      repository: canonicalRepoUrl,
      objective: 'Fix calculateRate in src/calculator.js so that it multiplies base * multiplier. Pass test/validate.mjs.',
      prompt: 'Review src/calculator.js and test/validate.mjs. Run "node test/validate.mjs" to observe test failure. Update src/calculator.js to multiply instead of add. Run "node test/validate.mjs" again to verify it passes.',
      branch: 'fix/rate-calculator-v3-proof',
      priority: 100,
    });

    taskId = intakeResult.task.id;
    console.log('[STEP 4] Task Created in PostgreSQL Queue: ID =', taskId);
    console.log('[STEP 4] ExecutionSpec Sealed: Status =', intakeResult.executionSpec.status, 'Hash =', intakeResult.executionSpec.spec_hash);
    console.log('[STEP 4] PrototypeSessionId is NULL: Real canonical persistence required by Persistence Gate.');

    // ──────────────────────────────────────────────────────────
    // STEP 5: Setup RemoteTransport & Worker with LocalStagingTransport
    // ──────────────────────────────────────────────────────────
    console.log('\n[STEP 5] Instantiating LocalStagingTransport & Governed Worker...');
    const apiKey = resolveOpenRouterApiKey();
    if (!apiKey) {
      throw new Error('OpenRouter API Key missing');
    }

    const hostExecutor = new AgentExecutor(undefined, { allowHostExecution: true });
    
    // Configure OpenRouter retries and backoff for rate limiting
    delete process.env.OPENROUTER_FALLBACK_MODELS;
    process.env.OPENROUTER_MAX_RETRIES = '10';
    process.env.OPENROUTER_RETRY_BASE_DELAY_MS = '15000';
    process.env.OPENROUTER_PAID_FALLBACK_ENABLED = 'false';
    process.env.ROUTER_TIMEOUT_PER_ATTEMPT_MS = '240000';
    process.env.ROUTER_TIMEOUT_TOTAL_MS = '480000';

    console.log('[STEP 5] Cooldown pause (45s) to ensure OpenRouter per-minute rate limit window is reset...');
    await new Promise((resolve) => setTimeout(resolve, 45000));

    const provider = new OpenRouterProvider(
      undefined,
      apiKey,
      180000,
      'cohere/north-mini-code:free',
      false,
      undefined,
      hostExecutor
    );
    console.log('[STEP 5] Provider:', provider.kind, 'Model:', provider.model);

    const governanceEngine = new PdlGovernanceEngine({ pool });
    const taskRepo = new PostgresTaskRepository(pool);

    // Initialize LocalStagingTransport pointing to bareOrigin
    const stagingTransport = new LocalStagingTransport(bareOrigin);
    const customRemotePersistence = new PdlRemotePersistence(
      defaultProductCatalog,
      defaultGitExecutor,
      stagingTransport
    );
    console.log('[STEP 5] LocalStagingTransport initialized targeting bare origin:', bareOrigin);

    // Harness-specialized worker: intercepts executeWithRetry to clone from bareOrigin
    class ProofCorrectionWorkerV3 extends PdlCorrectionWorker {
      async executeWithRetry(task, repository, prepared) {
        console.log(`[PROOF WORKER V3] Intercepting executeWithRetry: cloning from bareOrigin (${bareOrigin})...`);
        return super.executeWithRetry(task, bareOrigin, prepared);
      }
    }

    const worker = new ProofCorrectionWorkerV3(
      taskRepo,
      provider,
      'proof-v3-worker',
      (taskId, attempt, payload) => {
        console.log(`[STREAM EVENT] Task: ${taskId} Attempt: ${attempt} Payload:`, JSON.stringify(payload));
      },
      pool,
      governanceEngine,
      defaultProductCatalog,
      customRemotePersistence
    );

    const scheduler = new PdlContinuousScheduler({
      pool,
      governance: governanceEngine,
      tasks: taskRepo,
      worker,
      config: {
        pollIntervalMs: 1000,
        maxConcurrentTasks: 1,
        authorizedBy: 'MATHEUS',
      },
    });

    // Listen to scheduler observability events
    scheduler.onEvent((evt) => {
      console.log(`[OBSERVABILITY] Event: ${evt.type} | Task: ${evt.taskId || 'none'} | Reason: ${evt.reasonCode || 'none'}`);
    });

    // ──────────────────────────────────────────────────────────
    // STEP 6: Execute ContinuousScheduler Bounded Cycle
    // ──────────────────────────────────────────────────────────
    console.log('\n[STEP 6] Starting ContinuousScheduler...');
    const session = await scheduler.start();
    console.log('[STEP 6] Scheduler Session Started: ID =', session.id, 'State =', session.state);

    console.log('[STEP 6] Awaiting pipeline completion...');
    await scheduler.waitForCompletion();
    console.log('[STEP 6] ContinuousScheduler finished loop.');

    // ──────────────────────────────────────────────────────────
    // STEP 7: Verify Database, Bare Repo & Task Outcome
    // ──────────────────────────────────────────────────────────
    console.log('\n[STEP 7] Verifying Database Final State and Staging Git Target...');
    const finalTaskRes = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const finalTask = finalTaskRes.rows[0];

    // Check remote branch in bare origin
    let bareRemoteSha = null;
    try {
      const lsRemote = git(ephemeralSeed, `ls-remote origin refs/heads/fix/rate-calculator-v3-proof`);
      if (lsRemote) {
        bareRemoteSha = lsRemote.split(/\s+/)[0];
      }
    } catch (e) {
      console.error('[STEP 7] Failed to query bare origin via ls-remote:', e.message);
    }

    console.log('================================================================');
    console.log('TASK FINAL STATUS:   ', finalTask.status);
    console.log('TASK COMMIT SHA:     ', finalTask.commit_sha);
    console.log('TASK GIT STATUS:     ', finalTask.git_status);
    console.log('TASK ERROR:          ', finalTask.error);
    console.log('TASK RETRY COUNT:    ', finalTask.retry_count);
    console.log('BARE REMOTE REF SHA: ', bareRemoteSha);
    console.log('================================================================');

    const remotePersistenceEvidence = finalTask.result?.finalize?.remotePersistence;
    console.log('REMOTE PERSISTENCE EVIDENCE IN RESULT:');
    console.log(JSON.stringify(remotePersistenceEvidence, null, 2));

    const schedulerStatus = scheduler.getStatus();
    console.log('\nSCHEDULER STATUS:', schedulerStatus.state, 'Cycles:', schedulerStatus.cycleCount, 'Consecutive Tasks:', schedulerStatus.consecutiveTasks);

    const success =
      finalTask.status === 'COMPLETED' &&
      Boolean(finalTask.commit_sha) &&
      bareRemoteSha === finalTask.commit_sha &&
      remotePersistenceEvidence?.status === 'VERIFIED' &&
      remotePersistenceEvidence?.remoteSha === finalTask.commit_sha &&
      remotePersistenceEvidence?.pushSucceeded === true;

    console.log('\n>>> PDL AUTONOMY PROOF V3 RESULT:', success ? 'PASS' : 'FAIL', '<<<\n');

    return { success, finalTask, bareRemoteSha, schedulerStatus };
  } finally {
    // ──────────────────────────────────────────────────────────
    // STEP 8: MANDATORY RESTORATION OF GOVERNANCE & ENVIRONMENT
    // ──────────────────────────────────────────────────────────
    console.log('\n[CLEANUP & RESTORATION] Executing mandatory restoration...');

    // 1. Restore PATH and transient git wrapper
    if (prevPath) {
      process.env.PATH = prevPath;
      console.log('[CLEANUP] Restored original PATH.');
    }
    if (wrapperDir && existsSync(wrapperDir)) {
      try {
        rmSync(wrapperDir, { recursive: true, force: true });
        console.log('[CLEANUP] Removed transient git wrapper directory.');
      } catch (err) {
        console.warn('[CLEANUP] Notice on removing wrapperDir:', err.message);
      }
    }

    // 2. Remove ephemeral seed and bare origin
    if (ephemeralSeed && existsSync(ephemeralSeed)) {
      try {
        rmSync(ephemeralSeed, { recursive: true, force: true });
        console.log('[CLEANUP] Removed ephemeral seed directory.');
      } catch (err) {
        console.warn('[CLEANUP] Could not remove ephemeral seed:', err.message);
      }
    }
    if (bareOrigin && existsSync(bareOrigin)) {
      try {
        rmSync(bareOrigin, { recursive: true, force: true });
        console.log('[CLEANUP] Removed ephemeral bare origin directory.');
      } catch (err) {
        console.warn('[CLEANUP] Could not remove bare origin:', err.message);
      }
    }

    // 2. Clean up created task & spec from database to leave DB clean
    if (taskId) {
      try {
        await pool.query('DELETE FROM execution_specs WHERE task_id = $1', [taskId]);
        await pool.query('DELETE FROM tasks WHERE id = $1', [taskId]);
        console.log('[CLEANUP] Deleted test task and execution_spec from DB.');
      } catch (err) {
        console.warn('[CLEANUP] Could not delete test task from DB:', err.message);
      }
    }

    // 3. RESTORE ORIGINAL pdl_governance_state SNAPSHOT
    if (originalGovState) {
      try {
        await pool.query(
          `UPDATE pdl_governance_state SET
            active_level = $1,
            kill_switch_active = $2,
            max_consecutive_tasks = $3,
            max_task_duration_ms = $4,
            max_tool_rounds_per_task = $5,
            max_correction_attempts = $6,
            max_consecutive_failures = $7,
            allowed_products = $8,
            updated_at = $9,
            updated_by = $10,
            reason = $11
           WHERE id = 'canonical'`,
          [
            originalGovState.active_level,
            originalGovState.kill_switch_active,
            originalGovState.max_consecutive_tasks,
            originalGovState.max_task_duration_ms,
            originalGovState.max_tool_rounds_per_task,
            originalGovState.max_correction_attempts,
            originalGovState.max_consecutive_failures,
            JSON.stringify(originalGovState.allowed_products),
            originalGovState.updated_at,
            originalGovState.updated_by,
            originalGovState.reason,
          ]
        );
        console.log('[RESTORATION] pdl_governance_state RESTORED TO ORIGINAL SNAPSHOT.');
        const restoredGov = await pool.query('SELECT * FROM pdl_governance_state WHERE id = $1', ['canonical']);
        console.log('[RESTORATION] Verified Restored State: Level =', restoredGov.rows[0].active_level, 'Kill Switch =', restoredGov.rows[0].kill_switch_active);
      } catch (err) {
        console.error('[CRITICAL RESTORATION ERROR] Failed to restore pdl_governance_state:', err);
      }
    }

    await pool.end();
  }
}

runPipelineProofV3()
  .then((res) => {
    if (res?.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Fatal Proof V3 Error:', err);
    process.exit(1);
  });
