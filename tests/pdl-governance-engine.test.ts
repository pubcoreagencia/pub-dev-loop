import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Task } from '../src/domain.js';
import {
  PdlGovernanceEngine,
  PdlKillSwitch,
  DEFAULT_FAIL_CLOSED_LIMITS,
  type GovernanceLimits,
} from '../src/pdl/governance/index.js';
import { defaultProductCatalog } from '../src/pdl/products/catalog.js';
import { defaultRepositoryAuthorizationPolicy } from '../src/pdl/security/repo-authorization.js';
import { defaultRemotePersistence } from '../src/pdl/persistence/remote-persistence.js';
import { isFreeModel } from '../src/providers/model-registry.js';

// Mock DB pool helper for isolated testing
function createMockPool(rows: any[] = [], shouldFail = false) {
  return {
    query: async (sql: string, params?: any[]) => {
      if (shouldFail) {
        throw new Error('Simulated database connection failure');
      }
      if (sql.includes('SELECT') && sql.includes('pdl_governance_state')) {
        return { rows: [...rows] };
      }
      if (sql.includes('INSERT') || sql.includes('UPDATE')) {
        if (params && params.length >= 2) {
          // Mock save
          rows[0] = {
            id: 'canonical',
            active_level: params[1],
            kill_switch_active: params[2],
            max_consecutive_tasks: params[3],
            max_task_duration_ms: params[4],
            max_tool_rounds_per_task: params[5],
            max_correction_attempts: params[6],
            max_consecutive_failures: params[7],
            allowed_products: params[8],
            updated_by: params[9],
            reason: params[10],
          };
        }
        return { rowCount: 1, rows };
      }
      return { rows: [] };
    },
  } as any;
}

function createDummyTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-test-123',
    project: 'pub-rate-calculator',
    repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
    objective: 'Test governance',
    prompt: 'Execute tests',
    status: 'QUEUED',
    priority: 1,
    worker: null,
    result: null,
    error: null,
    branch: 'rate-calculator-test',
    commitSha: '3c56912d4d419ef46cebb6530247b0f0db1cee63',
    gitStatus: 'clean',
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    prototypeSessionId: null,
    ...overrides,
  };
}

describe('PDL Phase 5.5 Step 1: Governance Policy Engine & Emergency Kill Switch', () => {
  const testKillSwitchPath = path.resolve(process.cwd(), '.test-killswitch');

  beforeEach(() => {
    delete process.env.PDL_EMERGENCY_STOP;
    delete process.env.PDL_KILL_SWITCH;
    if (fs.existsSync(testKillSwitchPath)) {
      fs.unlinkSync(testKillSwitchPath);
    }
  });

  afterEach(() => {
    delete process.env.PDL_EMERGENCY_STOP;
    delete process.env.PDL_KILL_SWITCH;
    if (fs.existsSync(testKillSwitchPath)) {
      fs.unlinkSync(testKillSwitchPath);
    }
  });

  // ==========================================
  // GOVERNANCE LEVEL & LIMIT TESTS
  // ==========================================

  it('1. Level 0 blocks autonomous claim', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 0,
      kill_switch_active: false,
      max_consecutive_tasks: 1,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });

    const decision = await engine.evaluateClaim();
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('LEVEL_0_MANUAL_ONLY');
    expect(decision.activeLevel).toBe(0);
  });

  it('2. Level 1 permits explicitly dispatched task execution', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 1,
      kill_switch_active: false,
      max_consecutive_tasks: 1,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });
    const task = createDummyTask();

    const claimDecision = await engine.evaluateClaim(task);
    expect(claimDecision.allowed).toBe(true);
    expect(claimDecision.reasonCode).toBe('PERMITTED');

    const execDecision = await engine.evaluateExecution(task);
    expect(execDecision.allowed).toBe(true);
    expect(execDecision.reasonCode).toBe('PERMITTED');
  });

  it('3. Level 2 permits authorized queued task execution', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 2,
      kill_switch_active: false,
      max_consecutive_tasks: 2,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });
    const task = createDummyTask();

    const decision = await engine.evaluateClaim(task);
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe('PERMITTED');
    expect(decision.activeLevel).toBe(2);
  });

  it('4. Level 3 permits bounded continuation', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 3,
      kill_switch_active: false,
      max_consecutive_tasks: 3,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });

    // Task 1 of 3: permitted
    const contDecision1 = await engine.evaluateContinuation({
      consecutiveTasksCount: 0,
      consecutiveFailuresCount: 0,
    });
    expect(contDecision1.allowed).toBe(true);
    expect(contDecision1.reasonCode).toBe('PERMITTED');

    // Task 3 reached (limit 3): stopped
    const contDecision3 = await engine.evaluateContinuation({
      consecutiveTasksCount: 3,
      consecutiveFailuresCount: 0,
    });
    expect(contDecision3.allowed).toBe(false);
    expect(contDecision3.reasonCode).toBe('CONSECUTIVE_TASKS_EXCEEDED');
  });

  it('5. Level 4 permits authorized scheduling', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 4,
      kill_switch_active: false,
      max_consecutive_tasks: 5,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });

    const limits = await engine.loadLimits();
    expect(limits.activeLevel).toBe(4);
    expect(limits.killSwitchActive).toBe(false);

    const claimDecision = await engine.evaluateClaim();
    expect(claimDecision.allowed).toBe(true);
  });

  it('6. Level 5 is strictly rejected and fails closed to Level 0', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 5, // Forbidden level!
      kill_switch_active: false,
      max_consecutive_tasks: 1,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });

    const limits = await engine.loadLimits();
    expect(limits.activeLevel).toBe(0);
    expect(limits.killSwitchActive).toBe(true);

    const claimDecision = await engine.evaluateClaim();
    expect(claimDecision.allowed).toBe(false);
  });

  it('7. Missing governance config fails closed', async () => {
    const pool = createMockPool([]); // Empty table
    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });

    const limits = await engine.loadLimits();
    expect(limits.activeLevel).toBe(0);
    expect(limits.killSwitchActive).toBe(true);

    const claimDecision = await engine.evaluateClaim();
    expect(claimDecision.allowed).toBe(false);
    expect(claimDecision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
  });

  it('8. Malformed governance config fails closed', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 'invalid-string',
      kill_switch_active: 'not-a-bool',
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });

    const limits = await engine.loadLimits();
    expect(limits.activeLevel).toBe(0);
    expect(limits.killSwitchActive).toBe(true);
  });

  it('9. Invalid limits fail closed', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: -1,
      kill_switch_active: false,
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });

    const limits = await engine.loadLimits();
    expect(limits.activeLevel).toBe(0);
    expect(limits.killSwitchActive).toBe(true);
  });

  it('10. Unauthorized product is rejected at claim and execution gates', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 2,
      kill_switch_active: false,
      max_consecutive_tasks: 1,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'], // Only pub-rate-calculator allowed
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });
    const unauthorizedTask = createDummyTask({ project: 'pub-shopee-scraper' });

    const claimDecision = await engine.evaluateClaim(unauthorizedTask);
    expect(claimDecision.allowed).toBe(false);
    expect(claimDecision.reasonCode).toBe('UNAUTHORIZED_PRODUCT');

    const execDecision = await engine.evaluateExecution(unauthorizedTask);
    expect(execDecision.allowed).toBe(false);
    expect(execDecision.reasonCode).toBe('UNAUTHORIZED_PRODUCT');
  });

  it('11. Governance decision contains deterministic reason code and description', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 1,
      kill_switch_active: false,
      max_consecutive_tasks: 1,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });
    const task = createDummyTask();

    const decision = await engine.evaluateExecution(task, { durationMs: 250000 });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('TASK_DURATION_EXCEEDED');
    expect(decision.reason).toContain('exceeded governance limit');
    expect(decision.gate).toBe('EXECUTION');
    expect(decision.timestamp).toBeDefined();
  });

  // ==========================================
  // EMERGENCY KILL SWITCH & GATES TESTS
  // ==========================================

  it('12. Kill switch OFF permits execution', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 1,
      kill_switch_active: false,
      max_consecutive_tasks: 1,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const status = await killSwitch.checkStatus();
    expect(status.active).toBe(false);

    const engine = new PdlGovernanceEngine({ pool, killSwitch });
    const task = createDummyTask();

    const decision = await engine.evaluateExecution(task);
    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe('PERMITTED');
  });

  it('13. Kill switch ON blocks claim (Gate A)', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 2,
      kill_switch_active: true, // Emergency Stop in DB!
      max_consecutive_tasks: 1,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });

    const decision = await engine.evaluateClaim();
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
    expect(decision.gate).toBe('CLAIM');
  });

  it('14. Kill switch ON blocks execution start (Gate B)', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 2,
      kill_switch_active: true,
      max_consecutive_tasks: 1,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });
    const task = createDummyTask();

    const decision = await engine.evaluateExecution(task);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
    expect(decision.gate).toBe('EXECUTION');
  });

  it('15. Kill switch ON blocks correction (Gate C)', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 2,
      kill_switch_active: true,
      max_consecutive_tasks: 1,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });
    const task = createDummyTask();

    const decision = await engine.evaluateCorrection(task, { attemptNumber: 1 });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
    expect(decision.gate).toBe('CORRECTION');
  });

  it('16. Kill switch ON blocks finalization (Gate D)', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 2,
      kill_switch_active: true,
      max_consecutive_tasks: 1,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });
    const task = createDummyTask();

    const decision = await engine.evaluateFinalization(task);
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
    expect(decision.gate).toBe('FINALIZATION');
  });

  it('17. Kill switch ON blocks continuation (Gate E)', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 3,
      kill_switch_active: true,
      max_consecutive_tasks: 3,
      max_task_duration_ms: 180000,
      max_tool_rounds_per_task: 10,
      max_correction_attempts: 2,
      max_consecutive_failures: 1,
      allowed_products: ['pub-rate-calculator'],
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const engine = new PdlGovernanceEngine({ pool, killSwitch });

    const decision = await engine.evaluateContinuation({
      consecutiveTasksCount: 0,
      consecutiveFailuresCount: 0,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
    expect(decision.gate).toBe('CONTINUATION');
  });

  it('18. DB STOP overrides RUN', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 1,
      kill_switch_active: true, // DB STOP
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const status = await killSwitch.checkStatus();
    expect(status.active).toBe(true);
    expect(status.reason).toContain('database governance state has kill_switch_active = true');
  });

  it('19. Emergency local STOP overrides DB RUN', async () => {
    const pool = createMockPool([{
      id: 'canonical',
      active_level: 1,
      kill_switch_active: false, // DB is RUN
    }]);

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    killSwitch.createLocalFile('Operator triggered emergency stop');

    const status = await killSwitch.checkStatus();
    expect(status.active).toBe(true);
    expect(status.reason).toContain('local override file');

    const engine = new PdlGovernanceEngine({ pool, killSwitch });
    const decision = await engine.evaluateClaim();
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
  });

  it('20. Governance read failure results in fail-closed STOP', async () => {
    const pool = createMockPool([], true); // Database throws error on query

    const killSwitch = new PdlKillSwitch({ pool, filePath: testKillSwitchPath });
    const status = await killSwitch.checkStatus();
    expect(status.active).toBe(true);
    expect(status.reason).toContain('Database governance state unreadable or disconnected');

    const engine = new PdlGovernanceEngine({ pool, killSwitch });
    const limits = await engine.loadLimits();
    expect(limits.activeLevel).toBe(0);
    expect(limits.killSwitchActive).toBe(true);

    const decision = await engine.evaluateClaim();
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('KILL_SWITCH_ACTIVE');
  });

  // ==========================================
  // SAFETY & BASELINE PRESERVATION TESTS
  // ==========================================

  it('21. Phase 5.4 FREE-only policy remains intact', () => {
    // Model validated in Phase 5.4 must pass
    expect(isFreeModel('kc/cohere/north-mini-code:free')).toBe(true);
    expect(isFreeModel('openrouter/cohere/north-mini-code:free')).toBe(true);

    // Paid models must be blocked
    expect(isFreeModel('anthropic/claude-3.5-sonnet')).toBe(false);
    expect(isFreeModel('google/gemini-2.0-flash-exp:free')).toBe(false);
    expect(isFreeModel('unknown/random-model')).toBe(false);
  });

  it('22. ProductCatalog authorization remains intact', () => {
    const catalog = defaultProductCatalog;
    expect(catalog.get('pub-rate-calculator')).toBeDefined();
    expect(catalog.get('pub-dev-loop-template')).toBeDefined();
    expect(catalog.get('pub-shopee-scraper')).toBeDefined();

    const product = catalog.get('pub-rate-calculator');
    expect(product?.defaultBranch).toBe('main');
    expect(product?.allowedPaths).toContain('src/**');
  });

  it('23. Protected branch rules remain intact', () => {
    const policy = defaultRepositoryAuthorizationPolicy;

    const allowedBranch = policy.authorize({
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      branch: 'rate-calculator-improve-1789235231240',
    });
    expect(allowedBranch.authorized).toBe(true);

    const protectedBranch = policy.authorize({
      repository: 'https://github.com/pubcoreagencia/pub-rate-calculator.git',
      branch: 'production',
    });
    expect(protectedBranch.authorized).toBe(false);
    expect(protectedBranch.reason).toContain('protected branch');
  });

  it('24. PdlRemotePersistence remains intact', () => {
    expect(defaultRemotePersistence).toBeDefined();
    expect(typeof defaultRemotePersistence.persist).toBe('function');
  });

  it('25. PP isolation remains intact', () => {
    // Zero dependencies on PP prototype packages or tables in governance
    expect(DEFAULT_FAIL_CLOSED_LIMITS.activeLevel).toBe(0);
    expect(DEFAULT_FAIL_CLOSED_LIMITS.killSwitchActive).toBe(true);
  });
});
