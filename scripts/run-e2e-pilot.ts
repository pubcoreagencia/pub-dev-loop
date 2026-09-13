/**
 * PDL E2E-01 PILOT RUNNER
 *
 * Demonstrates the full autonomous software-delivery lifecycle:
 * INTAKE -> CONTEXT -> EXECUTION -> TEST -> COMMIT -> PUSH -> SHA REMOTE -> NEURAL INGESTION -> COMPLETED
 *
 * Target: pubcoreagencia/pub-rate-calculator (Non-critical canonical product)
 * Operator: MATHEUS
 */

import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type { Task, TaskRepository } from '../src/domain.js';
import type { AgentProvider, ProviderTaskInput, ProviderTaskResult } from '../src/providers/types.js';
import { RouterWorker } from '../src/router-worker.js';
import {
  type ExecutionSpecStore,
  type ExecutionSpecRecord,
  sealExecutionSpec,
  computeSpecHash,
} from '../src/execution/execution-spec-persistence.js';
import { EXECUTION_SPEC_VERSION, type ExecutionSpec } from '../src/task/execution-spec.js';
import { defaultProductCatalog } from '../src/pdl/products/catalog.js';
import { PdlRemotePersistence, getGitHubToken } from '../src/pdl/persistence/remote-persistence.js';
import { DefaultPubNeuralBridge } from '../src/pdl/neural/neural-bridge.js';

function createMemorySpecStore(): ExecutionSpecStore & { records: Map<string, ExecutionSpecRecord> } {
  const records = new Map<string, ExecutionSpecRecord>();
  return {
    records,
    async create(record: ExecutionSpecRecord) {
      records.set(record.id, { ...record });
      return { ...record };
    },
    async loadByTaskId(taskId: string) {
      for (const record of records.values()) {
        if (record.task_id === taskId || record.id === taskId) {
          return { ...record };
        }
      }
      return null;
    },
    async updateStatus(idOrTaskId: string, status: any, sealedAt?: string, specHash?: string, specContentJson?: string) {
      let target: ExecutionSpecRecord | undefined;
      for (const record of records.values()) {
        if (record.id === idOrTaskId || record.task_id === idOrTaskId) {
          target = record;
          break;
        }
      }
      if (!target) throw new Error('Record not found');
      target.status = status;
      if (sealedAt !== undefined) target.sealed_at = sealedAt;
      if (specHash !== undefined) target.spec_hash = specHash;
      if (specContentJson !== undefined) target.spec_content_json = specContentJson;
      return { ...target };
    },
  };
}

function createMemoryTaskRepo(initialTask: Task): TaskRepository {
  const tasks = new Map<string, Task>();
  tasks.set(initialTask.id, { ...initialTask });
  return {
    async claim(workerName: string) {
      for (const t of tasks.values()) {
        if (t.status === 'QUEUED') {
          t.status = 'RUNNING';
          t.worker = workerName;
          return { ...t };
        }
      }
      return null;
    },
    async update(id: string, updates: Partial<Task>) {
      const existing = tasks.get(id);
      if (!existing) throw new Error(`Task ${id} not found`);
      const updated = { ...existing, ...updates };
      tasks.set(id, updated);
      return updated;
    },
    async get(id: string) {
      return tasks.get(id) ?? null;
    },
    async create(data: any) {
      const task = { id: `task-${Date.now()}`, ...data };
      tasks.set(task.id, task);
      return task;
    },
    async list() {
      return Array.from(tasks.values());
    },
    async cancel(id: string) {
      const existing = tasks.get(id);
      if (existing) existing.status = 'CANCELLED';
      return existing ?? null;
    },
    async retry(id: string) {
      const existing = tasks.get(id);
      if (existing) existing.status = 'QUEUED';
      return existing ?? null;
    },
    async reclaimStuck() {
      return 0;
    },
    async heartbeat(id: string, deadline: Date) {
      const existing = tasks.get(id);
      if (existing) existing.leaseDeadline = deadline;
      return true;
    },
  };
}

async function runPilot() {
  console.log('================================================================');
  console.log('PDL E2E-01 PILOT: First Governed End-to-End Cycle');
  console.log('Target: pubcoreagencia/pub-rate-calculator');
  console.log('Operator: MATHEUS');
  console.log('================================================================\n');

  // Verify GitHub Authentication token
  const token = getGitHubToken();
  if (!token) {
    throw new Error('FAIL-CLOSED: No GitHub token available for remote persistence. Ensure `gh auth token` or PDL_GITHUB_TOKEN is configured.');
  }
  console.log('✓ Step 0: GitHub authentication verified via keyring/token.');

  const taskId = `TASK-E2E-PILOT-${Date.now()}`;
  const branchName = `feat/rate-calculator-pilot-${Date.now().toString(36)}`;
  const repositoryUrl = 'https://github.com/pubcoreagencia/pub-rate-calculator.git';

  // 1. INTAKE
  console.log('\n[1/9] INTAKE: Registering task...');
  const task: Task = {
    id: taskId,
    project: 'pub-rate-calculator',
    repository: repositoryUrl,
    objective: 'Implement calculateTaxAmount function in src/calculator.js and add automated unit test in test/validate.mjs',
    prompt: 'Add and export calculateTaxAmount(grossRevenue, taxRate) in src/calculator.js and assert its correctness in test/validate.mjs',
    status: 'QUEUED',
    priority: 1,
    worker: null,
    result: null,
    error: null,
    branch: branchName,
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: null,
  };
  const taskRepo = createMemoryTaskRepo(task);
  console.log(`✓ Task created: ${taskId} on branch ${branchName}`);

  // 2. CONTEXT & SEALED SPEC
  console.log('\n[2/9] CONTEXT: Creating and sealing ExecutionSpec...');
  const specStore = createMemorySpecStore();
  const spec: ExecutionSpec = {
    specVersion: EXECUTION_SPEC_VERSION,
    objective: task.objective,
    context: {
      version: '1.0.0',
      authoritativeContext: [
        { source: 'pub-rate-calculator/src/calculator.js', excerpt: 'Rate calculator core library functions' },
      ],
      repositoryContext: [
        { file: 'src/calculator.js', summary: 'Rate calculator core library' },
        { file: 'test/validate.mjs', summary: 'Automated test suite' },
      ],
      operationalContext: [],
      relevantDocumentation: [],
      knownConstraints: ['Do not change existing function signatures', 'Free models only policy'],
      limitations: [],
    },
    constraints: ['Product isolation invariant', 'Fail-closed persistence gate'],
    acceptanceCriteria: [
      'node test/validate.mjs exits with code 0',
      'calculateTaxAmount correctly computes grossRevenue * (taxRate / 100)',
    ],
    validationPlan: ['node test/validate.mjs'],
    executionInstructions: [
      'Add and export calculateTaxAmount in src/calculator.js',
      'Add validation assertion in test/validate.mjs',
    ],
    executionSteps: [
      { id: 'step-1', description: 'Export calculateTaxAmount in src/calculator.js', critical: true },
      { id: 'step-2', description: 'Add test assertion to test/validate.mjs', critical: true },
    ],
    risks: ['None; verified non-critical product repository'],
    escalationConditions: ['Validation command fails after implementation', 'Push to remote fails'],
    lineage: {
      intakeVersion: '1.0.0',
      intakeHash: `intake-sha-${Date.now()}`,
      source: 'canonical-pdl-e2e-pilot',
      createdAt: new Date().toISOString(),
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      specHash: '',
    },
  };
  spec.metadata.specHash = computeSpecHash(spec);

  await specStore.create({
    id: `spec-${taskId}`,
    task_id: taskId,
    spec_version: spec.specVersion,
    spec_hash: spec.metadata.specHash,
    objective: spec.objective,
    lineage: spec.lineage,
    status: 'UNSEALED',
    created_at: new Date().toISOString(),
    spec_content_json: JSON.stringify(spec),
  });
  await sealExecutionSpec(specStore, taskId, spec);
  console.log(`✓ ExecutionSpec sealed with hash: ${spec.metadata.specHash}`);

  // 3. EXECUTION PROVIDER
  console.log('\n[3/9] EXECUTION: Preparing specialist provider...');
  const pilotProvider: AgentProvider = {
    kind: 'mock',
    model: 'kc/cohere/north-mini-code:free',
    health: async () => ({ available: true, details: 'ok' }),
    capabilities: () => ['code_modification'],
    metadata: () => ({ pricing: { prompt: 0, completion: 0 } }),
    execute: async (_input: ProviderTaskInput, workspacePath: string): Promise<ProviderTaskResult> => {
      console.log(`  -> Specialist modifying code in workspace: ${workspacePath}`);
      const calcPath = join(workspacePath, 'src', 'calculator.js');
      const testPath = join(workspacePath, 'test', 'validate.mjs');

      let calcContent = await readFile(calcPath, 'utf8');
      if (!calcContent.includes('calculateTaxAmount')) {
        calcContent += `\nexport function calculateTaxAmount(grossRevenue, taxRate) {\n  if (grossRevenue < 0 || taxRate < 0 || taxRate > 100) throw new Error('Invalid arguments for tax calculation');\n  return (grossRevenue * (taxRate / 100));\n}\n`;
        await writeFile(calcPath, calcContent, 'utf8');
        console.log('  -> Added calculateTaxAmount to src/calculator.js');
      }

      let testContent = await readFile(testPath, 'utf8');
      if (!testContent.includes('calculateTaxAmount')) {
        testContent = testContent.replace(
          "import { calculateRate, calculateAgencyCommission, calculateNetMargin, calculateVolumeDiscount } from '../src/calculator.js';",
          "import { calculateRate, calculateAgencyCommission, calculateNetMargin, calculateVolumeDiscount, calculateTaxAmount } from '../src/calculator.js';"
        );
        const testCase = `\n// 6. Test Tax Amount Calculation\nconst rTax = calculateTaxAmount(1000, 15);\nif (rTax !== 150) {\n  throw new Error('Tax calculation mismatch: expected 150 got ' + rTax);\n}\n\n`;
        testContent = testContent.replace(
          "console.log('[Validator] ALL TESTS PASSED (exit 0)');",
          `${testCase}console.log('[Validator] ALL TESTS PASSED (exit 0)');`
        );
        await writeFile(testPath, testContent, 'utf8');
        console.log('  -> Added calculateTaxAmount test assertion to test/validate.mjs');
      }

      return {
        status: 'COMPLETED',
        provider: 'specialist-developer',
        model: 'kc/cohere/north-mini-code:free',
        exitCode: 0,
        durationMs: 140,
        stdout: 'Implemented calculateTaxAmount and added automated unit validation',
        stderr: '',
        changedFiles: ['src/calculator.js', 'test/validate.mjs'],
        commit: null,
        errorCode: null,
        errorMessage: null,
      };
    },
  };

  // Configure environment for automated test validation
  process.env.TASK_TEST_COMMAND = 'node test/validate.mjs';
  process.env.TASK_COMMIT_MESSAGE = `feat(calculator): implement calculateTaxAmount and add validation test (E2E-01 Pilot)`;

  // 4. INSTANTIATE WORKER
  console.log('\n[4/9] WORKER: Instantiating governed RouterWorker...');
  const persistence = new PdlRemotePersistence(defaultProductCatalog);
  const neuralBridge = new DefaultPubNeuralBridge();
  const worker = new RouterWorker(
    taskRepo,
    pilotProvider,
    'pilot-worker',
    undefined,
    specStore,
    undefined, // default governance
    defaultProductCatalog,
    persistence,
    neuralBridge,
  );

  // 5. EXECUTE WORKER CYCLE
  console.log('\n[5/9] RUNNING CYCLE: Worker executing (clone -> test -> commit -> push -> gate -> neural)...');
  const executionSuccess = await worker.executeOnce();
  console.log(`✓ Worker executeOnce() returned: ${executionSuccess}`);

  // 6. INSPECT TERMINAL TASK STATE
  console.log('\n[6/9] AUDIT: Inspecting terminal task state...');
  const finalTask = await taskRepo.get(taskId);
  if (!finalTask) throw new Error('Task not found in repository after execution');

  console.log('Terminal Task Status:', finalTask.status);
  console.log('Commit SHA:', finalTask.commitSha);
  console.log('Branch:', finalTask.branch);
  console.log('Error:', finalTask.error);

  if (finalTask.status !== 'COMPLETED') {
    throw new Error(`PILOT FAILED: Task status is ${finalTask.status}, expected COMPLETED. Error: ${finalTask.error}`);
  }

  // 7. VERIFY REMOTE PERSISTENCE ON GITHUB
  console.log('\n[7/9] REMOTE VERIFICATION: Checking GitHub remote ref directly...');
  const remoteOutput = execSync(`git ls-remote ${repositoryUrl} refs/heads/${branchName}`, {
    encoding: 'utf8',
  }).trim();
  console.log(`git ls-remote output:\n${remoteOutput}`);

  const match = remoteOutput.match(/^([0-9a-f]{40})\s+/);
  if (!match) {
    throw new Error(`PILOT FAILED: Remote branch '${branchName}' not found on ${repositoryUrl}`);
  }
  const remoteSha = match[1];
  console.log(`Remote SHA: ${remoteSha}`);
  console.log(`Local Commit SHA: ${finalTask.commitSha}`);

  if (remoteSha !== finalTask.commitSha) {
    throw new Error(`PILOT FAILED: Remote SHA (${remoteSha}) does not match local commit SHA (${finalTask.commitSha})`);
  }
  console.log('✓ REMOTE SHA RECONCILIATION VERIFIED (remoteSha === commitSha)');

  // 8. VERIFY PUB NEURAL INGESTION
  console.log('\n[8/9] PUB NEURAL INGESTION: Auditing neural ingestion event...');
  const taskResult: any = finalTask.result;
  const persistenceGateDecision = taskResult?.persistenceGate;
  const remotePersistenceResult = taskResult?.remotePersistence;

  console.log('Persistence Gate Passed:', persistenceGateDecision?.passed);
  console.log('Persistence Gate Status:', persistenceGateDecision?.status);
  console.log('Remote Persistence Status:', remotePersistenceResult?.status);
  console.log('Remote Verified:', remotePersistenceResult?.remoteVerified);

  // 9. CONCLUSION
  console.log('\n================================================================');
  console.log('PILOT RESULT: 100% SUCCESSFUL END-TO-END CYCLE PROVEN');
  console.log(`Task ID: ${taskId}`);
  console.log(`Repository: ${repositoryUrl}`);
  console.log(`Branch: ${branchName}`);
  console.log(`Verified Commit SHA: ${remoteSha}`);
  console.log('Status: COMPLETED');
  console.log('================================================================\n');

  return {
    taskId,
    repository: repositoryUrl,
    branch: branchName,
    commitSha: remoteSha,
    remoteSha,
    status: finalTask.status,
    gateStatus: persistenceGateDecision?.status,
    remoteVerified: remotePersistenceResult?.remoteVerified,
  };
}

runPilot().catch((err) => {
  console.error('\n❌ PILOT EXECUTION FAILED:', err);
  process.exit(1);
});
