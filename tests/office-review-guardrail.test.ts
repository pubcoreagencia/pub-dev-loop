import { describe, it, expect, beforeEach } from 'vitest';
import { OfficeEventBus } from '../src/office/events.js';
import { CodeReviewManager } from '../src/office/review.js';
import { ApprovalManager } from '../src/office/approval.js';

describe('PDL — Phase 7.2: Review Guardrail Hard Block at Max Iterations Suite', () => {
  let bus: OfficeEventBus;
  let reviewManager: CodeReviewManager;
  let approvalManager: ApprovalManager;
  let emittedEvents: any[];

  beforeEach(() => {
    bus = new OfficeEventBus(50);
    reviewManager = new CodeReviewManager(bus);
    approvalManager = new ApprovalManager(bus);
    emittedEvents = [];
    bus.subscribe(undefined, (e) => emittedEvents.push(e));
  });

  it('A-C. iteration 1 FAIL -> correction -> iteration 2 FAIL -> correction -> iteration 3 PASS -> REVIEW_APPROVED permitted', () => {
    const taskId = 'task-happy-3rd-try';

    // Iteration 1: FAIL
    const r1 = reviewManager.evaluateReview({ taskId, testPassed: false });
    expect(r1.status).toBe('CHANGES_REQUESTED');
    expect(r1.iteration).toBe(1);

    // Iteration 2: FAIL
    const r2 = reviewManager.evaluateReview({ taskId, testPassed: false });
    expect(r2.status).toBe('CHANGES_REQUESTED');
    expect(r2.iteration).toBe(2);

    // Iteration 3: PASS
    const r3 = reviewManager.evaluateReview({ taskId, testPassed: true, typecheckPassed: true, buildPassed: true });
    expect(r3.status).toBe('APPROVED');
    expect(r3.iteration).toBe(3);

    expect(emittedEvents.some((e) => e.type === 'REVIEW_APPROVED')).toBe(true);
    expect(emittedEvents.some((e) => e.type === 'REVIEW_BLOCKED')).toBe(false);
  });

  it('D-I. iteration 3 FAIL -> REVIEW_BLOCKED (NO auto-approval, NO auto-granted, preserves findings)', () => {
    const taskId = 'task-blocked-guardrail';

    // Iteration 1: FAIL
    const r1 = reviewManager.evaluateReview({ taskId, testPassed: false });
    expect(r1.status).toBe('CHANGES_REQUESTED');
    expect(r1.iteration).toBe(1);

    // Iteration 2: FAIL
    const r2 = reviewManager.evaluateReview({ taskId, testPassed: false });
    expect(r2.status).toBe('CHANGES_REQUESTED');
    expect(r2.iteration).toBe(2);

    // Iteration 3: FAIL -> HARD BLOCK
    const r3 = reviewManager.evaluateReview({
      taskId,
      testPassed: false,
      findings: [
        {
          ruleId: 'SEC_SQL_INJECTION',
          severity: 'ERROR',
          message: 'Potencial falha de SQL injection detectada no repositório.',
        },
      ],
    });

    // D. status is BLOCKED
    expect(r3.status).toBe('BLOCKED');
    expect(r3.iteration).toBe(3);

    // E. NO REVIEW_APPROVED
    expect(emittedEvents.some((e) => e.type === 'REVIEW_APPROVED')).toBe(false);

    // F. NO APPROVAL_GRANTED automatically
    expect(emittedEvents.some((e) => e.type === 'APPROVAL_GRANTED')).toBe(false);

    // D. REVIEW_BLOCKED emitted
    const blockedEvent = emittedEvents.find((e) => e.type === 'REVIEW_BLOCKED');
    expect(blockedEvent).toBeDefined();
    expect(blockedEvent.actorId).toBe('reviewer');
    expect(blockedEvent.targetId).toBe('developer');
    expect(blockedEvent.payload.requiresEscalation).toBe(true);

    // I. Preserves real context & findings
    expect(r3.findings.some((f) => f.ruleId === 'SEC_SQL_INJECTION')).toBe(true);
  });

  it('J. explicit CEO approval after review escalation works authoritatively', () => {
    const taskId = 'task-escalated-to-ceo';

    // 1. Task reaches max iterations and gets blocked
    reviewManager.evaluateReview({ taskId, testPassed: false });
    reviewManager.evaluateReview({ taskId, testPassed: false });
    const r3 = reviewManager.evaluateReview({ taskId, testPassed: false });
    expect(r3.status).toBe('BLOCKED');

    // 2. Escalation creates formal approval request to CEO
    const approval = approvalManager.requestApproval({
      taskId,
      type: 'SECURITY_OVERRIDE',
      title: 'Decisao sobre tarefa bloqueada por limite de revisao',
      rationale: 'Reviewer bloqueou apos 3 ciclos com falha; CEO precisa decidir',
      requestedBy: 'chief-of-staff',
    });

    expect(approval.status).toBe('PENDING');

    // 3. CEO explicitly grants approval
    const decided = approvalManager.decideApproval(approval.id, 'GRANT', { role: 'CEO', userId: 'user-ceo' }, 'CEO aprovou com override');
    expect(decided.status).toBe('GRANTED');
    expect(decided.decidedBy).toBe('user-ceo');

    expect(emittedEvents.some((e) => e.type === 'APPROVAL_GRANTED')).toBe(true);
  });
});
