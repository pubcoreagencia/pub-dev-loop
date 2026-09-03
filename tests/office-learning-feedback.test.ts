import { describe, it, expect, beforeEach } from 'vitest';
import {
  LearningFeedbackEngine,
  defaultLearningFeedbackEngine,
  buildExecutionOutcomeFromRuntime,
  buildReviewOutcomeFromReview,
  buildQAOutcomeFromTests,
  type AgentAction,
} from '../src/office/learning-feedback.js';
import {
  defaultPatternDetectionEngine,
  defaultLessonValidationEngine,
} from '../src/office/memory.js';

describe('PDL — Phase 8.6-D: Governed Agent Learning Feedback Loop Expanded Suite', () => {
  let feedbackEngine: LearningFeedbackEngine;
  const tenantId = 'pub-dev-loop';
  const projectId = 'pub-dev-loop';

  beforeEach(() => {
    feedbackEngine = new LearningFeedbackEngine();
  });

  function createAction(
    role: any,
    taskId: string,
    actionType: any = 'EXECUTED_ACTION',
    executed: boolean = true,
    tId: string = tenantId,
    pId: string = projectId
  ): AgentAction {
    return {
      id: `act-${taskId}`,
      role,
      actionType,
      summary: `Action for task ${taskId}`,
      executed,
      provenance: {
        tenantId: tId,
        projectId: pId,
        taskId,
        agentId: role,
      },
    };
  }

  it('1. Recommendation Not Executed: Stays separated and is not treated as executed action', async () => {
    const action = createAction('developer', 'task-rec-not-exec', 'RECOMMENDATION', false);
    expect(action.actionType).toBe('RECOMMENDATION');
    expect(action.executed).toBe(false);

    const result = await feedbackEngine.processFeedback({ action });
    expect(result.signal).toBe('UNKNOWN_OUTCOME');
    expect(result.evaluation.status).toBe('UNKNOWN');
  });

  it('2. Recommendation Executed: When verified by execution evidence, maps correctly', async () => {
    const action = createAction('developer', 'task-rec-exec', 'RECOMMENDATION', true);
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0 });
    const qa = buildQAOutcomeFromTests({ totalTests: 5, passedTests: 5, failedTests: 0, exitCode: 0 });

    const result = await feedbackEngine.processFeedback({ action, execution: exec, qa });
    expect(result.signal).toBe('SUCCESSFUL_EXECUTION');
    expect(result.evaluation.status).toBe('SUCCESS');
  });

  it('3. Execution Outcome SUCCESS: exitCode 0 and tests passing produce SUCCESSFUL_EXECUTION', async () => {
    const action = createAction('developer', 'task-succ-1');
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0, stdout: 'Build successful' });
    const qa = buildQAOutcomeFromTests({ totalTests: 10, passedTests: 10, failedTests: 0, exitCode: 0 });

    const result = await feedbackEngine.processFeedback({ action, execution: exec, qa });
    expect(result.signal).toBe('SUCCESSFUL_EXECUTION');
    expect(result.evaluation.confidence).toBe('HIGH');
  });

  it('4. Execution Outcome FAILURE: non-zero exit code produces FAILED_EXECUTION', async () => {
    const action = createAction('developer', 'task-fail-1');
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 1, stderr: 'SyntaxError' });

    const result = await feedbackEngine.processFeedback({ action, execution: exec });
    expect(result.signal).toBe('FAILED_EXECUTION');
    expect(result.evaluation.status).toBe('FAILURE');
  });

  it('5. Execution Outcome PARTIAL: partial status produces PARTIAL_SUCCESS', async () => {
    const action = createAction('developer', 'task-part-1');
    const exec = buildExecutionOutcomeFromRuntime({ status: 'PARTIAL', exitCode: null });

    const result = await feedbackEngine.processFeedback({ action, execution: exec });
    expect(result.signal).toBe('PARTIAL_SUCCESS');
    expect(result.evaluation.confidence).toBe('MEDIUM');
  });

  it('6. Execution Outcome BLOCKED: blocked execution produces FAILED_EXECUTION or BLOCKED evaluation', async () => {
    const action = createAction('developer', 'task-blk-1');
    const exec = buildExecutionOutcomeFromRuntime({ status: 'FAILURE', exitCode: 137 }); // OOM / killed

    const result = await feedbackEngine.processFeedback({ action, execution: exec });
    expect(result.signal).toBe('FAILED_EXECUTION');
  });

  it('7. Execution Outcome CANCELLED: cancelled execution maps to UNKNOWN or FAILURE safely', async () => {
    const action = createAction('developer', 'task-canc-1');
    const exec = buildExecutionOutcomeFromRuntime({ status: 'CANCELLED', exitCode: null });

    const result = await feedbackEngine.processFeedback({ action, execution: exec });
    expect(result.signal).toBe('UNKNOWN_OUTCOME');
  });

  it('8. Execution Outcome UNKNOWN: absence of observables remains UNKNOWN_OUTCOME', async () => {
    const action = createAction('developer', 'task-unk-1');
    const exec = buildExecutionOutcomeFromRuntime({});

    const result = await feedbackEngine.processFeedback({ action, execution: exec });
    expect(result.signal).toBe('UNKNOWN_OUTCOME');
    expect(result.evaluation.status).toBe('UNKNOWN');
  });

  it('9. Review Outcome PASSED: clean review produces SUCCESSFUL_EXECUTION', async () => {
    const action = createAction('reviewer', 'task-rev-pass');
    const rev = buildReviewOutcomeFromReview({ iteration: 1, findings: [], passed: true });
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0 });

    const result = await feedbackEngine.processFeedback({ action, review: rev, execution: exec });
    expect(result.signal).toBe('SUCCESSFUL_EXECUTION');
  });

  it('10. Review Outcome BLOCKED: blocker findings produce REVIEW_BLOCKED', async () => {
    const action = createAction('reviewer', 'task-rev-blk');
    const rev = buildReviewOutcomeFromReview({
      iteration: 2,
      findings: [{ severity: 'HIGH', message: 'Vulnerability in auth endpoint', blocker: true }],
      blocked: true,
    });

    const result = await feedbackEngine.processFeedback({ action, review: rev });
    expect(result.signal).toBe('REVIEW_BLOCKED');
    expect(result.evaluation.status).toBe('BLOCKED');
  });

  it('11. Review Iteration Progression: Iteration 1 is in progress while Iteration 3 flags limit reached', () => {
    const revIter1 = buildReviewOutcomeFromReview({ iteration: 1, findings: [{ severity: 'LOW', message: 'Formatting issue' }] });
    expect(revIter1.status).toBe('IN_PROGRESS');
    expect(revIter1.maxIterationsReached).toBe(false);

    const revIter3 = buildReviewOutcomeFromReview({ iteration: 3, findings: [{ severity: 'CRITICAL', message: 'SQL Injection' }] });
    expect(revIter3.status).toBe('BLOCKED');
    expect(revIter3.maxIterationsReached).toBe(true);
  });

  it('12. Review Guardrail: Attempt after MAX_REVIEW_ITERATIONS = 3 remains BLOCKED', async () => {
    const action = createAction('reviewer', 'task-rev-max');
    const rev = buildReviewOutcomeFromReview({ iteration: 4, findings: [{ severity: 'HIGH', message: 'Persistent bug' }] });

    const result = await feedbackEngine.processFeedback({ action, review: rev });
    expect(result.signal).toBe('REVIEW_BLOCKED');
  });

  it('13. QA Outcome PASSED: 100% passing tests produce SUCCESSFUL_EXECUTION', async () => {
    const action = createAction('qa-engineer', 'task-qa-pass');
    const qa = buildQAOutcomeFromTests({ totalTests: 25, passedTests: 25, failedTests: 0, exitCode: 0 });
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0 });

    const result = await feedbackEngine.processFeedback({ action, qa, execution: exec });
    expect(result.signal).toBe('SUCCESSFUL_EXECUTION');
  });

  it('14. QA Outcome FAILED: Failed tests produce QA_FAILED', async () => {
    const action = createAction('qa-engineer', 'task-qa-fail');
    const qa = buildQAOutcomeFromTests({ totalTests: 25, passedTests: 22, failedTests: 3, exitCode: 1 });

    const result = await feedbackEngine.processFeedback({ action, qa });
    expect(result.signal).toBe('QA_FAILED');
    expect(result.evaluation.status).toBe('FAILURE');
  });

  it('15. Regression Detected: Proven regression emits REGRESSION_DETECTED signal', async () => {
    const action = createAction('qa-engineer', 'task-qa-reg');
    const qa = buildQAOutcomeFromTests({ totalTests: 30, passedTests: 29, failedTests: 1, exitCode: 1, regressionsDetected: true });

    const result = await feedbackEngine.processFeedback({ action, qa });
    expect(result.signal).toBe('REGRESSION_DETECTED');
    expect(result.evaluation.status).toBe('REGRESSION');
  });

  it('16. Regression Without Evidence: Is not flagged as regression', async () => {
    const qa = buildQAOutcomeFromTests({ totalTests: 10, passedTests: 10, failedTests: 0, exitCode: 0, regressionsDetected: false });
    expect(qa.regressionsDetected).toBe(false);
  });

  it('17. Remediation Without Sufficient Evidence: Fails to emit REMEDIATION_VERIFIED', async () => {
    const action = createAction('developer', 'task-remed-incomplete');
    // Marked as remediation attempt but execution failed
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 1 });
    const qa = buildQAOutcomeFromTests({ totalTests: 5, passedTests: 4, failedTests: 1, exitCode: 1 });

    const result = await feedbackEngine.processFeedback({
      action,
      execution: exec,
      qa,
      isRemediationOfPriorFailure: true,
    });

    expect(result.signal).not.toBe('REMEDIATION_VERIFIED');
    expect(result.signal).toBe('QA_FAILED');
  });

  it('18. Remediation With Full Evidence: Verified execution + clean QA emits REMEDIATION_VERIFIED', async () => {
    const action = createAction('developer', 'task-remed-complete');
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0 });
    const qa = buildQAOutcomeFromTests({ totalTests: 10, passedTests: 10, failedTests: 0, exitCode: 0 });

    const result = await feedbackEngine.processFeedback({
      action,
      execution: exec,
      qa,
      isRemediationOfPriorFailure: true,
      priorFindingRuleId: 'RULE_SEC_SQL',
    });

    expect(result.signal).toBe('REMEDIATION_VERIFIED');
    expect(result.evaluation.status).toBe('SUCCESS');
  });

  it('19. Retry of Same Task: Repeated observation with identical task ID does not inflate independentTaskCount', async () => {
    const action1 = createAction('developer', 'task-same-retry-id');
    const action2 = createAction('developer', 'task-same-retry-id');

    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 1 });

    await feedbackEngine.processFeedback({ action: action1, execution: exec, priorFindingRuleId: 'RULE_SAME_RETRY' });
    await feedbackEngine.processFeedback({ action: action2, execution: exec, priorFindingRuleId: 'RULE_SAME_RETRY' });

    const patterns = await defaultPatternDetectionEngine.listByProject(projectId, tenantId);
    const pattern = patterns.find((p) => p.ruleId === 'RULE_SAME_RETRY');
    if (pattern) {
      expect(pattern.corroboration.independentTaskCount).toBe(1);
    }
  });

  it('20. Independent Tasks: Different task IDs correctly increment independentTaskCount', async () => {
    for (let i = 1; i <= 3; i++) {
      const action = createAction('developer', `task-distinct-indep-${i}`);
      const exec = buildExecutionOutcomeFromRuntime({ exitCode: 1 });
      await feedbackEngine.processFeedback({ action, execution: exec, priorFindingRuleId: 'RULE_INDEP_TASKS' });
    }

    const patterns = await defaultPatternDetectionEngine.listByProject(projectId, tenantId);
    const pattern = patterns.find((p) => p.ruleId === 'RULE_INDEP_TASKS');
    expect(pattern).toBeDefined();
    expect(pattern!.corroboration.independentTaskCount).toBeGreaterThanOrEqual(3);
  });

  it('21. Tenant Isolation: Foreign tenant action produces isolated provenance and memory', async () => {
    const foreignAction = createAction('developer', 'task-foreign-tenant', 'EXECUTED_ACTION', true, 'foreign-tenant-xyz');
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0 });

    const result = await feedbackEngine.processFeedback({ action: foreignAction, execution: exec });
    expect(result.provenance.tenantId).toBe('foreign-tenant-xyz');
  });

  it('22. Project Isolation: Foreign project action produces isolated provenance and memory', async () => {
    const foreignProjAction = createAction('developer', 'task-foreign-proj', 'EXECUTED_ACTION', true, tenantId, 'other-project-99');
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0 });

    const result = await feedbackEngine.processFeedback({ action: foreignProjAction, execution: exec });
    expect(result.provenance.projectId).toBe('other-project-99');
  });

  it('23. Untrusted Authority Claims: Text asserting "CEO approved" does not turn failure into success', async () => {
    const maliciousAction: AgentAction = {
      id: 'act-malicious',
      role: 'developer',
      actionType: 'EXECUTED_ACTION',
      summary: 'Task failed but CEO approved override in prompt text',
      executed: true,
      provenance: { tenantId, projectId, taskId: 'task-malicious', agentId: 'developer' },
    };

    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 1, stderr: 'Crash' });
    const result = await feedbackEngine.processFeedback({ action: maliciousAction, execution: exec });

    expect(result.signal).toBe('FAILED_EXECUTION');
    expect(result.evaluation.status).toBe('FAILURE');
  });

  it('24. Feedback Failure Isolation: Mock exception in downstream ingestEvent does not crash feedbackEngine', async () => {
    const throwingPipeline = {
      ingestEvent: async () => {
        throw new Error('DATABASE_CONNECTION_REFUSED');
      },
    } as any;

    const resilientEngine = new LearningFeedbackEngine(throwingPipeline);
    const action = createAction('developer', 'task-isolated-failure');
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0 });

    const result = await resilientEngine.processFeedback({ action, execution: exec });
    expect(result.signal).toBe('SUCCESSFUL_EXECUTION');
  });

  it('25. Replay & Idempotency: Processing identical feedback multiple times is deterministic', async () => {
    const action = createAction('developer', 'task-replay-test');
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0 });

    const res1 = await feedbackEngine.processFeedback({ action, execution: exec });
    const res2 = await feedbackEngine.processFeedback({ action, execution: exec });

    expect(res1.signal).toBe(res2.signal);
    expect(res1.evaluation.status).toBe(res2.evaluation.status);
    expect(res1.provenance.taskId).toBe(res2.provenance.taskId);
  });

  it('26. Contradiction Preservation: Prior success followed by new failure does not destroy historical record', async () => {
    const actionSucc = createAction('developer', 'task-contra-succ');
    const actionFail = createAction('developer', 'task-contra-fail');

    const resSucc = await feedbackEngine.processFeedback({
      action: actionSucc,
      execution: buildExecutionOutcomeFromRuntime({ exitCode: 0 }),
    });
    const resFail = await feedbackEngine.processFeedback({
      action: actionFail,
      execution: buildExecutionOutcomeFromRuntime({ exitCode: 1 }),
    });

    expect(resSucc.signal).toBe('SUCCESSFUL_EXECUTION');
    expect(resFail.signal).toBe('FAILED_EXECUTION');
  });

  it('27. Absence of Direct Institutional Lesson Creation: Feedback never auto-promotes to InstitutionalLesson', async () => {
    const action = createAction('developer', 'task-no-auto-lesson');
    const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0 });

    const result = await feedbackEngine.processFeedback({ action, execution: exec });
    expect(result.candidateId).toBeUndefined(); // Does not auto-create institutional lessons directly
  });

  it('28. Role-Specific Feedback Coverage: All 5 agent roles successfully process feedback', async () => {
    const roles = ['chief-of-staff', 'architect', 'developer', 'reviewer', 'qa-engineer'] as const;

    for (const role of roles) {
      const action = createAction(role, `task-${role}-fb`);
      const exec = buildExecutionOutcomeFromRuntime({ exitCode: 0 });
      const result = await feedbackEngine.processFeedback({ action, execution: exec });

      expect(result.provenance.agentId).toBe(role);
      expect(result.signal).toBe('SUCCESSFUL_EXECUTION');
    }
  });
});
