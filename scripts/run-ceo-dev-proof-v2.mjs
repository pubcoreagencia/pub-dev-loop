/**
 * CEO CORRECTION PROOF V2
 *
 * Real chain:
 * CEO -> Gateway -> PostgreSQL -> Scheduler -> PdlCorrectionWorker
 * -> RouterProvider/9Router -> ToolRuntime -> Finalizer -> CorrectionLoop
 * -> Review -> Persistence -> remote SHA verification.
 *
 * This harness intentionally does NOT instantiate OpenRouterProvider directly.
 * The operational route under proof is 9Router -> kc/cohere/north-mini-code:free.
 */
import { Pool } from 'pg';
import { AgentExecutor } from '../dist/executor.js';
import { RouterProvider } from '../dist/providers/router.js';
import { PdlCorrectionWorker } from '../dist/pdl/worker/correction-worker.js';
import { PostgresTaskRepository } from '../dist/repository.js';
import { PdlGovernanceEngine } from '../dist/pdl/governance/index.js';
import { defaultProductCatalog } from '../dist/pdl/products/catalog.js';
import { PdlContinuousScheduler } from '../dist/pdl/scheduler/continuous-scheduler.js';
import { CeoCommandGateway } from '../dist/pdl/ceo/command-gateway.js';
import { TaskIntakeService } from '../dist/pdl/service/task-intake-service.js';
import { defaultCeoConversationStore } from '../dist/office/ceo-conversation-store.js';
import { PdlRemotePersistence, GitHubTransport } from '../dist/pdl/persistence/remote-persistence.js';
import { execSync } from 'node:child_process';

const PG_URL = process.env.DATABASE_URL || 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop';
const MODEL_ID = 'kc/cohere/north-mini-code:free';

async function runProof() {
  // Force the proof through the injected RouterProvider/9Router path.
  // Do not let ROUTER_PROVIDER_CHAIN replace the provider with a non-host executor.
  delete process.env.ROUTER_PROVIDER_CHAIN;

  console.log('==============================================================');
  console.log('CEO CORRECTION PROOF V2 — 9ROUTER CANONICAL PATH');
  console.log('==============================================================');
  console.log('Timestamp:', new Date().toISOString());

  if (!process.env.ROUTER_API_KEY) {
    throw new Error('FAIL: ROUTER_API_KEY is not configured');
  }

  const pool = new Pool({ connectionString: PG_URL });
  const tasksRepo = new PostgresTaskRepository(pool);
  const govEngine = new PdlGovernanceEngine({ pool });
  const intakeService = new TaskIntakeService(pool);

  const govBefore = (await pool.query(
    'SELECT active_level, kill_switch_active, allowed_products, max_consecutive_tasks FROM pdl_governance_state WHERE id = $1',
    ['canonical']
  )).rows[0];

  console.log('[BASELINE] Governance:', JSON.stringify(govBefore));

  // Harness-only catalog override. The product manifest remains otherwise unchanged.
  const shopee = defaultProductCatalog.get('pub-shopee-scraper');
  if (!shopee) throw new Error('FAIL: pub-shopee-scraper is not in ProductCatalog');
  defaultProductCatalog.register({
    ...shopee,
    testCommand: 'npm test',
  });

  let scheduler;
  let executionOutcome = null;

  try {
    await govEngine.updateLimits({
      activeLevel: 3,
      killSwitchActive: false,
      maxConsecutiveTasks: 1,
      allowedProducts: ['pub-rate-calculator', 'pub-dev-loop-template', 'pub-shopee-scraper'],
    }, 'ceo-correction-proof-v2', 'Temporary elevation for exactly one CEO correction proof task');

    const hostExecutor = new AgentExecutor(undefined, { allowHostExecution: true });
    const provider = new RouterProvider(
      process.env.ROUTER_BASE_URL,
      process.env.ROUTER_API_KEY,
      300000,
      MODEL_ID,
      false,
      undefined,
      hostExecutor,
    );

    const remotePersistence = new PdlRemotePersistence(
      defaultProductCatalog,
      undefined,
      new GitHubTransport(),
    );

    const correctionWorker = new PdlCorrectionWorker(
      tasksRepo,
      provider,
      'pdl-ceo-correction-v2',
      (taskId, attempt, event, envelope) => {
        if (event?.type) {
          console.log(
            '[WORKER]',
            taskId,
            'attempt=' + attempt,
            event.type,
            JSON.stringify(event.payload || event),
          );
        }
      },
      pool,
      govEngine,
      defaultProductCatalog,
      remotePersistence,
      undefined,
      undefined,
      defaultCeoConversationStore,
    );

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
      console.log('[SCHEDULER]', ev.type, 'task=' + (ev.taskId || 'none'), 'reason=' + (ev.reasonCode || 'none'));
    });

    await scheduler.start();

    const gateway = new CeoCommandGateway({
      governance: govEngine,
      catalog: defaultProductCatalog,
      taskRepo: tasksRepo,
      intakeService,
      conversationStore: defaultCeoConversationStore,
    });

    const directiveText =
      'Corrija o contrato de limit em src/api/validation.ts. limit deve aceitar somente inteiros positivos entre 1 e 100. ' +
      'Valores decimais ou nao inteiros devem ser rejeitados, assim como zero, negativos, NaN, Infinity e formatos invalidos. ' +
      'Valores acima de 100 devem continuar limitados a 100. Preserve o comportamento valido existente. ' +
      'Atualize tests/api/validation.test.ts com testes determinísticos para decimais e demais entradas invalidas. ' +
      'Execute npm test e garanta exit code 0. Nao altere package.json, package-lock.json ou arquivos protegidos.';

    const gatewayResult = await gateway.handleCommand({
      command: directiveText,
      project: 'pub-shopee-scraper',
      trustedContext: {
        operatorId: 'MATHEUS',
        role: 'CEO',
        channel: 'api',
        verified: true,
      },
    });

    console.log('[GATEWAY]', JSON.stringify({
      commandId: gatewayResult.commandId,
      correlationId: gatewayResult.correlationId,
      status: gatewayResult.status,
      taskId: gatewayResult.taskId,
      governance: gatewayResult.governanceDecision?.reasonCode,
    }, null, 2));

    if (gatewayResult.status !== 'QUEUED' || !gatewayResult.taskId) {
      throw new Error('FAIL: CEO Gateway rejected directive: ' + (gatewayResult.error || gatewayResult.status));
    }

    const taskId = gatewayResult.taskId;
    let completedTask = null;

    for (let poll = 0; poll < 180; poll++) {
      await new Promise(r => setTimeout(r, 2000));
      const row = (await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId])).rows[0];

      if (poll % 5 === 0) {
        console.log('[POLL]', poll, 'status=' + (row?.status || 'UNKNOWN'));
      }

      if (row && ['COMPLETED', 'FAILED', 'BLOCKED'].includes(row.status)) {
        completedTask = row;
        break;
      }
    }

    executionOutcome = completedTask;

    if (!executionOutcome) {
      throw new Error('FAIL: task did not reach terminal state within 6 minutes');
    }
  } finally {
    if (scheduler) {
      try {
        await scheduler.stop('CEO_CORRECTION_PROOF_V2_FINISHED', 'COMPLETED');
      } catch {}
    }

    if (govBefore) {
      await pool.query(
        'UPDATE pdl_governance_state SET active_level=$1, kill_switch_active=$2, max_consecutive_tasks=$3, allowed_products=$4, updated_at=now(), updated_by=$5, reason=$6 WHERE id=$7',
        [
          govBefore.active_level,
          govBefore.kill_switch_active,
          govBefore.max_consecutive_tasks,
          JSON.stringify(govBefore.allowed_products),
          'ceo-correction-proof-v2-finally',
          'Restoring fail-closed baseline after CEO CORRECTION PROOF V2',
          'canonical',
        ],
      );
    }

    const govAfter = (await pool.query(
      'SELECT active_level, kill_switch_active, allowed_products FROM pdl_governance_state WHERE id = $1',
      ['canonical']
    )).rows[0];

    console.log('[RESTORE] Governance AFTER:', JSON.stringify(govAfter));
    await pool.end();
  }

  if (!executionOutcome) {
    throw new Error('FAIL: executionOutcome missing');
  }

  const resultObj = typeof executionOutcome.result === 'string'
    ? JSON.parse(executionOutcome.result)
    : executionOutcome.result;

  const correctionHistory = resultObj?.corrections
    ?? resultObj?.correction?.correctionHistory
    ?? resultObj?.correctionHistory
    ?? resultObj?.finalize?.correctionHistory
    ?? [];

  const correctionExecuted =
    Array.isArray(correctionHistory) && correctionHistory.length > 0
      ? true
      : (resultObj?.corrections?.length ?? 0) > 0
        || resultObj?.correction?.attemptsExecuted > 0;

  console.log('==============================================================');
  console.log('PROOF RESULT');
  console.log('==============================================================');
  console.log('Task:', executionOutcome.id);
  console.log('Status:', executionOutcome.status);
  console.log('Provider:', resultObj?.provider);
  console.log('Model:', resultObj?.model);
  console.log('Tool Calls:', resultObj?.toolCalls);
  console.log('Tool Rounds:', resultObj?.toolRounds);
  console.log('Correction Executed:', correctionExecuted);
  console.log('Correction Attempts:', resultObj?.corrections?.length ?? resultObj?.correction?.attemptsExecuted ?? correctionHistory.length);
  console.log('Tests Passed:', resultObj?.finalize?.testsPassed);
  console.log('Commit SHA:', executionOutcome.commit_sha);
  console.log('Remote Persistence:', resultObj?.remotePersistence?.status);
  console.log('Remote SHA:', resultObj?.remotePersistence?.remoteSha);

  if (executionOutcome.branch && resultObj?.remotePersistence?.status === 'VERIFIED') {
    const remote = execSync(
      'git ls-remote https://github.com/pubcoreagencia/pub-shopee-scraper.git refs/heads/' + executionOutcome.branch,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    const match = remote.match(/^([0-9a-f]{40})\s+/);
    const remoteSha = match?.[1] || null;
    console.log('Independent remote SHA:', remoteSha);
    console.log('SHA MATCH:', remoteSha === executionOutcome.commit_sha);
  }

  return {
    success: executionOutcome.status === 'COMPLETED' && correctionExecuted,
    correctionExecuted,
    task: executionOutcome,
    resultObj,
  };
}

runProof()
  .then(result => {
    console.log('FINAL CEO CORRECTION PROOF V2:', result.success ? 'PASS' : 'NOT_PROVEN');
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('FINAL CEO CORRECTION PROOF V2: FATAL', error);
    process.exit(1);
  });
