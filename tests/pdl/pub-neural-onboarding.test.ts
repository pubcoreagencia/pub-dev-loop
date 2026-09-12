import { describe, expect, it, vi } from 'vitest';
import { defaultProductCatalog } from '../../src/pdl/products/catalog.js';
import { RepositoryAuthorizationPolicy } from '../../src/pdl/security/repo-authorization.js';
import { PdlGovernanceEngine } from '../../src/pdl/governance/policy-engine.js';

describe('PUB Neural PDL onboarding contract', () => {
  const repository = 'https://github.com/pubcoreagencia/pub-neural.git';

  it('registers pub-neural with an explicit governed product manifest', () => {
    const manifest = defaultProductCatalog.get('pub-neural');

    expect(manifest).toBeDefined();
    expect(manifest?.productId).toBe('pub-neural');
    expect(manifest?.repository).toBe(repository);
    expect(manifest?.organization).toBe('pubcoreagencia');
    expect(manifest?.defaultBranch).toBe('main');
    expect(manifest?.developmentBranchPolicy).toContain('worker/*');
    expect(manifest?.testCommand).toBe('bash tests/ingestion/run_ingestion_tests.sh');
    expect(manifest?.validationCommand).toBe('python3 -m compileall -q src');
    expect(manifest?.remotePersistenceEligible).toBe(true);
    expect(manifest?.maxAutonomyLevel).toBe(4);
    expect(manifest?.protectedPaths).toEqual(expect.arrayContaining(['.github/**', '.env*']));
  });

  it('authorizes a pub-neural worker branch but blocks main for autonomous branch execution', () => {
    const policy = new RepositoryAuthorizationPolicy();

    const workerBranch = policy.authorize({ repository, branch: 'worker/pdl-pub-neural-test' });
    const mainBranch = policy.authorize({ repository, branch: 'main' });

    expect(workerBranch.authorized).toBe(true);
    expect(workerBranch.owner).toBe('pubcoreagencia');
    expect(workerBranch.name).toBe('pub-neural');
    expect(workerBranch.branch).toBe('worker/pdl-pub-neural-test');
    expect(mainBranch.authorized).toBe(false);
    expect(mainBranch.reason).toContain("Branch 'main' is not authorized");
  });

  it('permits execution only when governance explicitly includes pub-neural', async () => {
    const query = vi.fn(async () => ({
      rows: [{
        active_level: 4,
        kill_switch_active: false,
        max_consecutive_tasks: 1,
        max_task_duration_ms: 180000,
        max_tool_rounds_per_task: 10,
        max_correction_attempts: 2,
        max_consecutive_failures: 1,
        allowed_products: ['pub-neural'],
      }],
    }));

    const governance = new PdlGovernanceEngine({
      pool: { query } as any,
      killSwitch: { checkStatus: vi.fn(async () => ({
        active: false,
        reason: 'test clear',
        sources: { db: false, file: false, env: false },
      })) } as any,
    });

    const decision = await governance.evaluateExecution({
      id: 'task-pub-neural',
      project: 'pub-neural',
      repository,
    } as any);

    expect(decision.allowed).toBe(true);
    expect(decision.reasonCode).toBe('PERMITTED');
  });

  it('blocks pub-neural when governance allowlist does not contain the target', async () => {
    const query = vi.fn(async () => ({
      rows: [{
        active_level: 4,
        kill_switch_active: false,
        max_consecutive_tasks: 1,
        max_task_duration_ms: 180000,
        max_tool_rounds_per_task: 10,
        max_correction_attempts: 2,
        max_consecutive_failures: 1,
        allowed_products: ['pub-rate-calculator'],
      }],
    }));

    const governance = new PdlGovernanceEngine({
      pool: { query } as any,
      killSwitch: { checkStatus: vi.fn(async () => ({
        active: false,
        reason: 'test clear',
        sources: { db: false, file: false, env: false },
      })) } as any,
    });

    const decision = await governance.evaluateExecution({
      id: 'task-pub-neural',
      project: 'pub-neural',
      repository,
    } as any);

    expect(decision.allowed).toBe(false);
    expect(decision.reasonCode).toBe('UNAUTHORIZED_PRODUCT');
  });
});
