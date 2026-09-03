import { describe, it, expect, beforeEach } from 'vitest';
import { OfficeEventBus } from '../src/office/events.js';
import { CodeReviewManager, MAX_REVIEW_ITERATIONS } from '../src/office/review.js';
import { ApprovalManager } from '../src/office/approval.js';

describe('P5.8 / Phase 7 — Real Inter-Agent Code Review & CEO Approval Suite', () => {
  let bus: OfficeEventBus;
  let reviewManager: CodeReviewManager;
  let approvalManager: ApprovalManager;

  beforeEach(() => {
    bus = new OfficeEventBus(20);
    reviewManager = new CodeReviewManager(bus);
    approvalManager = new ApprovalManager(bus);
  });

  it('1. emits REVIEW_FINDING and MESSAGE_SENT when real test/build failures exist', () => {
    const events: any[] = [];
    bus.subscribe(undefined, (evt) => events.push(evt));

    const result = reviewManager.evaluateReview({
      taskId: 'task-dev-123',
      developerAgentId: 'developer',
      reviewerAgentId: 'reviewer',
      testPassed: false,
      typecheckPassed: true,
      buildPassed: true,
    });

    expect(result.status).toBe('CHANGES_REQUESTED');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].ruleId).toBe('TEST_SUITE_FAILURE');

    expect(events.some((e) => e.type === 'REVIEW_FINDING')).toBe(true);
    expect(events.some((e) => e.type === 'MESSAGE_SENT' && e.actorId === 'reviewer' && e.targetId === 'developer')).toBe(true);
  });

  it('2. emits REVIEW_APPROVED when tests, typecheck, and build pass cleanly', () => {
    const events: any[] = [];
    bus.subscribe(undefined, (evt) => events.push(evt));

    const result = reviewManager.evaluateReview({
      taskId: 'task-dev-456',
      developerAgentId: 'developer',
      reviewerAgentId: 'reviewer',
      testPassed: true,
      typecheckPassed: true,
      buildPassed: true,
    });

    expect(result.status).toBe('APPROVED');
    expect(result.findings).toHaveLength(0);

    expect(events.some((e) => e.type === 'REVIEW_APPROVED')).toBe(true);
    expect(events.some((e) => e.type === 'MESSAGE_SENT' && e.actorId === 'reviewer' && e.targetId === 'developer')).toBe(true);
  });

  it('3. enforces MAX_REVIEW_ITERATIONS guardrail to prevent infinite review cycles', () => {
    const taskId = 'task-loop-test';

    // Iteration 1: changes requested
    const r1 = reviewManager.evaluateReview({ taskId, testPassed: false });
    expect(r1.status).toBe('CHANGES_REQUESTED');
    expect(r1.iteration).toBe(1);

    // Iteration 2: changes requested
    const r2 = reviewManager.evaluateReview({ taskId, testPassed: false });
    expect(r2.status).toBe('CHANGES_REQUESTED');
    expect(r2.iteration).toBe(2);

    // Iteration 3: changes requested
    const r3 = reviewManager.evaluateReview({ taskId, testPassed: false });
    expect(r3.status).toBe('CHANGES_REQUESTED');
    expect(r3.iteration).toBe(3);

    // Iteration 4: guardrail breaks loop and approves with caveats
    const r4 = reviewManager.evaluateReview({ taskId, testPassed: false });
    expect(r4.status).toBe('APPROVED');
    expect(r4.iteration).toBe(4);
    expect(r4.summary).toContain('limite');
  });

  it('4. emits APPROVAL_REQUESTED to CEO for critical architectural decisions', () => {
    const events: any[] = [];
    bus.subscribe(undefined, (evt) => events.push(evt));

    const approval = approvalManager.requestApproval({
      type: 'CRITICAL_ARCHITECTURE_CHANGE',
      title: 'Migração para Novo Schema de Banco',
      rationale: 'Alteração em tabelas core de produção exige validação executiva.',
      requestedBy: 'chief-of-staff',
    });

    expect(approval.id).toBeDefined();
    expect(approval.status).toBe('PENDING');

    const requestedEvt = events.find((e) => e.type === 'APPROVAL_REQUESTED');
    expect(requestedEvt).toBeDefined();
    expect(requestedEvt.targetId).toBe('ceo');
    expect(requestedEvt.actorId).toBe('chief-of-staff');
  });

  it('5. records CEO decision and emits APPROVAL_GRANTED when approved by CEO', () => {
    const events: any[] = [];
    bus.subscribe(undefined, (evt) => events.push(evt));

    const approval = approvalManager.requestApproval({
      type: 'PRODUCTION_PROMOTION',
      title: 'Deploy em Produção',
      rationale: 'Release v1.2',
      requestedBy: 'architect',
    });

    const decided = approvalManager.decideApproval(approval.id, 'GRANT', 'CEO', 'Aprovado para deploy');
    expect(decided.status).toBe('GRANTED');
    expect(decided.decidedBy).toBe('ceo');

    const grantedEvt = events.find((e) => e.type === 'APPROVAL_GRANTED');
    expect(grantedEvt).toBeDefined();
    expect(grantedEvt.actorId).toBe('ceo');
    expect(grantedEvt.targetId).toBe('architect');
  });

  it('6. records CEO decision and emits APPROVAL_REJECTED when rejected by CEO', () => {
    const events: any[] = [];
    bus.subscribe(undefined, (evt) => events.push(evt));

    const approval = approvalManager.requestApproval({
      type: 'SECURITY_OVERRIDE',
      title: 'Bypass de Autenticação',
      rationale: 'Teste de estresse',
      requestedBy: 'developer',
    });

    const decided = approvalManager.decideApproval(approval.id, 'REJECT', 'CEO', 'Risco inaceitável');
    expect(decided.status).toBe('REJECTED');

    const rejectedEvt = events.find((e) => e.type === 'APPROVAL_REJECTED');
    expect(rejectedEvt).toBeDefined();
    expect(rejectedEvt.actorId).toBe('ceo');
  });

  it('7. rejects non-CEO approval decisions with UNAUTHORIZED', () => {
    const approval = approvalManager.requestApproval({
      type: 'PRODUCTION_PROMOTION',
      title: 'Deploy',
      rationale: 'Test',
      requestedBy: 'developer',
    });

    expect(() => {
      approvalManager.decideApproval(approval.id, 'GRANT', 'DEVELOPER');
    }).toThrow(/UNAUTHORIZED/);
  });
});
