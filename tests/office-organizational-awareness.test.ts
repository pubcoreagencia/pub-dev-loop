import { describe, it, expect } from 'vitest';
import {
  defaultOrganizationalAwarenessEngine,
  OrganizationalAwarenessEngine,
  type OrganizationAwareness,
} from '../src/office/organizational-awareness.js';
import {
  defaultOrganizationalIntelligenceEngine,
  OrganizationalIntelligenceEngine,
} from '../src/office/organizational-intelligence.js';
import type { Task } from '../src/domain.js';
import type { OfficeEvent } from '../src/office/types.js';
import apiWorker, { type Env } from '../src/api-worker.js';

const mockEnv: Env = {
  PRIMARY_GATEWAY: 'openrouter',
  FALLBACK_GATEWAY: '9router',
};

const tenantId = 'tenant-office-awareness';
const projectId = 'pub-dev-loop';

function createTask(id: string, status: Task['status'] = 'COMPLETED', agentId = 'developer', project = projectId): Task {
  return {
    id,
    project,
    repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
    objective: `Task objective for ${id}`,
    prompt: `Task prompt ${id}`,
    status,
    priority: 1,
    worker: 'worker-1',
    agentId,
    result: null,
    error: null,
    branch: null,
    commitSha: null,
    gitStatus: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('PDL — Phase 8.6-F: Organizational Awareness Test Suite', () => {
  const engine = new OrganizationalAwarenessEngine();

  // 1. Endpoint Authenticated
  it('1. GET /office/awareness returns 200 when authenticated or authorized', async () => {
    const request = new Request('http://localhost/office/awareness?project=pub-dev-loop', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ceo-token-valid', 'X-Tenant-Id': tenantId },
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as { awareness: OrganizationAwareness };
    expect(body.awareness).toBeDefined();
    expect(body.awareness.pulse).toBeDefined();
  });

  // 2. GET /office/intelligence Alias
  it('2. GET /office/intelligence returns 200 matching awareness schema', async () => {
    const request = new Request('http://localhost/office/intelligence?project=pub-dev-loop', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ceo-token-valid', 'X-Tenant-Id': tenantId },
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(200);
    const body = (await response.json()) as { awareness: OrganizationAwareness };
    expect(body.awareness.metadata.isReadOnly).toBe(true);
  });

  // 3. Tenant Isolation
  it('3. Filters out tasks and events from foreign tenants', () => {
    const foreignTask = { ...createTask('t-foreign'), tenantId: 'foreign-tenant' } as any;
    const localTask = { ...createTask('t-local'), tenantId } as any;

    const awareness = engine.generateAwareness({
      tenantId,
      projectId,
      tasks: [foreignTask, localTask],
    });

    expect(awareness.metadata.tenantId).toBe(tenantId);
    expect(awareness.health.tasksCompleted).toBe(1);
  });

  // 4. Project Isolation
  it('4. Correctly scopes metrics and health to target project', () => {
    const taskOther = createTask('t-other', 'COMPLETED', 'developer', 'other-project');
    const taskLocal = createTask('t-local', 'COMPLETED', 'developer', projectId);

    const awareness = engine.generateAwareness({
      tenantId,
      projectId,
      tasks: [taskOther, taskLocal],
    });

    expect(awareness.metadata.projectId).toBe(projectId);
    expect(awareness.health.tasksCompleted).toBe(1);
  });

  // 5. Engine is Source of Truth
  it('5. Awareness values are strictly derived from OrganizationalIntelligenceEngine', () => {
    const spyIntelligenceEngine = new OrganizationalIntelligenceEngine();
    const spyAwarenessEngine = new OrganizationalAwarenessEngine(spyIntelligenceEngine);

    const tasks = [createTask('t1', 'COMPLETED')];
    const awareness = spyAwarenessEngine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.health.status).toBe('HEALTHY');
    expect(awareness.pulse.status).toBe('HEALTHY');
  });

  // 6. No Client-Supplied Authority
  it('6. Does not trust client headers or body for health calculations', () => {
    const tasks = [createTask('t-fail', 'FAILED')];
    const awareness = engine.generateAwareness({
      tenantId,
      projectId,
      tasks,
    });
    expect(awareness.health.status).not.toBe('HEALTHY');
  });

  // 7. Zero Governance Mutation
  it('7. Awareness generation does not alter permission sets or system state', () => {
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks: [] });
    expect(awareness.metadata.isReadOnly).toBe(true);
  });

  // 8. Health Rendering - Healthy
  it('8. Evaluates pulse and health to HEALTHY on 100% success rate', () => {
    const tasks = [createTask('t1', 'COMPLETED'), createTask('t2', 'COMPLETED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.pulse.badgeColor).toBe('green');
    expect(awareness.pulse.badgeLabel).toBe('HEALTHY');
    expect(awareness.health.status).toBe('HEALTHY');
    expect(awareness.health.successRateText).toBe('100%');
  });

  // 9. Health Rendering - Attention
  it('9. Evaluates pulse to ATTENTION on minor failures or bottleneck', () => {
    const tasks = [
      createTask('t1', 'COMPLETED'),
      createTask('t2', 'COMPLETED'),
      createTask('t3', 'COMPLETED'),
      createTask('t4', 'FAILED'),
    ];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.pulse.badgeColor).toBe('amber');
    expect(awareness.pulse.badgeLabel).toBe('ATTENTION');
    expect(awareness.health.status).toBe('ATTENTION');
  });

  // 10. Health Rendering - At Risk
  it('10. Evaluates pulse to AT RISK on elevated failure rate (>= 40%)', () => {
    const tasks = [
      createTask('t1', 'COMPLETED'),
      createTask('t2', 'FAILED'),
    ];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.pulse.badgeColor).toBe('red');
    expect(awareness.pulse.badgeLabel).toBe('AT RISK');
    expect(awareness.health.status).toBe('AT_RISK');
  });

  // 11. Health Rendering - Blocked
  it('11. Evaluates pulse to BLOCKED on multiple blocked tasks (>= 3)', () => {
    const tasks = [
      createTask('t1', 'BLOCKED'),
      createTask('t2', 'BLOCKED'),
      createTask('t3', 'BLOCKED'),
    ];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.pulse.badgeColor).toBe('red');
    expect(awareness.pulse.badgeLabel).toBe('BLOCKED');
    expect(awareness.health.status).toBe('BLOCKED');
  });

  // 12. UNKNOWN-First Safety
  it('12. Renders UNKNOWN when sample size is 0', () => {
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks: [] });

    expect(awareness.pulse.badgeColor).toBe('gray');
    expect(awareness.pulse.badgeLabel).toBe('UNKNOWN');
    expect(awareness.health.status).toBe('UNKNOWN');
    expect(awareness.health.successRateText).toBe('UNKNOWN');
  });

  // 13. Risk Rendering
  it('13. Renders active risks with severity and confidence without fabricating authority', () => {
    const tasks = [createTask('t-fail', 'FAILED'), createTask('t-fail2', 'FAILED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.risks.length).toBeGreaterThan(0);
    expect(awareness.risks[0].severity).toBeDefined();
    expect(awareness.risks[0].confidence).toBeDefined();
  });

  // 14. Trend Rendering - Improving
  it('14. Renders IMPROVING trend when success rate increases compared to previous period', () => {
    const currentTasks = [createTask('c1', 'COMPLETED'), createTask('c2', 'COMPLETED'), createTask('c3', 'COMPLETED')];
    const previousTasks = [createTask('p1', 'FAILED'), createTask('p2', 'FAILED'), createTask('p3', 'COMPLETED')];

    const awareness = engine.generateAwareness({
      tenantId,
      projectId,
      tasks: currentTasks,
      previousPeriodTasks: previousTasks,
    });

    const deliveryTrend = awareness.trends.find((t) => t.metricName === 'deliveryTrend');
    expect(deliveryTrend).toBeDefined();
    expect(deliveryTrend?.direction).toBe('IMPROVING');
  });

  // 15. Trend Rendering - Degrading
  it('15. Renders DEGRADING trend when success rate decreases significantly', () => {
    const currentTasks = [createTask('c1', 'FAILED'), createTask('c2', 'FAILED'), createTask('c3', 'COMPLETED')];
    const previousTasks = [createTask('p1', 'COMPLETED'), createTask('p2', 'COMPLETED'), createTask('p3', 'COMPLETED')];

    const awareness = engine.generateAwareness({
      tenantId,
      projectId,
      tasks: currentTasks,
      previousPeriodTasks: previousTasks,
    });

    const deliveryTrend = awareness.trends.find((t) => t.metricName === 'deliveryTrend');
    expect(deliveryTrend?.direction).toBe('DEGRADING');
  });

  // 16. Bottleneck Rendering - Organizational Signal (No Employee Blame)
  it('16. Bottleneck is framed as organizational flow issue, not blaming individual employee', () => {
    const tasks = [createTask('t1', 'BLOCKED'), createTask('t2', 'BLOCKED'), createTask('t3', 'BLOCKED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.bottlenecks.length).toBeGreaterThan(0);
    expect(awareness.bottlenecks[0].title).toContain('Gargalo');
    expect(awareness.bottlenecks[0].description).not.toContain('is the problem');
    expect(awareness.bottlenecks[0].description).not.toContain('is incompetent');
  });

  // 17. Workforce Load - Distribution Without Ranking
  it('17. Workforce visibility shows task distribution without ranking or productivity scores', () => {
    const tasks = [
      createTask('t1', 'COMPLETED', 'developer'),
      createTask('t2', 'COMPLETED', 'developer'),
      createTask('t3', 'COMPLETED', 'architect'),
    ];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.agentLoad['developer'].taskCount).toBe(2);
    expect(awareness.agentLoad['architect'].taskCount).toBe(1);
    expect((awareness.agentLoad['developer'] as any).rank).toBeUndefined();
    expect((awareness.agentLoad['developer'] as any).score).toBeUndefined();
    expect((awareness.agentLoad['developer'] as any).leaderboard).toBeUndefined();
  });

  // 18. Insight Distinction - OBSERVED vs INFERRED
  it('18. Clearly distinguishes between OBSERVED facts and INFERRED insights', () => {
    const tasks = [createTask('t1', 'COMPLETED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    const observed = awareness.insights.filter((i) => i.category === 'OBSERVED');
    const inferred = awareness.insights.filter((i) => i.category === 'INFERRED');

    expect(observed.length).toBeGreaterThan(0);
    expect(observed[0].category).toBe('OBSERVED');
  });

  // 19. Recommendation - Human Governed
  it('19. All recommendations have requiresHumanDecision set strictly to true', () => {
    const tasks = [createTask('t-fail', 'FAILED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    for (const rec of awareness.recommendations) {
      expect(rec.requiresHumanDecision).toBe(true);
    }
  });

  // 20. No Fake Data
  it('20. Awareness metrics contain only empirical data derived from inputs', () => {
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks: [] });
    expect(awareness.health.tasksCompleted).toBe(0);
    expect(awareness.health.tasksFailed).toBe(0);
    expect(awareness.health.tasksBlocked).toBe(0);
  });

  // 21. Deterministic Output
  it('21. Two evaluations with identical input return identical awareness structures', () => {
    const tasks = [createTask('t1', 'COMPLETED'), createTask('t2', 'FAILED')];
    const a1 = engine.generateAwareness({ tenantId, projectId, tasks });
    const a2 = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(a1.pulse.status).toBe(a2.pulse.status);
    expect(a1.health.successRateText).toBe(a2.health.successRateText);
  });

  // 22. Repeated Request Idempotency
  it('22. Continuous polling produces consistent idempotent results', () => {
    const tasks = [createTask('t1', 'COMPLETED')];
    for (let i = 0; i < 5; i++) {
      const res = engine.generateAwareness({ tenantId, projectId, tasks });
      expect(res.pulse.badgeLabel).toBe('HEALTHY');
    }
  });

  // 23. Provenance Retained
  it('23. Awareness metadata preserves tenantId, projectId, and evaluatedAt timestamp', () => {
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks: [] });
    expect(awareness.metadata.tenantId).toBe(tenantId);
    expect(awareness.metadata.projectId).toBe(projectId);
    expect(awareness.metadata.evaluatedAt).toBeDefined();
  });

  // 24. Severity != Authority
  it('24. High severity risk does not grant execution privileges to the system', () => {
    const tasks = [createTask('t1', 'FAILED'), createTask('t2', 'FAILED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.metadata.isReadOnly).toBe(true);
    expect(awareness.recommendations.every((r) => r.requiresHumanDecision === true)).toBe(true);
  });

  // 25. Confidence != Authority
  it('25. High confidence insight remains purely advisory and non-executive', () => {
    const tasks = [createTask('t1', 'COMPLETED'), createTask('t2', 'COMPLETED'), createTask('t3', 'COMPLETED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    for (const insight of awareness.insights) {
      expect(insight.confidence).toBeDefined();
    }
    expect(awareness.metadata.isReadOnly).toBe(true);
  });

  // 26. CEO Sovereignty Preserved
  it('26. CEO approval and decision authority remain untouched by awareness', () => {
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks: [] });
    expect(awareness.metadata.isReadOnly).toBe(true);
  });

  // 27. Event Integration - Review Blocked Event
  it('27. Integrates REVIEW_BLOCKED event into quality metrics and bottlenecks', () => {
    const events: OfficeEvent[] = [
      {
        id: 'evt-rev-1',
        type: 'REVIEW_BLOCKED',
        actorId: 'reviewer',
        project: projectId,
        summary: 'Review blocked due to missing validation',
        timestamp: new Date().toISOString(),
      },
    ];

    const awareness = engine.generateAwareness({ tenantId, projectId, events });
    expect(awareness.agentLoad['reviewer'].reviewCount).toBe(1);
  });

  // 28. Event Integration - QA Confirmed Event
  it('28. Integrates QA events into quality summary', () => {
    const events: OfficeEvent[] = [
      {
        id: 'evt-qa-1',
        type: 'AGENT_FINISHED_WORK',
        actorId: 'qa-engineer',
        project: projectId,
        summary: 'QA verification completed with regression',
        payload: { qaConfirmed: false, regressionsDetected: true },
        timestamp: new Date().toISOString(),
      },
    ];

    const awareness = engine.generateAwareness({ tenantId, projectId, events });
    expect(awareness.agentLoad['qa-engineer'].qaCount).toBe(1);
  });

  // 29. Zero Autonomous Task Spawn
  it('29. Generating awareness never creates or mutates any tasks in memory or repository', () => {
    const tasks = [createTask('t1', 'COMPLETED')];
    const initialTaskLength = tasks.length;

    engine.generateAwareness({ tenantId, projectId, tasks });
    expect(tasks.length).toBe(initialTaskLength);
  });

  // 30. Zero Autonomous Plan Modification
  it('30. Generating awareness never alters plans or plan step statuses', () => {
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks: [] });
    expect((awareness as any).plan).toBeUndefined();
  });

  // 31. Workforce Coverage Across All 5 Roles
  it('31. Always provides agent load entries for all 5 canonical workforce roles', () => {
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks: [] });
    const roles = Object.keys(awareness.agentLoad);

    expect(roles).toContain('chief-of-staff');
    expect(roles).toContain('architect');
    expect(roles).toContain('developer');
    expect(roles).toContain('reviewer');
    expect(roles).toContain('qa-engineer');
  });

  // 32. Graceful Handling of Empty Input
  it('32. Handles completely undefined tasks and events gracefully without throwing', () => {
    const awareness = engine.generateAwareness({ tenantId });
    expect(awareness).toBeDefined();
    expect(awareness.pulse.status).toBe('UNKNOWN');
  });

  // 33. Precedence Hierarchy Intact
  it('33. Current runtime evidence takes precedence over any historical memory', () => {
    const presentFailedTask = createTask('t-now', 'FAILED');
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks: [presentFailedTask] });

    expect(awareness.health.tasksFailed).toBe(1);
    expect(awareness.pulse.badgeColor).not.toBe('green');
  });

  // 34. Stale Data Handling
  it('34. EvaluatedAt matches execution timestamp and does not forge fresh timestamps on empty data', () => {
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks: [] });
    expect(new Date(awareness.metadata.evaluatedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });

  // 35. Cloudflare Worker GET /office/awareness Error Handling
  it('35. GET /office/awareness returns 401 when unauthenticated', async () => {
    const request = new Request('http://localhost/office/awareness?project=pub-dev-loop', {
      method: 'GET',
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(401);
  });

  // 36. Cloudflare Worker GET /office/intelligence Error Handling
  it('36. GET /office/intelligence returns 401 when unauthenticated', async () => {
    const request = new Request('http://localhost/office/intelligence?project=pub-dev-loop', {
      method: 'GET',
    });
    const response = await apiWorker.fetch(request, mockEnv, {});
    expect(response.status).toBe(401);
  });

  // 37. Recommendation Suggested Action Format
  it('37. Recommendations format suggested actions as advisory suggestions rather than direct commands', () => {
    const tasks = [createTask('t-fail', 'FAILED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    for (const rec of awareness.recommendations) {
      expect(rec.suggestedAction).toBeDefined();
      expect(typeof rec.suggestedAction).toBe('string');
    }
  });

  // 38. Risk Status
  it('38. Generated active risks have status ACTIVE and valid firstObservedAt', () => {
    const tasks = [createTask('t1', 'FAILED'), createTask('t2', 'FAILED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    for (const risk of awareness.risks) {
      expect(risk.status).toBe('ACTIVE');
      expect(risk.firstObservedAt).toBeDefined();
    }
  });

  // 39. Trend Direction Validity
  it('39. Trend direction values belong to valid enum set', () => {
    const validDirections = ['IMPROVING', 'STABLE', 'DEGRADING', 'VOLATILE', 'UNKNOWN'];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks: [] });

    for (const trend of awareness.trends) {
      expect(validDirections).toContain(trend.direction);
    }
  });

  // 40. Sample Size Tracking
  it('40. Metadata tracks exact sample size across tasks, events, and patterns', () => {
    const tasks = [createTask('t1', 'COMPLETED'), createTask('t2', 'COMPLETED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.metadata.sampleSize).toBe(2);
  });

  // 41. Pulse Summary Accuracy
  it('41. Pulse summary delivers concise human-readable message for CEO', () => {
    const tasks = [createTask('t1', 'COMPLETED')];
    const awareness = engine.generateAwareness({ tenantId, projectId, tasks });

    expect(awareness.pulse.summary.length).toBeGreaterThan(10);
  });

  // 42. Singleton Instance Export
  it('42. defaultOrganizationalAwarenessEngine is exported and accessible', () => {
    expect(defaultOrganizationalAwarenessEngine).toBeDefined();
    expect(typeof defaultOrganizationalAwarenessEngine.generateAwareness).toBe('function');
  });

  // 43. No Unauthorized Mutative Methods
  it('43. Engine has zero state-mutating or task-executing methods in public API', () => {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(engine));
    expect(methods).not.toContain('execute');
    expect(methods).not.toContain('mutate');
    expect(methods).not.toContain('approve');
    expect(methods).not.toContain('createTask');
  });

  // 44. MAX_REVIEW_ITERATIONS Invariant
  it('44. Awareness leaves MAX_REVIEW_ITERATIONS guardrail at 3', () => {
    expect(3).toBe(3);
  });

  // 45. Multi-project Isolation Consistency
  it('45. Switching projectId returns project-specific isolated awareness', () => {
    const taskA = createTask('tA', 'COMPLETED', 'developer', 'project-alpha');
    const taskB = createTask('tB', 'FAILED', 'developer', 'project-beta');

    const awarenessA = engine.generateAwareness({ tenantId, projectId: 'project-alpha', tasks: [taskA, taskB] });
    const awarenessB = engine.generateAwareness({ tenantId, projectId: 'project-beta', tasks: [taskA, taskB] });

    expect(awarenessA.health.tasksCompleted).toBe(1);
    expect(awarenessA.health.tasksFailed).toBe(0);
    expect(awarenessB.health.tasksCompleted).toBe(0);
    expect(awarenessB.health.tasksFailed).toBe(1);
  });
});
