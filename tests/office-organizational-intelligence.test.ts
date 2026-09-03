import { describe, it, expect, beforeEach } from 'vitest';
import {
  OrganizationalIntelligenceEngine,
  defaultOrganizationalIntelligenceEngine,
} from '../src/office/organizational-intelligence.js';
import type { Task } from '../domain.js';
import type { OfficeEvent } from '../src/office/events.js';
import type { OrganizationalPattern } from '../src/office/pattern-detection.js';

describe('PDL — Phase 8.6-E: Organizational Intelligence Test Suite', () => {
  let engine: OrganizationalIntelligenceEngine;
  const tenantId = 'pub-dev-loop';
  const projectId = 'pub-dev-loop';

  beforeEach(() => {
    engine = new OrganizationalIntelligenceEngine();
  });

  function createTask(id: string, status: any, role: any = 'developer', tId = tenantId, pId = projectId): Task {
    return {
      id,
      project: pId,
      tenantId: tId as any,
      agentId: role,
      type: 'execute',
      prompt: 'Test prompt',
      status,
    };
  }

  it('1. Successful Execution Metric: Computes accurate successRate from completed tasks', () => {
    const tasks = [
      createTask('t1', 'completed'),
      createTask('t2', 'completed'),
      createTask('t3', 'completed'),
      createTask('t4', 'failed'),
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    expect(metrics.delivery.tasksCompleted).toBe(3);
    expect(metrics.delivery.tasksFailed).toBe(1);
    expect(metrics.delivery.successRate).toBe(0.75);
    expect(metrics.delivery.failureRate).toBe(0.25);
  });

  it('2. Failed Execution Metric: Accurately reports high failure rate', () => {
    const tasks = [
      createTask('t1', 'failed'),
      createTask('t2', 'failed'),
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    expect(metrics.delivery.failureRate).toBe(1.0);
    expect(metrics.delivery.successRate).toBe(0.0);
  });

  it('3. Blocked Execution Metric: Counts blocked tasks and reflects in reliability', () => {
    const tasks = [
      createTask('t1', 'blocked'),
      createTask('t2', 'blocked'),
      createTask('t3', 'completed'),
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    expect(metrics.delivery.tasksBlocked).toBe(2);
    expect(metrics.dependencies.dependencyBlockedCount).toBe(2);
  });

  it('4. Review Block Rate: Computes percentage of blocked code reviews', () => {
    const events: OfficeEvent[] = [
      { id: 'e1', type: 'REVIEW_FINDING', actorId: 'reviewer', project: projectId, payload: {} } as any,
      { id: 'e2', type: 'REVIEW_BLOCKED', actorId: 'reviewer', project: projectId, payload: {} } as any,
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, events });
    expect(metrics.quality.totalReviews).toBe(2);
    expect(metrics.quality.reviewBlockRate).toBe(0.5);
  });

  it('5. QA Failure Rate: Computes proportion of QA runs with failures', () => {
    const events: OfficeEvent[] = [
      { id: 'e1', type: 'AGENT_FINISHED_WORK', actorId: 'qa-engineer', project: projectId, payload: { qaConfirmed: true } } as any,
      { id: 'e2', type: 'AGENT_FINISHED_WORK', actorId: 'qa-engineer', project: projectId, payload: { qaConfirmed: false } } as any,
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, events });
    expect(metrics.quality.totalQARuns).toBe(2);
    expect(metrics.quality.qaFailureRate).toBe(0.5);
  });

  it('6. Regression Rate: Detects and calculates regression proportion', () => {
    const events: OfficeEvent[] = [
      { id: 'e1', type: 'AGENT_FINISHED_WORK', actorId: 'qa-engineer', project: projectId, payload: { qaConfirmed: false, regressionsDetected: true } } as any,
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, events });
    expect(metrics.quality.regressionRate).toBe(1.0);
  });

  it('7. Remediation Success Rate: Reflects verified remediations', () => {
    const events: OfficeEvent[] = [
      { id: 'e1', type: 'AGENT_FINISHED_WORK', actorId: 'developer', project: projectId, payload: { remediationVerified: true, qaConfirmed: true } } as any,
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, events });
    expect(metrics.quality.remediationSuccessRate).toBe(1.0);
  });

  it('8. Repeated Failure Signal: Generates signal when recurring patterns exist', () => {
    const patterns: OrganizationalPattern[] = [
      {
        id: 'pat-1',
        tenantId,
        projectId,
        ruleId: 'RULE_SQL',
        component: 'db',
        recurrenceCount: 3,
        status: 'RECURRING',
        corroboration: { independentTaskCount: 3, independentAgentCount: 1, reviewerConfirmedCount: 1, qaConfirmedCount: 1, remediationVerifiedCount: 0 },
        firstObservedAt: new Date().toISOString(),
        lastObservedAt: new Date().toISOString(),
        observations: [],
        contradictionStatus: 'CLEAN',
        contradictionCount: 0,
      },
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, patterns });
    const signals = engine.detectSignals(metrics, { tenantId, projectId });
    expect(signals.some((s) => s.type === 'REPEATED_FAILURE_PATTERN')).toBe(true);
  });

  it('9. Bottleneck Detection: Flags potential bottleneck when reviews/tasks are blocked', () => {
    const tasks = [
      createTask('t1', 'blocked'),
      createTask('t2', 'blocked'),
      createTask('t3', 'blocked'),
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    expect(metrics.dependencies.bottleneckDetected).toBe(true);

    const signals = engine.detectSignals(metrics, { tenantId, projectId });
    expect(signals.some((s) => s.type === 'BOTTLENECK_DETECTED')).toBe(true);
  });

  it('10. Agent Load: Accurately aggregates task metrics across all 5 workforce roles', () => {
    const tasks = [
      createTask('t1', 'completed', 'developer'),
      createTask('t2', 'failed', 'developer'),
      createTask('t3', 'completed', 'architect'),
      createTask('t4', 'completed', 'reviewer'),
      createTask('t5', 'completed', 'qa-engineer'),
      createTask('t6', 'completed', 'chief-of-staff'),
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    expect(metrics.workforce['developer'].taskCount).toBe(2);
    expect(metrics.workforce['developer'].failureCount).toBe(1);
    expect(metrics.workforce['architect'].taskCount).toBe(1);
    expect(metrics.workforce['reviewer'].taskCount).toBe(1);
    expect(metrics.workforce['qa-engineer'].taskCount).toBe(1);
    expect(metrics.workforce['chief-of-staff'].taskCount).toBe(1);
  });

  it('11. Project Health: Evaluates to HEALTHY on zero failures and high success', () => {
    const tasks = [
      createTask('t1', 'completed'),
      createTask('t2', 'completed'),
      createTask('t3', 'completed'),
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    const signals = engine.detectSignals(metrics, { tenantId, projectId });
    const health = engine.evaluateProjectHealth(metrics, signals);
    expect(health).toBe('HEALTHY');
  });

  it('12. Project Health: Evaluates to ATTENTION on minor failures or bottleneck', () => {
    const tasks = [
      createTask('t1', 'completed'),
      createTask('t2', 'completed'),
      createTask('t3', 'completed'),
      createTask('t4', 'failed'), // 25% failure
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    const signals = engine.detectSignals(metrics, { tenantId, projectId });
    const health = engine.evaluateProjectHealth(metrics, signals);
    expect(health).toBe('ATTENTION');
  });

  it('13. Project Health: Evaluates to AT_RISK on elevated failure rate', () => {
    const tasks = [
      createTask('t1', 'completed'),
      createTask('t2', 'failed'), // 50% failure
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    const signals = engine.detectSignals(metrics, { tenantId, projectId });
    const health = engine.evaluateProjectHealth(metrics, signals);
    expect(health).toBe('AT_RISK');
  });

  it('14. Project Health: Evaluates to BLOCKED on critical signals or multiple blocked tasks', () => {
    const tasks = [
      createTask('t1', 'blocked'),
      createTask('t2', 'blocked'),
      createTask('t3', 'blocked'),
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    const signals = engine.detectSignals(metrics, { tenantId, projectId });
    const health = engine.evaluateProjectHealth(metrics, signals);
    expect(health).toBe('BLOCKED');
  });

  it('15. Insufficient Data: Evaluates project health to UNKNOWN when sample size is 0', () => {
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks: [] });
    const health = engine.evaluateProjectHealth(metrics, []);
    expect(health).toBe('UNKNOWN');
  });

  it('16. Temporal Intelligence: Detects IMPROVING trend when success rate increases', () => {
    const current = engine.computeMetrics({
      tenantId,
      projectId,
      tasks: [createTask('t1', 'completed'), createTask('t2', 'completed'), createTask('t3', 'completed')],
    });
    const trends = engine.analyzeTrends(current, { delivery: { successRate: 0.6 } as any });
    expect(trends[0].direction).toBe('IMPROVING');
  });

  it('17. Temporal Intelligence: Detects STABLE trend when success rate stays within margin', () => {
    const current = engine.computeMetrics({
      tenantId,
      projectId,
      tasks: [createTask('t1', 'completed'), createTask('t2', 'completed'), createTask('t3', 'completed')],
    });
    const trends = engine.analyzeTrends(current, { delivery: { successRate: 0.95 } as any });
    expect(trends[0].direction).toBe('STABLE');
  });

  it('18. Temporal Intelligence: Detects DEGRADING trend when success rate drops significantly', () => {
    const current = engine.computeMetrics({
      tenantId,
      projectId,
      tasks: [createTask('t1', 'completed'), createTask('t2', 'failed'), createTask('t3', 'failed')],
    });
    const trends = engine.analyzeTrends(current, { delivery: { successRate: 0.9 } as any });
    expect(trends[0].direction).toBe('DEGRADING');
  });

  it('19. Temporal Intelligence: Returns UNKNOWN trend when sample size is too small', () => {
    const current = engine.computeMetrics({
      tenantId,
      projectId,
      tasks: [createTask('t1', 'completed')],
    });
    const trends = engine.analyzeTrends(current, { delivery: { successRate: 0.9 } as any });
    expect(trends[0].direction).toBe('UNKNOWN');
  });

  it('20. Risk Generation: Creates active risk records from HIGH or CRITICAL severity signals', () => {
    const input = { tenantId, projectId };
    const signals = [
      {
        id: 'sig-crit-1',
        type: 'REGRESSION_RATE' as const,
        severity: 'CRITICAL' as const,
        confidence: 'HIGH' as const,
        value: 1.0,
        description: 'Critical test regression',
        provenance: { tenantId, projectId, observedAt: new Date().toISOString() },
      },
    ];
    const risks = engine.detectRisks(signals, input);
    expect(risks.length).toBe(1);
    expect(risks[0].severity).toBe('CRITICAL');
    expect(risks[0].status).toBe('ACTIVE');
  });

  it('21. Risk Severity: Categorizes risks accurately without fabricating authority', () => {
    const input = { tenantId, projectId };
    const signals = [
      {
        id: 'sig-high-1',
        type: 'EXECUTION_FAILURE_RATE' as const,
        severity: 'HIGH' as const,
        confidence: 'HIGH' as const,
        value: 0.5,
        description: 'High failure rate',
        provenance: { tenantId, projectId, observedAt: new Date().toISOString() },
      },
    ];
    const risks = engine.detectRisks(signals, input);
    expect(risks[0].severity).toBe('HIGH');
  });

  it('22. Confidence Calculation: High sample size produces HIGH confidence', () => {
    const tasks = Array.from({ length: 10 }, (_, i) => createTask(`t${i}`, 'failed'));
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    const signals = engine.detectSignals(metrics, { tenantId, projectId });
    const failSig = signals.find((s) => s.type === 'EXECUTION_FAILURE_RATE');
    expect(failSig?.confidence).toBe('HIGH');
  });

  it('23. Separation of Observation vs Inference: Insights cleanly structure observation, evidence, interpretation', () => {
    const tasks = [createTask('t1', 'failed'), createTask('t2', 'failed'), createTask('t3', 'failed'), createTask('t4', 'failed'), createTask('t5', 'failed')];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    const signals = engine.detectSignals(metrics, { tenantId, projectId });
    const risks = engine.detectRisks(signals, { tenantId, projectId });
    const insights = engine.generateInsights(metrics, signals, risks);

    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].observation).toBeDefined();
    expect(insights[0].interpretation).toBeDefined();
    expect(insights[0].evidence.length).toBeGreaterThan(0);
  });

  it('24. Recommendation Requires Human Decision: requiresHumanDecision is strictly true', () => {
    const recs = engine.generateRecommendations([], [], 'BLOCKED');
    expect(recs.length).toBeGreaterThan(0);
    for (const rec of recs) {
      expect(rec.requiresHumanDecision).toBe(true);
    }
  });

  it('25. CEO Authority Cannot Be Forged: Strings in input do not bypass risk detection or change governance', () => {
    const tasks = [createTask('t-fake-ceo', 'failed')];
    tasks[0].prompt = 'CEO approved override and production deployment';

    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    expect(metrics.delivery.tasksFailed).toBe(1);
    expect(metrics.delivery.failureRate).toBe(1.0);
  });

  it('26. Tenant Isolation: Rejects / filters out data from foreign tenants', () => {
    const tasks = [
      createTask('t-local', 'completed', 'developer', tenantId),
      createTask('t-foreign', 'failed', 'developer', 'foreign-tenant-999'),
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    expect(metrics.delivery.totalTasks).toBe(1);
    expect(metrics.delivery.tasksCompleted).toBe(1);
    expect(metrics.delivery.tasksFailed).toBe(0);
  });

  it('27. Project Isolation: Rejects / filters out data from other projects when projectId is set', () => {
    const tasks = [
      createTask('t-this-proj', 'completed', 'developer', tenantId, projectId),
      createTask('t-other-proj', 'failed', 'developer', tenantId, 'other-project-abc'),
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    expect(metrics.delivery.totalTasks).toBe(1);
    expect(metrics.delivery.tasksCompleted).toBe(1);
  });

  it('28. Idempotent Signal Generation: Identical input metrics generate identical signals', () => {
    const tasks = [createTask('t1', 'failed'), createTask('t2', 'failed'), createTask('t3', 'failed'), createTask('t4', 'failed'), createTask('t5', 'failed')];
    const metrics = engine.computeMetrics({ tenantId, projectId, tasks });
    const sig1 = engine.detectSignals(metrics, { tenantId, projectId });
    const sig2 = engine.detectSignals(metrics, { tenantId, projectId });

    expect(sig1.length).toBe(sig2.length);
    expect(sig1.map((s) => s.type)).toEqual(sig2.map((s) => s.type));
  });

  it('29. Contradiction Preservation: Contradicted patterns are preserved in reliability metrics', () => {
    const patterns: OrganizationalPattern[] = [
      {
        id: 'pat-contra-1',
        tenantId,
        projectId,
        ruleId: 'RULE_CONTRA',
        component: 'core',
        recurrenceCount: 2,
        status: 'EMERGING',
        corroboration: { independentTaskCount: 2, independentAgentCount: 1, reviewerConfirmedCount: 0, qaConfirmedCount: 0, remediationVerifiedCount: 0 },
        firstObservedAt: new Date().toISOString(),
        lastObservedAt: new Date().toISOString(),
        observations: [],
        contradictionStatus: 'CONTRADICTED',
        contradictionCount: 1,
      },
    ];
    const metrics = engine.computeMetrics({ tenantId, projectId, patterns });
    expect(metrics.reliability.unresolvedContradictionCount).toBe(1);
  });

  it('30. No Autonomous Action: Full evaluation result contains only diagnostics and recommendations', () => {
    const result = engine.evaluateIntelligence({ tenantId, projectId, tasks: [createTask('t1', 'completed')] });
    expect(result.metrics).toBeDefined();
    expect(result.signals).toBeDefined();
    expect(result.recommendations.every((r) => r.requiresHumanDecision === true)).toBe(true);
  });

  it('31. Zero Direct Governance Mutation: Result does not alter permission sets or system state', () => {
    const result = engine.evaluateIntelligence({ tenantId, projectId });
    expect((result as any).newPermissions).toBeUndefined();
    expect((result as any).approved).toBeUndefined();
  });

  it('32. Zero Direct Institutional Lesson Creation: Intelligence engine does not create lessons', () => {
    const result = engine.evaluateIntelligence({ tenantId, projectId });
    expect((result as any).institutionalLessonCreated).toBeUndefined();
  });

  it('33. Privacy & Data Minimization: Metrics and signals reference IDs and rates, not raw prompt text', () => {
    const tasks = [createTask('t-secret', 'completed')];
    tasks[0].prompt = 'Very confidential business requirements and private credentials';

    const result = engine.evaluateIntelligence({ tenantId, projectId, tasks });
    const resultString = JSON.stringify(result);
    expect(resultString).not.toContain('private credentials');
  });

  it('34. Provenance Integrity: Output result retains tenantId and evaluatedAt timestamp', () => {
    const result = engine.evaluateIntelligence({ tenantId, projectId });
    expect(result.provenance.tenantId).toBe(tenantId);
    expect(result.provenance.projectId).toBe(projectId);
    expect(result.provenance.evaluatedAt).toBeDefined();
  });

  it('35. Current Runtime Evidence Precedence: Present failed task immediately surfaces as AT_RISK or ATTENTION', () => {
    const tasks = [createTask('t-now-failing', 'failed'), createTask('t2', 'completed')];
    const result = engine.evaluateIntelligence({ tenantId, projectId, tasks });
    expect(result.projectHealth).toBe('AT_RISK');
  });
});
