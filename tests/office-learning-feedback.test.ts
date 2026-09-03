import { describe, it, expect, beforeEach } from 'vitest';
import {
  LearningFeedbackEngine,
  defaultLearningFeedbackEngine,
  type AgentAction,
} from '../src/office/learning-feedback.js';

describe('PDL — Phase 8.6-D: Governed Agent Learning Feedback Loop Suite', () => {
  let feedbackEngine: LearningFeedbackEngine;
  const tenantId = 'pub-dev-loop';
  const projectId = 'pub-dev-loop';

  beforeEach(() => {
    feedbackEngine = new LearningFeedbackEngine();
  });

  function createAction(role: any, taskId: string, actionType: any = 'EXECUTED_ACTION'): AgentAction {
    return {
      id: `act-${taskId}`,
      role,
      actionType,
      summary: `Executed task ${taskId}`,
      executed: actionType === 'EXECUTED_ACTION',
      provenance: {
        tenantId,
        projectId,
        taskId,
        agentId: role,
      },
    };
  }

  it('1. Successful Execution: Verified success produces SUCCESSFUL_EXECUTION signal', async () => {
    const action = createAction('developer', 'task-succ-1');
    const result = await feedbackEngine.processFeedback({
      action,
      execution: {
        status: 'SUCCESS',
        exitCode: 0,
        changedFiles: ['src/service.ts'],
        durationMs: 1200,
      },
      qa: {
        status: 'PASSED',
        totalTests: 15,
        passedTests: 15,
        failedTests: 0,
        exitCode: 0,
        regressionsDetected: false,
      },
    });

    expect(result.signal).toBe('SUCCESSFUL_EXECUTION');
    expect(result.evaluation.status).toBe('SUCCESS');
    expect(result.evaluation.confidence).toBe('HIGH');
    expect(result.provenance.taskId).toBe('task-succ-1');
  });

  it('2. Failed Execution & ExitCode Non-Zero: Produces FAILED_EXECUTION signal', async () => {
    const action = createAction('developer', 'task-fail-1');
    const result = await feedbackEngine.processFeedback({
      action,
      execution: {
        status: 'FAILURE',
        exitCode: 1,
        stderr: 'Compilation error TS2304: Cannot find name foo.',
      },
    });

    expect(result.signal).toBe('FAILED_EXECUTION');
    expect(result.evaluation.status).toBe('FAILURE');
    expect(result.evaluation.confidence).toBe('HIGH');
  });

  it('3. Review Blocked & MAX_REVIEW_ITERATIONS Guardrail: Produces REVIEW_BLOCKED signal', async () => {
    const action = createAction('reviewer', 'task-rev-block-1');
    const result = await feedbackEngine.processFeedback({
      action,
      review: {
        status: 'BLOCKED',
        iteration: 3,
        findingsCount: 2,
        blockerFindings: ['SQL Injection in user query', 'Hardcoded secret'],
        maxIterationsReached: true,
      },
    });

    expect(result.signal).toBe('REVIEW_BLOCKED');
    expect(result.evaluation.status).toBe('BLOCKED');
    expect(result.evaluation.reason).toContain('limite de iterações atingido');
  });

  it('4. QA Test Failure & Regressions: Produces QA_FAILED or REGRESSION_DETECTED signal', async () => {
    const action = createAction('qa-engineer', 'task-qa-fail-1');
    const result = await feedbackEngine.processFeedback({
      action,
      qa: {
        status: 'FAILED',
        totalTests: 10,
        passedTests: 8,
        failedTests: 2,
        exitCode: 1,
        regressionsDetected: false,
      },
    });

    expect(result.signal).toBe('QA_FAILED');
    expect(result.evaluation.status).toBe('FAILURE');

    // Test with regression detected
    const regResult = await feedbackEngine.processFeedback({
      action: createAction('qa-engineer', 'task-qa-reg-1'),
      qa: {
        status: 'FAILED',
        totalTests: 10,
        passedTests: 9,
        failedTests: 1,
        exitCode: 1,
        regressionsDetected: true,
      },
    });

    expect(regResult.signal).toBe('REGRESSION_DETECTED');
    expect(regResult.evaluation.status).toBe('REGRESSION');
  });

  it('5. Remediation Verified: Prior failure fixed and verified produces REMEDIATION_VERIFIED signal', async () => {
    const action = createAction('developer', 'task-remed-1');
    const result = await feedbackEngine.processFeedback({
      action,
      execution: {
        status: 'SUCCESS',
        exitCode: 0,
      },
      qa: {
        status: 'PASSED',
        totalTests: 20,
        passedTests: 20,
        failedTests: 0,
        exitCode: 0,
        regressionsDetected: false,
      },
      isRemediationOfPriorFailure: true,
      priorFindingRuleId: 'RULE_SQL_INJECTION',
    });

    expect(result.signal).toBe('REMEDIATION_VERIFIED');
    expect(result.evaluation.status).toBe('SUCCESS');
    expect(result.evaluation.reason).toContain('Remediação executada com êxito');
  });

  it('6. Unknown Outcome: Insufficient evidence remains UNKNOWN_OUTCOME', async () => {
    const action = createAction('developer', 'task-unk-1', 'RECOMMENDATION');
    const result = await feedbackEngine.processFeedback({
      action,
    });

    expect(result.signal).toBe('UNKNOWN_OUTCOME');
    expect(result.evaluation.status).toBe('UNKNOWN');
    expect(result.evaluation.confidence).toBe('LOW');
  });

  it('7. Failure Isolation: Feedback engine failure never throws or breaks task pipeline', async () => {
    const brokenPipeline = {
      ingestEvent: async () => {
        throw new Error('REDIS_CONNECTION_RESET');
      },
    } as any;

    const isolatedEngine = new LearningFeedbackEngine(brokenPipeline);
    const action = createAction('developer', 'task-resilient-fb');

    const result = await isolatedEngine.processFeedback({
      action,
      execution: { status: 'SUCCESS', exitCode: 0 },
      qa: { status: 'PASSED', totalTests: 1, passedTests: 1, failedTests: 0, exitCode: 0, regressionsDetected: false },
    });

    expect(result.signal).toBe('SUCCESSFUL_EXECUTION');
  });
});
