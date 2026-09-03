import { describe, it, expect, beforeEach } from 'vitest';
import { OfficeEventBus } from '../src/office/events.js';
import { createOrganizationalPlan } from '../src/office/planning.js';
import { CodeReviewManager, extractReviewContextFromTask } from '../src/office/review.js';
import { ApprovalManager } from '../src/office/approval.js';

describe('P5.8 / Phase 7.1 — Full Organizational E2E Lifecycle Validation', () => {
  let bus: OfficeEventBus;
  let reviewManager: CodeReviewManager;
  let approvalManager: ApprovalManager;
  let capturedEvents: any[];

  beforeEach(() => {
    bus = new OfficeEventBus(100);
    reviewManager = new CodeReviewManager(bus);
    approvalManager = new ApprovalManager(bus);
    capturedEvents = [];
    bus.subscribe(undefined, (evt) => capturedEvents.push(evt));
  });

  it('1. executes the entire organizational lifecycle with finding, correction, and approval', async () => {
    const project = 'pub-dev-loop';

    // 1. CEO submits objective
    bus.publish({
      type: 'OBJECTIVE_SUBMITTED',
      actorId: 'ceo',
      targetId: 'chief-of-staff',
      project,
      summary: 'Implementar fluxo de checkout seguro',
      payload: { objective: 'Implementar fluxo de checkout seguro' },
    });

    // 2. Meeting starts
    bus.publish({
      type: 'MEETING_STARTED',
      actorId: 'ceo',
      targetId: 'chief-of-staff',
      project,
      summary: 'Alinhamento de Planejamento Estratégico',
      payload: { participants: ['ceo', 'chief-of-staff'] },
    });

    // 3. Chief of Staff plans 4 stages
    const plan = createOrganizationalPlan('Implementar fluxo de checkout seguro', { defaultProject: project });
    expect(plan.steps).toHaveLength(4);

    bus.publish({
      type: 'PLAN_FORMULATED',
      actorId: 'chief-of-staff',
      targetId: 'ceo',
      project,
      planId: plan.id,
      summary: `Plano organizacional com ${plan.steps.length} etapas formulado.`,
      payload: { stepCount: plan.steps.length },
    });

    bus.publish({
      type: 'MEETING_ENDED',
      actorId: 'chief-of-staff',
      targetId: 'ceo',
      project,
      planId: plan.id,
      summary: 'Encerramento da Reunião de Alinhamento',
    });

    // 4. Step 2 (Developer) is executed
    const devStep = plan.steps[1];
    expect(devStep.agentId).toBe('developer');

    bus.publish({
      type: 'STEP_DELEGATED',
      actorId: 'chief-of-staff',
      targetId: 'developer',
      project,
      planId: plan.id,
      stepId: devStep.id,
      summary: `Etapa '${devStep.id}' delegada a DEVELOPER`,
    });

    bus.publish({
      type: 'AGENT_STARTED_WORK',
      actorId: 'developer',
      project,
      planId: plan.id,
      summary: 'Iniciou desenvolvimento do checkout',
    });

    // Simulate developer delivery with failing test suite
    const devTaskInitial = {
      id: 'task-dev-checkout-01',
      agentId: 'developer',
      project,
      status: 'FAILED',
      result: {
        stdout: 'Running test suite...\\nTests: 3 passed, 1 failed',
        stderr: 'FAIL tests/checkout.test.ts: Payment validation failed',
        exitCode: 1,
      },
    };

    // 5. Code Reviewer evaluates real context
    const reviewContext1 = extractReviewContextFromTask(devTaskInitial, { planId: plan.id });
    expect(reviewContext1.testPassed).toBe(false);

    const reviewResult1 = reviewManager.evaluateReview(reviewContext1);
    expect(reviewResult1.status).toBe('CHANGES_REQUESTED');
    expect(reviewResult1.iteration).toBe(1);
    expect(reviewResult1.findings).toHaveLength(2);
    expect(reviewResult1.findings.some((f) => f.ruleId === 'TEST_SUITE_FAILURE')).toBe(true);
    expect(reviewResult1.findings.some((f) => f.ruleId === 'BUILD_FAILURE')).toBe(true);

    // Confirm finding event and direct communication
    expect(capturedEvents.some((e) => e.type === 'REVIEW_FINDING' && e.actorId === 'reviewer' && e.targetId === 'developer')).toBe(true);
    expect(capturedEvents.some((e) => e.type === 'MESSAGE_SENT' && e.actorId === 'reviewer' && e.targetId === 'developer')).toBe(true);

    // 6. Developer applies correction and re-executes
    bus.publish({
      type: 'AGENT_RESPONDED',
      actorId: 'developer',
      targetId: 'reviewer',
      project,
      summary: 'Corrigida a validação de pagamento. Testes atualizados.',
    });

    const devTaskFixed = {
      id: 'task-dev-checkout-01',
      agentId: 'developer',
      project,
      status: 'COMPLETED',
      result: {
        stdout: 'Running test suite...\\nTests: 4 passed, 0 failed\\n✓ All tests passing!',
        stderr: '',
        exitCode: 0,
      },
    };

    // 7. Reviewer re-evaluates
    const reviewContext2 = extractReviewContextFromTask(devTaskFixed, { planId: plan.id });
    expect(reviewContext2.testPassed).toBe(true);
    expect(reviewContext2.typecheckPassed).toBe(true);
    expect(reviewContext2.buildPassed).toBe(true);

    const reviewResult2 = reviewManager.evaluateReview(reviewContext2);
    expect(reviewResult2.status).toBe('APPROVED');
    expect(reviewResult2.iteration).toBe(2);

    expect(capturedEvents.some((e) => e.type === 'REVIEW_APPROVED')).toBe(true);

    // 8. Critical decision requires CEO approval
    const approval = approvalManager.requestApproval({
      planId: plan.id,
      taskId: devTaskFixed.id,
      project,
      type: 'CRITICAL_ARCHITECTURE_CHANGE',
      title: 'Aprovação de Gateway de Pagamento',
      rationale: 'Integração de pagamento em produção requer confirmação do CEO.',
      requestedBy: 'architect',
    });

    expect(approval.status).toBe('PENDING');
    expect(capturedEvents.some((e) => e.type === 'APPROVAL_REQUESTED')).toBe(true);

    // 9. CEO Grants Approval
    const decided = approvalManager.decideApproval(approval.id, 'GRANT', 'CEO', 'Aprovado pelo CEO');
    expect(decided.status).toBe('GRANTED');
    expect(capturedEvents.some((e) => e.type === 'APPROVAL_GRANTED')).toBe(true);

    // 10. Verify strictly monotonic event sequence
    for (let i = 0; i < capturedEvents.length; i++) {
      expect(capturedEvents[i].sequence).toBe(i + 1);
    }
  });

  it('2. confirms project isolation across multi-tenant events', () => {
    const projAEvents: any[] = [];
    const projBEvents: any[] = [];

    bus.subscribe({ project: 'project-a' }, (e) => projAEvents.push(e));
    bus.subscribe({ project: 'project-b' }, (e) => projBEvents.push(e));

    reviewManager.evaluateReview({
      taskId: 'task-a',
      project: 'project-a',
      testPassed: true,
    });

    reviewManager.evaluateReview({
      taskId: 'task-b',
      project: 'project-b',
      testPassed: false,
    });

    expect(projAEvents).toHaveLength(2); // REVIEW_APPROVED + MESSAGE_SENT
    expect(projBEvents).toHaveLength(2); // REVIEW_FINDING + MESSAGE_SENT

    expect(projAEvents.every((e) => e.project === 'project-a')).toBe(true);
    expect(projBEvents.every((e) => e.project === 'project-b')).toBe(true);
  });
});
