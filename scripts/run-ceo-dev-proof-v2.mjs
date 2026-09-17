/**
 * CEO DEVELOPMENT PROOF V2 — CANONICAL REAL PIPELINE EXECUTION
 *
 * Pipeline to prove:
 * CEO Command (CeoCommandGateway)
 *  -> TaskIntakeService -> PostgreSQL (tasks + execution_specs)
 *  -> PdlContinuousScheduler
 *  -> PdlCorrectionWorker (CANONICAL - NO SUBCLASSES, NO FAKES)
 *  -> OpenRouterProvider (CANONICAL - cohere/north-mini-code:free verified 0/0 pricing)
 *  -> ToolRuntime (REAL: list_files, read_file, write_file, run_command)
 *  -> TaskFinalizer (REAL: node test/validate.mjs)
 *  -> CodeReviewManager (REAL)
 *  -> evaluatePersistenceGate (REAL Invariant 6)
 *  -> PdlRemotePersistence (REAL GitHubTransport: git push + ls-remote SHA verification)
 *  -> CeoConversationStore (REAL)
 *
 * Operator: MATHEUS
 */

import { Pool } from 'pg';
import { AgentExecutor } from '../dist/executor.js';
import { OpenRouterProvider } from '../dist/providers/openrouter.js';
import { PdlCorrectionWorker } from '../dist/pdl/worker/correction-worker.js';
import { PostgresTaskRepository } from '../dist/repository.js';
import { PdlGovernanceEngine } from '../dist/pdl/governance/index.js';
import { defaultProductCatalog } from '../dist/pdl/products/catalog.js';
import { PdlContinuousScheduler } from '../dist/pdl/scheduler/continuous-scheduler.js';
import { CeoCommandGateway } from '../dist/pdl/ceo/command-gateway.js';
import { TaskIntakeService } from '../dist/pdl/service/task-intake-service.js';
import { defaultCeoConversationStore } from '../dist/office/ceo-conversation-store.js';
import { resolveOpenRouterApiKey } from '../dist/providers/shared.js';
import { PdlRemotePersistence, GitHubTransport } from '../dist/pdl/persistence/remote-persistence.js';
import { execSync } from 'node:child_process';

const PG_URL = process.env.DATABASE_URL || 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop';

async function runProofV2() {
  console.log('================================================================');
  console.log('STARTING CEO DEVELOPMENT PROOF V2 — CANONICAL REAL PIPELINE');
  console.log('================================================================');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Operator: MATHEUS');

  const pool = new Pool({ connectionString: PG_URL });
  const tasksRepo = new PostgresTaskRepository(pool);
  const govEngine = new PdlGovernanceEngine({ pool });
  const intakeService = new TaskIntakeService(pool);

  // 1. Initial Snapshot of Database and Governance
  const govBeforeRes = await pool.query(
    'SELECT active_level, kill_switch_active, allowed_products, max_consecutive_tasks FROM pdl_governance_state WHERE id = $1',
    ['canonical']
  );
  const govBefore = govBeforeRes.rows[0];
  console.log('\n[Phase 0: Baseline Audit] Governance BEFORE:', JSON.stringify(govBefore));

  const tasksBeforeRes = await pool.query('SELECT count(*) FROM tasks');
  const tasksBeforeCount = parseInt(tasksBeforeRes.rows[0].count, 10);
  console.log('[Phase 0: Baseline Audit] Tasks Count BEFORE:', tasksBeforeCount);

  // 2. Resolve OpenRouter API Key & Confirm Model
  const apiKey = resolveOpenRouterApiKey();
  if (!apiKey) {
    throw new Error('FAIL: No OpenRouter API key resolved');
  }
  const modelId = 'cohere/north-mini-code:free';
  console.log(`[Phase 1: Provider Config] Model: ${modelId}, API Key length: ${apiKey.length}`);

  let scheduler;
  let executionOutcome = null;

  try {
    // 3. Elevate Governance to Level 3 for exactly ONE task
    console.log('\n[Phase 1: Governance Elevation] Elevating limits for CEO Development Proof V2...');
    await govEngine.updateLimits({
      activeLevel: 3,
      killSwitchActive: false,
      maxConsecutiveTasks: 1,
      allowedProducts: ['pub-rate-calculator', 'pub-dev-loop-template', 'pub-shopee-scraper'],
    }, 'ceo-dev-proof-v2', 'Temporary elevation for CEO Development Proof V2');

    const govDuringRes = await pool.query(
      'SELECT active_level, kill_switch_active, allowed_products FROM pdl_governance_state WHERE id = $1',
      ['canonical']
    );
    console.log('[Phase 1: Governance Elevation] Governance DURING:', JSON.stringify(govDuringRes.rows[0]));

    // 4. Instantiate OpenRouterProvider with Host Execution enabled
    const hostExecutor = new AgentExecutor(undefined, { allowHostExecution: true });
    const provider = new OpenRouterProvider(
      undefined,
      apiKey,
      300000,
      modelId,
      false,
      undefined,
      hostExecutor
    );

    // 5. Instantiate Canonical PdlRemotePersistence with GitHubTransport
    const remotePersistence = new PdlRemotePersistence(
      defaultProductCatalog,
      undefined,
      new GitHubTransport()
    );

    // 6. Instantiate Canonical PdlCorrectionWorker (NO SUBCLASSING!)
    const correctionWorker = new PdlCorrectionWorker(
      tasksRepo,
      provider,
      'pdl-canonical-worker',
      (taskId, attempt, event, envelope) => {
        if (event?.type) {
          console.log(`[Worker Stream Event] [Attempt ${attempt}] ${event.type}:`, JSON.stringify(event.payload || event));
        }
      },
      pool, // executionSpecDb
      govEngine,
      defaultProductCatalog,
      remotePersistence,
      undefined, // neuralBridge
      undefined, // reviewManager
      defaultCeoConversationStore
    );
    console.log('[Phase 1: Worker Setup] Canonical PdlCorrectionWorker instantiated.');

    // 7. Instantiate Canonical PdlContinuousScheduler
    scheduler = new PdlContinuousScheduler({
      governance: govEngine,
      worker: correctionWorker,
      tasks: tasksRepo,
      pool,
      config: {
        pollIntervalMs: 1000,
        maxConcurrentTasks: 1,
        authorizedBy: 'MATHEUS',
      },
    });

    scheduler.onEvent((ev) => {
      console.log(`[Scheduler Event] ${ev.type} (task=${ev.taskId || 'none'}, reason=${ev.reasonCode || 'none'})`);
    });

    await scheduler.start();
    console.log('[Phase 1: Scheduler Setup] ContinuousScheduler started.');

    // 8. Instantiate CeoCommandGateway
    const gateway = new CeoCommandGateway({
      governance: govEngine,
      catalog: defaultProductCatalog,
      taskRepo: tasksRepo,
      intakeService: intakeService,
      conversationStore: defaultCeoConversationStore,
    });

    // 9. Formulate Executive Directive (FASE 2: Tarefa Real de Desenvolvimento)
    const directiveText = 'Adicione uma nova funcao utilitaria de calculo financeiro para o produto atual que calcule a receita liquida (net revenue) deduzindo impostos percentuais e taxa fixa de processamento a partir da receita bruta. A funcao deve validar argumentos negativos e taxas invalidas. Atualize a suite de validacao existente do projeto para cobrir a nova funcao com assercoes deterministicas e garanta que todos os testes passem com exit code 0.';

    console.log('\n[Phase 2: CEO Command] Submitting executive directive to CeoCommandGateway...');
    console.log(`Directive: "${directiveText}"`);

    const commandPacket = {
      command: directiveText,
      project: 'pub-rate-calculator',
      trustedContext: {
        operatorId: 'MATHEUS',
        role: 'CEO',
        channel: 'api',
        verified: true,
      },
    };

    const gatewayResult = await gateway.handleCommand(commandPacket);
    console.log('\n[Phase 2: Gateway Result]', JSON.stringify({
      commandId: gatewayResult.commandId,
      correlationId: gatewayResult.correlationId,
      status: gatewayResult.status,
      governanceDecision: gatewayResult.governanceDecision?.reasonCode,
      taskId: gatewayResult.taskId,
    }, null, 2));

    if (gatewayResult.status !== 'QUEUED' || !gatewayResult.taskId) {
      throw new Error(`FAIL: Gateway rejected command: ${gatewayResult.error || gatewayResult.status}`);
    }

    const taskId = gatewayResult.taskId;
    console.log(`\n[Phase 3: Dispatch & Polling] Task ${taskId} is queued. Waiting for autonomous execution...`);

    // 10. Wait for Task Completion in PostgreSQL
    let pollCount = 0;
    let completedTask = null;
    while (pollCount < 180) { // Up to 6 minutes
      await new Promise(r => setTimeout(r, 2000));
      const res = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      const current = res.rows[0];
      if (current && ['COMPLETED', 'FAILED', 'BLOCKED'].includes(current.status)) {
        completedTask = current;
        break;
      }
      pollCount++;
      if (pollCount % 10 === 0) {
        console.log(`... polling task ${taskId} (status: ${current?.status || 'UNKNOWN'}, poll: ${pollCount})`);
      }
    }

    await scheduler.stop('CEO_DEV_PROOF_V2_FINISHED', 'COMPLETED');
    console.log(`\n[Phase 3: Execution Finished] Final Task Status: ${completedTask?.status}`);

    if (!completedTask) {
      throw new Error(`FAIL: Task ${taskId} timed out waiting for execution`);
    }

    executionOutcome = completedTask;

  } finally {
    // 11. MANDATORY GOVERNANCE RESTORATION IN FINALLY BLOCK
    console.log('\n[Phase 8: Governance Restore] Restoring canonical fail-closed baseline in PostgreSQL...');
    if (govBefore) {
      await pool.query(`
        UPDATE pdl_governance_state
        SET active_level = $1,
            kill_switch_active = $2,
            max_consecutive_tasks = $3,
            allowed_products = $4,
            updated_at = now(),
            updated_by = $5,
            reason = $6
        WHERE id = 'canonical'
      `, [
        govBefore.active_level,
        govBefore.kill_switch_active,
        govBefore.max_consecutive_tasks,
        JSON.stringify(govBefore.allowed_products),
        'ceo-dev-proof-v2-finally',
        'Restoring fail-closed baseline after CEO DEVELOPMENT PROOF V2'
      ]);
    }

    const govAfterRes = await pool.query(
      'SELECT active_level, kill_switch_active, allowed_products FROM pdl_governance_state WHERE id = $1',
      ['canonical']
    );
    console.log('[Phase 8: Governance Restore] Governance AFTER:', JSON.stringify(govAfterRes.rows[0]));

    await pool.end();
  }

  // 12. Verification and Reporting
  console.log('\n================================================================');
  console.log('AUDIT ANALYSIS & INDEPENDENT VERIFICATION');
  console.log('================================================================');
  console.log('Task ID:', executionOutcome.id);
  console.log('Status:', executionOutcome.status);
  console.log('Branch:', executionOutcome.branch);
  console.log('Commit SHA:', executionOutcome.commit_sha);
  console.log('Error:', executionOutcome.error);

  const resultObj = typeof executionOutcome.result === 'string'
    ? JSON.parse(executionOutcome.result)
    : executionOutcome.result;

  console.log('\n--- Tool Calls & Rounds Telemetry ---');
  console.log('Provider Used:', resultObj?.provider);
  console.log('Model Used:', resultObj?.model);
  console.log('Tool Calls:', resultObj?.toolCalls);
  console.log('Tool Rounds:', resultObj?.toolRounds);
  console.log('Duration Ms:', resultObj?.durationMs);
  console.log('Changed Files:', resultObj?.finalize?.changedFiles);
  console.log('Tests Passed:', resultObj?.finalize?.testsPassed);
  console.log('Test Output:\n', (resultObj?.finalize?.testOutput || '').trim());
  console.log('Review Status:', resultObj?.review?.status);
  console.log('Persistence Gate:', resultObj?.persistenceGate?.code);
  console.log('Remote Persistence Status:', resultObj?.remotePersistence?.status);
  console.log('Remote SHA:', resultObj?.remotePersistence?.remoteSha);

  // 13. Independent Git & Remote Verification
  if (executionOutcome.branch && resultObj?.remotePersistence?.status === 'VERIFIED') {
    console.log('\n--- Remote Git Verification via ls-remote ---');
    const remoteLs = execSync(
      `git ls-remote https://github.com/pubcoreagencia/pub-rate-calculator.git refs/heads/${executionOutcome.branch}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();
    console.log('Remote ls-remote output:\n', remoteLs);

    const match = remoteLs.match(/^([0-9a-f]{40})\s+/);
    const verifiedRemoteSha = match ? match[1] : null;
    console.log('Verified Remote SHA:', verifiedRemoteSha);
    console.log('Local Commit SHA:   ', executionOutcome.commit_sha);
    console.log('SHA Equality:        ', verifiedRemoteSha === executionOutcome.commit_sha ? 'MATCH (100% IDENTICAL)' : 'MISMATCH');
  }

  return {
    success: executionOutcome.status === 'COMPLETED',
    task: executionOutcome,
    resultObj,
  };
}

runProofV2().then(res => {
  console.log('\nFINAL V2 RUN COMPLETE. Success:', res.success);
  process.exit(res.success ? 0 : 1);
}).catch(err => {
  console.error('\nFATAL V2 ERROR:', err);
  process.exit(1);
});
