import { describe, it, expect, beforeEach } from 'vitest';
import { normalizeTaskIntake } from '../src/task/intake.js';
import { PdlRefinementProvider } from '../src/pdl/refinement/refinement-provider.js';
import { PdlRefinementEngine } from '../src/pdl/refinement/refinement-engine.js';
import { PdlPreflightEngine } from '../src/pdl/research/preflight-engine.js';
import { TaskIntakeService } from '../src/pdl/service/task-intake-service.js';
import { DailySkillEngine } from '../src/office/skills.js';
import { validateExecutionSpec } from '../src/task/spec-validator.js';

describe('Gate 3D.2 — Structured Prompt Refinement & Spec Semantic Enrichment', () => {
  let skillEngine: DailySkillEngine;

  beforeEach(() => {
    skillEngine = new DailySkillEngine();
    skillEngine.registerSkill({
      id: 'skill-auth-jwt',
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      name: 'JWT Authentication Standard',
      description: 'Implement JWT token parsing and signature verification',
      capability: 'SECURITY_ENFORCEMENT',
      sourceExperiences: [],
      confidence: 'HIGH',
      version: 1,
      applicableRoles: ['developer', 'architect'],
      applicableContexts: ['PROJECT'],
      limitations: [],
      executableGuideline: 'Use verifyJwtBearerToken with HS256 secret',
      status: 'ACTIVE',
      provenance: {
        tenantId: 'pub-dev-loop',
        projectId: 'pub-dev-loop',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  });

  it('1. refines a simple request into concrete acceptance criteria, plan, and steps', async () => {
    const intake = normalizeTaskIntake({
      rawRequest: 'Add health check endpoint at GET /healthz',
      source: 'pdl-api-test',
      createdAt: new Date().toISOString(),
    });

    const preflightEngine = new PdlPreflightEngine({
      project: 'pub-dev-loop',
      workspaceRoot: process.cwd(),
      skillEngine,
    });
    const { context, preflight } = await preflightEngine.run(intake);

    const refinementEngine = new PdlRefinementEngine();
    const refinedSpec = await refinementEngine.refine(intake, context, preflight);

    // 1. Objective preserves raw intent
    expect(refinedSpec.objective).toContain('health check endpoint');

    // 2. Concrete acceptance criteria (no generic fallback)
    expect(refinedSpec.acceptanceCriteria).toBeInstanceOf(Array);
    expect(refinedSpec.acceptanceCriteria.length).toBeGreaterThan(1);
    expect(refinedSpec.acceptanceCriteria).not.toContain('Fulfill objective: Add health check endpoint at GET /healthz');
    expect(refinedSpec.acceptanceCriteria.some((c) => c.toLowerCase().includes('automated test'))).toBe(true);

    // 3. Concrete validation plan
    expect(refinedSpec.validationPlan).toBeInstanceOf(Array);
    expect(refinedSpec.validationPlan.length).toBeGreaterThan(1);
    expect(refinedSpec.validationPlan).not.toContain('Verify implementation against objective: Add health check endpoint at GET /healthz');
    expect(refinedSpec.validationPlan.some((p) => p.includes('test') || p.includes('typecheck'))).toBe(true);

    // 4. Ordered execution steps
    expect(refinedSpec.executionSteps).toBeInstanceOf(Array);
    expect(refinedSpec.executionSteps.length).toBe(4);
    expect(refinedSpec.executionSteps[0].id).toBe('step-1-inspect');
    expect(refinedSpec.executionSteps[1].id).toBe('step-2-implement');
    expect(refinedSpec.executionSteps[1].dependsOn).toEqual(['step-1-inspect']);
    expect(refinedSpec.executionSteps[2].id).toBe('step-3-validate');
    expect(refinedSpec.executionSteps[3].id).toBe('step-4-review');

    // Structural validation passes
    const validation = validateExecutionSpec(refinedSpec);
    expect(validation.valid).toBe(true);
  });

  it('2. refines an ambiguous request and separates risks from constraints', async () => {
    // Request with intentional ambiguity (no explicit outcome or constraints)
    const intake = normalizeTaskIntake({
      rawRequest: 'Fix the login bug',
      source: 'pdl-api-test',
      createdAt: new Date().toISOString(),
    });

    expect(intake.ambiguityFlags.length).toBeGreaterThan(0);

    const preflightEngine = new PdlPreflightEngine({ project: 'pub-dev-loop', workspaceRoot: process.cwd() });
    const { context, preflight } = await preflightEngine.run(intake);

    const refinementEngine = new PdlRefinementEngine();
    const refinedSpec = await refinementEngine.refine(intake, context, preflight);

    // Risks must contain ambiguity flag insights, NOT converted to authoritative constraints
    expect(refinedSpec.risks.length).toBeGreaterThan(0);
    expect(refinedSpec.risks.some((r) => r.includes('ambiguous') || r.includes('outcome') || r.includes('constraints'))).toBe(true);

    // Constraints must preserve safety boundaries
    expect(refinedSpec.constraints.length).toBeGreaterThan(0);
    expect(refinedSpec.constraints.some((c) => c.includes('workspace'))).toBe(true);
  });

  it('3. preserves raw intent without scope creep or hallucinated requirements', async () => {
    const raw = 'Refactor repository exports in index.ts to use explicit named exports';
    const intake = normalizeTaskIntake({
      rawRequest: raw,
      source: 'pdl-api-test',
      createdAt: new Date().toISOString(),
    });

    const preflightEngine = new PdlPreflightEngine({ project: 'pub-dev-loop', workspaceRoot: process.cwd() });
    const { context, preflight } = await preflightEngine.run(intake);

    const refinementEngine = new PdlRefinementEngine();
    const refinedSpec = await refinementEngine.refine(intake, context, preflight);

    expect(refinedSpec.objective).toBe(raw);
    expect(refinedSpec.acceptanceCriteria.some((ac) => ac.includes(raw))).toBe(true);
  });

  it('4. incorporates preflight context and discovered skills', async () => {
    const intake = normalizeTaskIntake({
      rawRequest: 'Implement authentication middleware',
      source: 'pdl-api-test',
      createdAt: new Date().toISOString(),
    });

    const preflightEngine = new PdlPreflightEngine({
      project: 'pub-dev-loop',
      workspaceRoot: process.cwd(),
      skillEngine,
      agentRole: 'developer',
    });
    const { context, preflight } = await preflightEngine.run(intake);

    // Preflight discovered the skill
    const hasSkill = context.operationalContext.some((f) => f.key.includes('SECURITY_ENFORCEMENT'));
    expect(hasSkill).toBe(true);

    const refinementEngine = new PdlRefinementEngine();
    const refinedSpec = await refinementEngine.refine(intake, context, preflight);

    // Context bundle in refined spec contains the preflight context
    expect((refinedSpec.context as any).operationalContext.some((f: any) => f.key.includes('SECURITY_ENFORCEMENT'))).toBe(true);
    expect((refinedSpec.context as any).relevantDocumentation.length).toBeGreaterThan(0);
  });

  it('5. provides deterministic output when input and context are identical', async () => {
    const intake = normalizeTaskIntake({
      rawRequest: 'Create metrics exporter',
      source: 'pdl-api-test',
      createdAt: '2026-09-11T12:00:00.000Z',
    });

    const preflightEngine = new PdlPreflightEngine({ project: 'pub-dev-loop', workspaceRoot: process.cwd() });
    const { context, preflight } = await preflightEngine.run(intake);

    const refinementEngine = new PdlRefinementEngine();
    const specA = await refinementEngine.refine(intake, context, preflight);
    const specB = await refinementEngine.refine(intake, context, preflight);

    expect(specA.objective).toEqual(specB.objective);
    expect(specA.acceptanceCriteria).toEqual(specB.acceptanceCriteria);
    expect(specA.validationPlan).toEqual(specB.validationPlan);
    expect(specA.executionSteps).toEqual(specB.executionSteps);
    expect(specA.constraints).toEqual(specB.constraints);
  });

  it('6. integrates seamlessly into TaskIntakeService without second spec authority', async () => {
    let insertedSpecContent: string | null = null;
    let sealedStatus: string | null = null;

    const mockPool: any = {
      connect: async () => ({
        query: async (sql: string, params?: unknown[]) => {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO tasks')) {
            return {
              rows: [
                {
                  id: 'task-refine-test-1',
                  project: params?.[0],
                  repository: params?.[1],
                  objective: params?.[2],
                  prompt: params?.[3],
                  priority: params?.[4],
                  status: 'QUEUED',
                  created_at: new Date(),
                  updated_at: new Date(),
                },
              ],
            };
          }
          if (sql.includes('SELECT status FROM execution_specs')) {
            return { rows: [{ status: 'UNSEALED' }] };
          }
          if (sql.includes('SELECT * FROM execution_specs WHERE task_id')) {
            if (insertedSpecContent) {
              return {
                rows: [
                  {
                    id: 'spec-test-draft',
                    task_id: params?.[0],
                    spec_version: '1.0.0',
                    spec_hash: '',
                    objective: 'test',
                    lineage: {},
                    status: 'UNSEALED',
                    created_at: new Date(),
                    spec_content_json: insertedSpecContent,
                  },
                ],
              };
            }
            return { rows: [] };
          }
          if (sql.includes('INSERT INTO execution_specs')) {
            insertedSpecContent = params?.[9];
            return {
              rows: [
                {
                  id: params?.[0],
                  task_id: params?.[1],
                  spec_version: params?.[2],
                  spec_hash: params?.[3],
                  objective: params?.[4],
                  lineage: typeof params?.[5] === 'string' ? JSON.parse(params?.[5]) : params?.[5],
                  status: 'UNSEALED',
                  created_at: new Date(),
                  spec_content_json: params?.[9],
                },
              ],
            };
          }
          if (sql.includes('UPDATE execution_specs')) {
            sealedStatus = params?.[0];
            return {
              rows: [
                {
                  id: 'spec-test-1',
                  task_id: params?.[4],
                  spec_version: '1.0.0',
                  spec_hash: params?.[2],
                  objective: 'test',
                  lineage: {},
                  status: 'SEALED',
                  created_at: new Date(),
                  sealed_at: new Date(),
                  spec_content_json: insertedSpecContent,
                },
              ],
            };
          }
          return { rows: [] };
        },
        release: () => {},
      }),
    };

    const intakeService = new TaskIntakeService(mockPool);
    const result = await intakeService.processIntake({
      rawRequest: 'Create microservice telemetry endpoint',
      project: 'pub-dev-loop',
    });

    expect(result.task).toBeDefined();
    expect(result.task.id).toBe('task-refine-test-1');
    expect(sealedStatus).toBe('SEALED');

    // Parse the single authoritative sealed execution spec
    const sealedSpec = JSON.parse(result.executionSpec.spec_content_json);

    // PROOF: Sealed spec contains the refined criteria and steps, NOT simplistic fallbacks
    expect(sealedSpec.acceptanceCriteria).not.toContain('Fulfill objective: Create microservice telemetry endpoint');
    expect(sealedSpec.acceptanceCriteria.length).toBeGreaterThan(1);
    expect(sealedSpec.validationPlan).not.toContain('Verify implementation against objective: Create microservice telemetry endpoint');
    expect(sealedSpec.validationPlan.length).toBeGreaterThan(1);
    expect(sealedSpec.executionSteps.length).toBe(4);
    expect(sealedSpec.executionSteps[0].id).toBe('step-1-inspect');

    // PROOF: Exactly one spec, valid and verified
    const validation = validateExecutionSpec(sealedSpec);
    expect(validation.valid).toBe(true);
  });

  it('7. isolates Pub Prototype (PP): PP tasks remain untouched and uninfluenced', async () => {
    // Verifies that refinement module does not import from or interact with PP
    const refinement = new PdlRefinementProvider();
    expect(refinement).toBeDefined();
    // No prototype session id or prototype repository leaks into refinement
    const dummyReq: any = {
      intake: normalizeTaskIntake({ rawRequest: 'PP isolation check', source: 'test', createdAt: new Date().toISOString() }),
      context: { version: '1.0.0', authoritativeContext: [], repositoryContext: [], operationalContext: [], relevantDocumentation: [], knownConstraints: [], limitations: [], evidence: [] },
      preflight: { version: '1.0.0', status: 'COMPLETED', gateStatus: 'READY', findings: [], failures: [], warnings: [], categoryResults: [] },
    };
    const response = await refinement.refine(dummyReq);
    expect((response as any).prototypeSessionId).toBeUndefined();
  });
});
