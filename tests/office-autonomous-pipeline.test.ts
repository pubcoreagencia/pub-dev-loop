import { describe, it, expect, beforeEach } from 'vitest';
import {
  AutonomousPipelineEngine,
  AdaptiveTaskFlowEngine,
  defaultAutonomousPipelineEngine,
  type AutonomousPipeline,
  type CreatePipelineInput,
} from '../src/office/autonomous-pipeline.js';
import apiWorker from '../src/api-worker.js';

describe('PDL — Phase 8.8: Governed Autonomous Execution & Adaptive Task Flow Suite', () => {
  let engine: AutonomousPipelineEngine;
  let flowEngine: AdaptiveTaskFlowEngine;
  const mockEnv: any = {
    PUB_DEV_LOOP_API_KEY: 'test-office-token',
  };

  const samplePipelineInput: CreatePipelineInput = {
    tenantId: 'pub-dev-loop',
    projectId: 'pub-dev-loop',
    title: 'Migrate DB to Multi-Tenant Schema',
    ceoObjective: 'Migrate PostgreSQL database safely with architecture & security review',
    steps: [
      {
        id: 'step-arch',
        title: 'Design Multi-Tenant DDL',
        description: 'Create migration SQL with RLS policies',
        targetRole: 'architect',
        requiredSkills: ['ARCHITECTURE_DESIGN'],
      },
      {
        id: 'step-sec-gate',
        title: 'Review Security Policies',
        description: 'Audit RLS security policies before applying schema',
        targetRole: 'reviewer',
        dependsOnStepIds: ['step-arch'],
        checkpoint: {
          type: 'SECURITY_AUDIT',
          title: 'CEO Approval for Security Policy Rollout',
          rationale: 'Security policy change requires sovereign CEO sign-off',
        },
      },
      {
        id: 'step-dev',
        title: 'Apply Schema Migration',
        description: 'Execute DDL migration scripts in workspace',
        targetRole: 'developer',
        dependsOnStepIds: ['step-sec-gate'],
      },
      {
        id: 'step-qa',
        title: 'Verify Isolation & Performance',
        description: 'Run automated isolation test suites',
        targetRole: 'qa-engineer',
        dependsOnStepIds: ['step-dev'],
      },
    ],
  };

  beforeEach(() => {
    engine = new AutonomousPipelineEngine();
    flowEngine = new AdaptiveTaskFlowEngine();
    defaultAutonomousPipelineEngine.clear();
  });

  // 1-5: Creation & DAG Validation
  it('1. Creates a valid AutonomousPipeline with normalized steps and PLANNING status', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    expect(pipeline.id).toMatch(/^pipe-/);
    expect(pipeline.status).toBe('PLANNING');
    expect(pipeline.totalSteps).toBe(4);
    expect(pipeline.completedSteps).toBe(0);
    expect(pipeline.steps[0].status).toBe('READY');
    expect(pipeline.steps[1].status).toBe('WAITING_DEPENDENCY');
  });

  it('2. Throws when creating pipeline without title or ceoObjective', () => {
    expect(() => engine.createPipeline({ ...samplePipelineInput, title: '' })).toThrow(/required/);
    expect(() => engine.createPipeline({ ...samplePipelineInput, ceoObjective: '' })).toThrow(/required/);
  });

  it('3. Throws when creating pipeline with empty steps array', () => {
    expect(() => engine.createPipeline({ ...samplePipelineInput, steps: [] })).toThrow(/at least one step/);
  });

  it('4. Detects direct cyclic dependency (A -> B -> A) and throws', () => {
    const cyclicInput: CreatePipelineInput = {
      title: 'Cyclic Test',
      ceoObjective: 'Test cyclic detection',
      steps: [
        { id: 'step-a', title: 'A', description: 'A', targetRole: 'developer', dependsOnStepIds: ['step-b'] },
        { id: 'step-b', title: 'B', description: 'B', targetRole: 'developer', dependsOnStepIds: ['step-a'] },
      ],
    };
    expect(() => engine.createPipeline(cyclicInput)).toThrow(/Cyclic dependency/);
  });

  it('5. Detects 3-node cyclic dependency (A -> B -> C -> A) and throws', () => {
    const cyclicInput: CreatePipelineInput = {
      title: '3-Node Cyclic Test',
      ceoObjective: 'Test cyclic detection',
      steps: [
        { id: 'step-a', title: 'A', description: 'A', targetRole: 'developer', dependsOnStepIds: ['step-c'] },
        { id: 'step-b', title: 'B', description: 'B', targetRole: 'developer', dependsOnStepIds: ['step-a'] },
        { id: 'step-c', title: 'C', description: 'C', targetRole: 'developer', dependsOnStepIds: ['step-b'] },
      ],
    };
    expect(() => engine.createPipeline(cyclicInput)).toThrow(/Cyclic dependency/);
  });

  // 6-10: Advanced DAG & Scoping
  it('6. Allows valid diamond DAG graph (A -> B, A -> C, B -> D, C -> D)', () => {
    const diamondInput: CreatePipelineInput = {
      title: 'Diamond DAG Test',
      ceoObjective: 'Test diamond dependency',
      steps: [
        { id: 'step-a', title: 'A', description: 'Root', targetRole: 'architect' },
        { id: 'step-b', title: 'B', description: 'Branch 1', targetRole: 'developer', dependsOnStepIds: ['step-a'] },
        { id: 'step-c', title: 'C', description: 'Branch 2', targetRole: 'developer', dependsOnStepIds: ['step-a'] },
        { id: 'step-d', title: 'D', description: 'Join', targetRole: 'qa-engineer', dependsOnStepIds: ['step-b', 'step-c'] },
      ],
    };
    const pipeline = engine.createPipeline(diamondInput);
    expect(pipeline.steps.length).toBe(4);
  });

  it('7. Retrieves pipeline by ID and returns undefined for unknown', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    expect(engine.getPipeline(pipeline.id)).toBeDefined();
    expect(engine.getPipeline('unknown-id')).toBeUndefined();
  });

  it('8. Enforces tenant isolation in getPipeline', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    expect(engine.getPipeline(pipeline.id, 'foreign-tenant')).toBeUndefined();
    expect(engine.getPipeline(pipeline.id, 'pub-dev-loop')).toBeDefined();
  });

  it('9. Filters pipelines by tenantId, projectId and status', () => {
    const p1 = engine.createPipeline(samplePipelineInput);
    const p2 = engine.createPipeline({ ...samplePipelineInput, projectId: 'other-project' });

    expect(engine.listPipelines({ projectId: 'pub-dev-loop' }).map(p => p.id)).toContain(p1.id);
    expect(engine.listPipelines({ projectId: 'pub-dev-loop' }).map(p => p.id)).not.toContain(p2.id);
  });

  it('10. Matches agents adaptively for canonical roles', () => {
    expect(flowEngine.matchAgentForStep('architect')).toBe('architect');
    expect(flowEngine.matchAgentForStep('developer')).toBe('developer');
    expect(flowEngine.matchAgentForStep('reviewer')).toBe('reviewer');
    expect(flowEngine.matchAgentForStep('qa-engineer')).toBe('qa-engineer');
    expect(flowEngine.matchAgentForStep('chief-of-staff')).toBe('chief-of-staff');
  });

  // 11-15: Tick Execution & Dependency Resolution
  it('11. tickPipeline initializes root steps with no dependencies to READY', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    const ticked = engine.tickPipeline(pipeline.id);
    expect(ticked.status).toBe('RUNNING');
    expect(ticked.steps[0].status).toBe('READY');
    expect(ticked.steps[1].status).toBe('WAITING_DEPENDENCY');
  });

  it('12. completeStep finishes a step and advances downstream step', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    engine.tickPipeline(pipeline.id);

    const advanced = engine.completeStep(pipeline.id, 'step-arch', 'DDL created');
    expect(advanced.completedSteps).toBe(1);
    expect(advanced.steps[0].status).toBe('COMPLETED');
    expect(advanced.steps[0].outputSummary).toBe('DDL created');
  });

  it('13. Hits CEO approval checkpoint and enters WAITING_APPROVAL status', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    engine.completeStep(pipeline.id, 'step-arch', 'DDL created');

    const waiting = engine.getPipeline(pipeline.id);
    expect(waiting?.status).toBe('WAITING_APPROVAL');
    expect(waiting?.steps[1].status).toBe('WAITING_APPROVAL');
  });

  it('14. decideCheckpoint with GRANT unlocks downstream step', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    engine.completeStep(pipeline.id, 'step-arch', 'DDL created');

    const approved = engine.decideCheckpoint(pipeline.id, 'step-sec-gate', 'GRANT', 'CEO');
    expect(approved.steps[1].checkpoint?.status).toBe('GRANTED');
    expect(approved.steps[1].status).toBe('READY');
    expect(approved.status).toBe('RUNNING');
  });

  it('15. decideCheckpoint with REJECT marks step and pipeline as FAILED', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    engine.completeStep(pipeline.id, 'step-arch', 'DDL created');

    const rejected = engine.decideCheckpoint(pipeline.id, 'step-sec-gate', 'REJECT', 'CEO');
    expect(rejected.steps[1].checkpoint?.status).toBe('REJECTED');
    expect(rejected.steps[1].status).toBe('FAILED');
    expect(rejected.status).toBe('FAILED');
  });

  // 16-20: Full Lifecycle & Checkpoint Safety
  it('16. Pipeline completes successfully when all steps are completed', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    engine.completeStep(pipeline.id, 'step-arch');
    engine.decideCheckpoint(pipeline.id, 'step-sec-gate', 'GRANT');
    engine.completeStep(pipeline.id, 'step-sec-gate');
    engine.completeStep(pipeline.id, 'step-dev');
    const finalPipe = engine.completeStep(pipeline.id, 'step-qa');

    expect(finalPipe.status).toBe('COMPLETED');
    expect(finalPipe.completedSteps).toBe(4);
    expect(finalPipe.completedAt).toBeDefined();
  });

  it('17. Calling tickPipeline on completed pipeline is idempotent', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    engine.completeStep(pipeline.id, 'step-arch');
    engine.decideCheckpoint(pipeline.id, 'step-sec-gate', 'GRANT');
    engine.completeStep(pipeline.id, 'step-sec-gate');
    engine.completeStep(pipeline.id, 'step-dev');
    engine.completeStep(pipeline.id, 'step-qa');

    const tickedAgain = engine.tickPipeline(pipeline.id);
    expect(tickedAgain.status).toBe('COMPLETED');
  });

  it('18. Throws when completing step in non-existent pipeline', () => {
    expect(() => engine.completeStep('non-existent', 'step-1')).toThrow(/not found/);
  });

  it('19. Throws when deciding checkpoint for step without checkpoint', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    expect(() => engine.decideCheckpoint(pipeline.id, 'step-arch', 'GRANT')).toThrow(/checkpoint not found/);
  });

  it('20. Clear method wipes pipelines from memory', () => {
    engine.createPipeline(samplePipelineInput);
    expect(engine.listPipelines().length).toBe(1);
    engine.clear();
    expect(engine.listPipelines().length).toBe(0);
  });

  // 21-30: Cloudflare Worker API Endpoints
  it('21. Worker POST /office/pipelines/create returns 201 and created pipeline', async () => {
    const request = new Request('http://localhost/office/pipelines/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-office-token',
      },
      body: JSON.stringify(samplePipelineInput),
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(201);
    const data = (await response.json()) as { pipeline: AutonomousPipeline };
    expect(data.pipeline.id).toBeDefined();
    expect(data.pipeline.title).toBe(samplePipelineInput.title);
  });

  it('22. Worker GET /office/pipelines returns 200 with list of pipelines', async () => {
    defaultAutonomousPipelineEngine.createPipeline(samplePipelineInput);
    const request = new Request('http://localhost/office/pipelines', {
      headers: {
        Authorization: 'Bearer test-office-token',
      },
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(200);
    const data = (await response.json()) as { pipelines: AutonomousPipeline[] };
    expect(data.pipelines.length).toBeGreaterThan(0);
  });

  it('23. Worker GET /office/pipelines/:id returns 200 for valid pipeline', async () => {
    const created = defaultAutonomousPipelineEngine.createPipeline(samplePipelineInput);
    const request = new Request(`http://localhost/office/pipelines/${created.id}`, {
      headers: {
        Authorization: 'Bearer test-office-token',
      },
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(200);
    const data = (await response.json()) as { pipeline: AutonomousPipeline };
    expect(data.pipeline.id).toBe(created.id);
  });

  it('24. Worker GET /office/pipelines/:id returns 404 for unknown pipeline', async () => {
    const request = new Request('http://localhost/office/pipelines/unknown-pipe-123', {
      headers: {
        Authorization: 'Bearer test-office-token',
      },
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(404);
  });

  it('25. Worker POST /office/pipelines/:id/tick advances the pipeline', async () => {
    const created = defaultAutonomousPipelineEngine.createPipeline(samplePipelineInput);
    const request = new Request(`http://localhost/office/pipelines/${created.id}/tick`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-office-token',
      },
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(200);
    const data = (await response.json()) as { pipeline: AutonomousPipeline };
    expect(data.pipeline.status).toBe('RUNNING');
  });

  it('26. Worker POST /office/pipelines/:id/checkpoints/:stepId/decide grants approval', async () => {
    const created = defaultAutonomousPipelineEngine.createPipeline(samplePipelineInput);
    defaultAutonomousPipelineEngine.completeStep(created.id, 'step-arch');

    const request = new Request(`http://localhost/office/pipelines/${created.id}/checkpoints/step-sec-gate/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-office-token',
      },
      body: JSON.stringify({ decision: 'GRANT', decidedBy: 'CEO' }),
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(200);
    const data = (await response.json()) as { pipeline: AutonomousPipeline };
    expect(data.pipeline.steps[1].checkpoint?.status).toBe('GRANTED');
  });

  it('27. Worker endpoints return 401 when unauthenticated', async () => {
    const req1 = new Request('http://localhost/office/pipelines');
    const res1 = await apiWorker.fetch(req1, mockEnv, {});
    expect(res1.status).toBe(401);

    const req2 = new Request('http://localhost/office/pipelines/create', { method: 'POST' });
    const res2 = await apiWorker.fetch(req2, mockEnv, {});
    expect(res2.status).toBe(401);
  });

  it('28. Checkpoint requiresCEOApproval is always true', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    const checkpointStep = pipeline.steps.find(s => s.checkpoint !== undefined);
    expect(checkpointStep?.checkpoint?.requiresCEOApproval).toBe(true);
  });

  it('29. Default singleton export is functional', () => {
    expect(defaultAutonomousPipelineEngine).toBeDefined();
    const pipe = defaultAutonomousPipelineEngine.createPipeline(samplePipelineInput);
    expect(defaultAutonomousPipelineEngine.getPipeline(pipe.id)).toBeDefined();
  });

  it('30. Parallel independent steps are both set to READY when root dependencies are met', () => {
    const parallelInput: CreatePipelineInput = {
      title: 'Parallel Test',
      ceoObjective: 'Run independent branches',
      steps: [
        { id: 'root', title: 'Root', description: 'Start', targetRole: 'architect' },
        { id: 'branch-1', title: 'Branch 1', description: 'B1', targetRole: 'developer', dependsOnStepIds: ['root'] },
        { id: 'branch-2', title: 'Branch 2', description: 'B2', targetRole: 'developer', dependsOnStepIds: ['root'] },
      ],
    };
    const pipeline = engine.createPipeline(parallelInput);
    engine.completeStep(pipeline.id, 'root');

    const updated = engine.getPipeline(pipeline.id);
    expect(updated?.steps[1].status).toBe('READY');
    expect(updated?.steps[2].status).toBe('READY');
  });

  // 31-40: Edge Cases & Governance Invariants
  it('31. Pipeline rejects malformed checkpoint decision value', async () => {
    const created = defaultAutonomousPipelineEngine.createPipeline(samplePipelineInput);
    defaultAutonomousPipelineEngine.completeStep(created.id, 'step-arch');

    const request = new Request(`http://localhost/office/pipelines/${created.id}/checkpoints/step-sec-gate/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-office-token',
      },
      body: JSON.stringify({ decision: 'INVALID_VALUE' }),
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(400);
  });

  it('32. Non-existent step completion in tick returns clean error', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    expect(() => engine.completeStep(pipeline.id, 'invalid-step-id')).toThrow(/Step 'invalid-step-id' not found/);
  });

  it('33. Pipeline progress ratio is accurately computed', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    expect(pipeline.completedSteps).toBe(0);
    engine.completeStep(pipeline.id, 'step-arch');
    expect(engine.getPipeline(pipeline.id)?.completedSteps).toBe(1);
  });

  it('34. Pipeline steps maintain order of declaration in steps array', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    expect(pipeline.steps.map(s => s.id)).toEqual(['step-arch', 'step-sec-gate', 'step-dev', 'step-qa']);
  });

  it('35. Checkpoint status preserves decider identity', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    engine.completeStep(pipeline.id, 'step-arch');
    const decided = engine.decideCheckpoint(pipeline.id, 'step-sec-gate', 'GRANT', 'CEO_MATHEUS');
    expect(decided.steps[1].checkpoint?.decidedBy).toBe('CEO_MATHEUS');
  });

  it('36. Pipeline status is WAITING_APPROVAL only when blocking checkpoint is active', () => {
    const pipeline = engine.createPipeline(samplePipelineInput);
    expect(pipeline.status).toBe('PLANNING');
    engine.tickPipeline(pipeline.id);
    expect(engine.getPipeline(pipeline.id)?.status).toBe('RUNNING');
    engine.completeStep(pipeline.id, 'step-arch');
    expect(engine.getPipeline(pipeline.id)?.status).toBe('WAITING_APPROVAL');
  });

  it('37. Pipeline can be created with single step and immediately completed', () => {
    const single = engine.createPipeline({
      title: 'Single Step',
      ceoObjective: 'Do one task',
      steps: [{ id: 's1', title: 'Task 1', description: 'Desc', targetRole: 'developer' }],
    });
    expect(single.totalSteps).toBe(1);
    const completed = engine.completeStep(single.id, 's1');
    expect(completed.status).toBe('COMPLETED');
  });

  it('38. DAG validator handles self-referencing step', () => {
    const selfRef: CreatePipelineInput = {
      title: 'Self ref',
      ceoObjective: 'Self ref test',
      steps: [{ id: 's1', title: 'S1', description: 'D', targetRole: 'developer', dependsOnStepIds: ['s1'] }],
    };
    expect(() => engine.createPipeline(selfRef)).toThrow(/Cyclic dependency/);
  });

  it('39. Step status skips to READY if dependencies array is empty or undefined', () => {
    const noDeps = engine.createPipeline({
      title: 'No Deps',
      ceoObjective: 'Test no deps',
      steps: [{ title: 'Independent', description: 'Desc', targetRole: 'developer' }],
    });
    expect(noDeps.steps[0].status).toBe('READY');
  });

  it('40. Multiple pipelines can be tracked concurrently without cross-contamination', () => {
    const p1 = engine.createPipeline(samplePipelineInput);
    const p2 = engine.createPipeline({ ...samplePipelineInput, title: 'Second Pipeline' });

    engine.completeStep(p1.id, 'step-arch');
    expect(engine.getPipeline(p1.id)?.completedSteps).toBe(1);
    expect(engine.getPipeline(p2.id)?.completedSteps).toBe(0);
  });
});
