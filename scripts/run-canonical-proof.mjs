/**
 * PDL AUTONOMY PROOF V1 — CANONICAL PROOF HARNESS
 *
 * Direct end-to-end execution of the PDL Agent Runtime on a local ephemeral fixture:
 * - REAL LLM: cohere/north-mini-code:free via OpenRouter
 * - REAL Provider: OpenRouterProvider with opt-in AgentExecutor(undefined, { allowHostExecution: true })
 * - REAL ToolRuntime: read_file, write_file, run_command, git_*
 * - REAL Finalizer: TaskFinalizer (runs node test/validate.mjs and creates local git commit)
 * - REAL Correction Loop: PdlCorrectionLoop with PdlDiagnosticParser
 * - NO Mocks, NO ACP, NO Antigravity, NO Hermes
 *
 * Operator: MATHEUS
 */

import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Existing PDL Engine components (compiled dist)
import { OpenRouterProvider } from '../dist/providers/openrouter.js';
import { AgentExecutor } from '../dist/executor.js';
import { TaskFinalizer, captureWorkspaceSnapshot } from '../dist/finalizer.js';
import { PdlCorrectionLoop } from '../dist/pdl/correction/correction-loop.js';
import { PdlDiagnosticParser } from '../dist/pdl/correction/diagnostic-parser.js';
import { resolveOpenRouterApiKey } from '../dist/providers/shared.js';

// ──────────────────────────────────────────────────────
// FIXTURES
// ──────────────────────────────────────────────────────

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

async function runCanonicalProof() {
  console.log('================================================================');
  console.log('PDL AUTONOMY PROOF V1 — CANONICAL EXECUTION');
  console.log('================================================================');
  console.log('Timestamp:', new Date().toISOString());

  // 1. Resolve Key
  const apiKey = resolveOpenRouterApiKey();
  if (!apiKey) {
    console.error('FAIL: No OpenRouter API key found.');
    process.exit(1);
  }
  console.log('[STEP 1] OpenRouter API Key resolved (length:', apiKey.length, ')');

  // 2. Setup Ephemeral Workspace
  const workspace = mkdtempSync(join(tmpdir(), 'pdl-autonomy-v1-'));
  console.log('[STEP 2] Ephemeral Workspace:', workspace);

  try {
    mkdirSync(join(workspace, 'src'), { recursive: true });
    mkdirSync(join(workspace, 'test'), { recursive: true });
    writeFileSync(join(workspace, 'src', 'calculator.js'), FIXTURE_CALCULATOR, 'utf8');
    writeFileSync(join(workspace, 'test', 'validate.mjs'), FIXTURE_TEST, 'utf8');

    git(workspace, 'init');
    git(workspace, 'config user.name "PDL Autonomy Proof"');
    git(workspace, 'config user.email "proof@pdl.internal"');
    git(workspace, 'add -A');
    git(workspace, 'commit -m "initial: broken calculator"');
    const baselineSha = git(workspace, 'rev-parse HEAD');
    console.log('[STEP 2] Git Initial Commit:', baselineSha);

    // 3. Confirm Deliberate Test Failure
    let initialTestFailed = false;
    let initialTestOutput = '';
    try {
      execSync('node test/validate.mjs', { cwd: workspace, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (err) {
      initialTestFailed = true;
      initialTestOutput = (err.stdout?.toString() || '') + (err.stderr?.toString() || '');
    }
    console.log('[STEP 3] Initial Test Execution:', initialTestFailed ? 'CONFIRMED FAILED' : 'UNEXPECTED PASS');
    console.log('Initial Test Output:\\n', initialTestOutput.trim());
    if (!initialTestFailed) {
      throw new Error('Initial test did not fail as required.');
    }

    // 4. Instantiate Provider with Explicit Host Executor
    const hostExecutor = new AgentExecutor(undefined, { allowHostExecution: true });
    const provider = new OpenRouterProvider(
      undefined,
      apiKey,
      120000,
      'cohere/north-mini-code:free',
      false,
      undefined,
      hostExecutor
    );
    console.log('[STEP 4] Provider Instantiated: OpenRouterProvider (model:', provider.model, ') with AgentExecutor({ allowHostExecution: true })');

    // 5. Build Initial Task
    const task = {
      id: `autonomy-task-${Date.now()}`,
      project: 'autonomy-proof-v1',
      repository: workspace,
      objective: 'Fix calculateRate in src/calculator.js so that it multiplies instead of adds. All tests in test/validate.mjs must pass.',
      prompt: 'Look at src/calculator.js and test/validate.mjs. Run "node test/validate.mjs" using run_command to see the failure. Fix the bug in src/calculator.js using write_file. Then run the tests again with run_command to verify it passes.',
      status: 'RUNNING',
      priority: 1,
      worker: 'autonomy-worker',
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      leaseOwner: 'autonomy-worker',
      leaseDeadline: new Date(Date.now() + 600000),
      heartbeatAt: new Date(),
      workspacePath: workspace,
      prototypeSessionId: null,
    };

    const baselineSnapshot = captureWorkspaceSnapshot(workspace);

    // 6. Turn 1: Agent Execution
    console.log('\n[STEP 5] --- Executing Turn 1: Initial Agent Pass ---');
    const turn1Result = await provider.execute(task, workspace);
    console.log('Turn 1 Status:', turn1Result.status);
    console.log('Turn 1 Tool Calls:', turn1Result.toolCalls);
    console.log('Turn 1 Tool Rounds:', turn1Result.toolRounds);
    console.log('Turn 1 Changed Files:', turn1Result.changedFiles);
    console.log('Turn 1 Agent Output:\n', turn1Result.stdout.substring(0, 400));

    // 7. Validation / Finalization
    console.log('\n[STEP 6] --- Running TaskFinalizer Post Turn 1 ---');
    const finalizer = new TaskFinalizer(workspace);
    const finalize1 = await finalizer.finalize(task.objective, task.prompt, {
      testCommand: 'node test/validate.mjs',
      commitMessage: 'fix(calculator): turn 1 fix',
      expectChanges: true,
      baselineSnapshot,
      declaredChangedFiles: turn1Result.changedFiles,
    });

    console.log('Finalize 1 Status:', finalize1.status);
    console.log('Tests Passed:', finalize1.testsPassed);
    console.log('Test Output:\n', finalize1.testOutput.trim());

    let finalFinalize = finalize1;
    let correctionExecuted = false;

    // 8. If Failed or Correction Required -> Run PdlCorrectionLoop
    if (finalize1.testsPassed !== true) {
      console.log('\n[STEP 7] --- Invoking PdlCorrectionLoop with Real Diagnostic ---');
      correctionExecuted = true;

      const spec = {
        id: `spec-${task.id}`,
        taskId: task.id,
        specVersion: '1.0',
        specHash: 'proof-spec',
        objective: task.objective,
        acceptanceCriteria: ['calculateRate(10, 5) must equal 50', 'formatRate(50) must equal "R$ 50.00"'],
        validationPlan: { testCommand: 'node test/validate.mjs' },
        constraints: [],
        executionInstructions: task.prompt,
        lineage: { source: 'autonomy-proof' },
        status: 'SEALED',
        sealedAt: new Date(),
      };

      const correctionResult = await PdlCorrectionLoop.runCorrectionLoop({
        task,
        executionSpec: spec,
        workspace,
        provider,
        baselineSnapshot,
        initialFinalizeResult: finalize1,
        declaredChangedFiles: turn1Result.changedFiles,
        maxAttempts: 2,
        testCommand: 'node test/validate.mjs',
        commitMessage: 'fix(calculator): corrected by autonomous correction loop',
        onAttemptStarted: (attempt, id) => console.log(`[Correction] Attempt ${attempt} (${id}) started`),
        onAttemptCompleted: (attempt, id, res) => console.log(`[Correction] Attempt ${attempt} (${id}) result: ${res.status}`),
      });

      console.log('Correction Recovered:', correctionResult.recovered);
      console.log('Correction Attempts:', correctionResult.attemptsExecuted);
      finalFinalize = correctionResult.finalization;
    } else {
      console.log('[STEP 7] Turn 1 already produced passing tests. Verifying commit creation...');
    }

    // 9. Inspect Workspace Git State
    console.log('\\n[STEP 8] --- Final Workspace Git Inspection ---');
    const finalSha = git(workspace, 'rev-parse HEAD');
    const finalLog = git(workspace, 'log -2 --oneline');
    const finalDiff = git(workspace, 'diff HEAD~1');

    console.log('Final HEAD SHA:', finalSha);
    console.log('Git Log:\\n', finalLog);
    console.log('Git Diff of Changes:\\n', finalDiff);

    const isCompleteSuccess = finalFinalize.testsPassed === true && finalSha !== baselineSha;

    console.log('\\n================================================================');
    console.log('PROOF RESULT:', isCompleteSuccess ? 'PASS' : 'FAIL');
    console.log('================================================================');

    const evidenceDoc = `# PDL AUTONOMY PROOF V1 — AUDIT EVIDENCE RECORD

**Execution Date**: ${new Date().toISOString()}  
**Operator**: MATHEUS  
**Status**: **${isCompleteSuccess ? 'PASS' : 'FAIL'}**  
**LLM Model**: ${provider.model}  
**Gateway / Provider**: OpenRouterProvider via OpenRouter API  
**Host Execution Mode**: Opt-in (allowHostExecution: true via AgentExecutor)  

---

## 1. Execution Chain Verification

| Stage | Expected | Actual | Status |
|---|---|---|:---:|
| 1. LLM Call | Real OpenRouter HTTP request | Generation via Cohere on OpenRouter | **REAL** |
| 2. Agent Runtime | Tool-calling multi-turn loop | ${turn1Result.toolRounds} rounds in Turn 1 | **REAL** |
| 3. ToolRuntime | Native tools invocation | ${turn1Result.toolCalls} tool calls executed | **REAL** |
| 4. AgentExecutor | Host execution with security | Process spawned via child_process | **REAL** |
| 5. Workspace | Ephemeral Git workspace | Created at ${workspace} | **REAL** |
| 6. Deliberate Failure | Initial test exits with code 1 | Initial test failed as expected | **REAL** |
| 7. Code Change | Agent edits src/calculator.js | Changed files: [${turn1Result.changedFiles.join(', ')}] | **REAL** |
| 8. Test Verification | Real test execution | ${finalFinalize.testOutput.trim()} | **REAL** |
| 9. Correction Loop | PdlCorrectionLoop applied | ${correctionExecuted ? 'Triggered on failure' : 'Pass on first iteration'} | **REAL** |
| 10. Local Git Commit | Automatic commit created | Commit SHA: \`${finalSha}\` | **REAL** |

---

## 2. Git Diff Generated by Agent

\`\`\`diff
${finalDiff}
\`\`\`

---

## 3. Final Commit Log

\`\`\`text
${finalLog}
\`\`\`
`;

    const docsDir = join(process.cwd(), 'docs');
    if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
    writeFileSync(join(docsDir, 'PDL_AUTONOMY_PROOF_V1.md'), evidenceDoc, 'utf8');
    console.log('Evidence record written to docs/PDL_AUTONOMY_PROOF_V1.md');

  } finally {
    try {
      rmSync(workspace, { recursive: true, force: true });
      console.log('Ephemeral workspace cleaned up.');
    } catch {}
  }
}

runCanonicalProof().catch(err => {
  console.error('Fatal Proof Error:', err);
  process.exit(1);
});
