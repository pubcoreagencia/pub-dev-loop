import type { OfficeAgentRole } from './context-assembly.js';
import {
  defaultMemoryIngestPipeline,
  defaultPatternDetectionEngine,
  defaultLessonCandidateEngine,
  type MemoryIngestPipeline,
  type PatternDetectionEngine,
  type LessonCandidateEngine,
} from './memory.js';

export type ActionExecutionType = 'RECOMMENDATION' | 'EXECUTED_ACTION';

export interface AgentAction {
  id: string;
  role: OfficeAgentRole;
  actionType: ActionExecutionType;
  summary: string;
  executed: boolean;
  decisionContextId?: string;
  provenance: {
    tenantId: string;
    projectId: string;
    taskId: string;
    agentId?: string;
  };
}

export type ExecutionStatus =
  | 'SUCCESS'
  | 'FAILURE'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface ExecutionOutcome {
  status: ExecutionStatus;
  exitCode: number | null;
  stdout?: string;
  stderr?: string;
  changedFiles?: string[];
  durationMs?: number;
}

export type ReviewStatus = 'PASSED' | 'BLOCKED' | 'IN_PROGRESS' | 'NOT_REQUESTED';

export interface ReviewOutcome {
  status: ReviewStatus;
  iteration: number;
  findingsCount: number;
  blockerFindings: string[];
  maxIterationsReached: boolean;
}

export type QAStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'NOT_RUN';

export interface QAOutcome {
  status: QAStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  exitCode: number | null;
  regressionsDetected: boolean;
}

export type EvaluationConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface OutcomeEvaluation {
  status: 'SUCCESS' | 'FAILURE' | 'REGRESSION' | 'BLOCKED' | 'UNKNOWN';
  reason: string;
  confidence: EvaluationConfidence;
  evaluatedAt: string;
}

export type LearningFeedbackSignal =
  | 'SUCCESSFUL_EXECUTION'
  | 'FAILED_EXECUTION'
  | 'REVIEW_BLOCKED'
  | 'QA_FAILED'
  | 'QA_PASSED'
  | 'REGRESSION_DETECTED'
  | 'REMEDIATION_VERIFIED'
  | 'REPEATED_FAILURE'
  | 'PARTIAL_SUCCESS'
  | 'UNKNOWN_OUTCOME';

export interface LearningFeedbackInput {
  action: AgentAction;
  execution?: ExecutionOutcome;
  review?: ReviewOutcome;
  qa?: QAOutcome;
  isRemediationOfPriorFailure?: boolean;
  priorFindingRuleId?: string;
}

export interface LearningFeedbackResult {
  signal: LearningFeedbackSignal;
  evaluation: OutcomeEvaluation;
  emittedEventId?: string;
  memoryId?: string;
  patternId?: string;
  candidateId?: string;
  provenance: {
    tenantId: string;
    projectId: string;
    taskId: string;
    agentId: string;
    actionId: string;
  };
}

export class LearningFeedbackEngine {
  constructor(
    private memoryPipeline: MemoryIngestPipeline = defaultMemoryIngestPipeline,
    private patternEngine: PatternDetectionEngine = defaultPatternDetectionEngine,
    private candidateEngine: LessonCandidateEngine = defaultLessonCandidateEngine
  ) {}

  public async processFeedback(input: LearningFeedbackInput): Promise<LearningFeedbackResult> {
    const { action, execution, review, qa, isRemediationOfPriorFailure, priorFindingRuleId } = input;
    const { tenantId, projectId, taskId } = action.provenance;
    const agentId = action.role;
    const evaluatedAt = new Date().toISOString();

    // 1. EVALUATE OUTCOME DETERMINISTICALLY
    let signal: LearningFeedbackSignal = 'UNKNOWN_OUTCOME';
    let evalStatus: OutcomeEvaluation['status'] = 'UNKNOWN';
    let reason = 'Evidência insuficiente para determinar resultado';
    let confidence: EvaluationConfidence = 'LOW';

    // Priority 1: Review Blocked (Guardrail MAX_REVIEW_ITERATIONS = 3)
    if (review?.status === 'BLOCKED' || review?.maxIterationsReached) {
      signal = 'REVIEW_BLOCKED';
      evalStatus = 'BLOCKED';
      reason = 'Revisão bloqueada: limite de iterações atingido com inconformidades pendentes';
      confidence = 'HIGH';
    }
    // Priority 2: Regression Detected
    else if (qa?.regressionsDetected) {
      signal = 'REGRESSION_DETECTED';
      evalStatus = 'REGRESSION';
      reason = 'Regressão comprovada por falha em suíte de testes previamente validada';
      confidence = 'HIGH';
    }
    // Priority 3: QA Test Failure
    else if (qa?.status === 'FAILED' || (qa && qa.failedTests > 0)) {
      signal = 'QA_FAILED';
      evalStatus = 'FAILURE';
      reason = `Falha em validação de testes de QA (${qa.failedTests} testes falharam)`;
      confidence = 'HIGH';
    }
    // Priority 4: Execution Failure
    else if (execution?.status === 'FAILURE' || (execution?.exitCode !== null && execution?.exitCode !== undefined && execution.exitCode !== 0)) {
      signal = 'FAILED_EXECUTION';
      evalStatus = 'FAILURE';
      reason = `Falha na execução técnica do runtime (exitCode ${execution.exitCode})`;
      confidence = 'HIGH';
    }
    // Priority 5: Remediation Verified
    else if (isRemediationOfPriorFailure && execution?.status === 'SUCCESS' && qa?.status === 'PASSED') {
      signal = 'REMEDIATION_VERIFIED';
      evalStatus = 'SUCCESS';
      reason = 'Remediação executada com êxito e confirmada por testes de QA';
      confidence = 'HIGH';
    }
    // Priority 6: Execution Success
    else if (execution?.status === 'SUCCESS') {
      signal = 'SUCCESSFUL_EXECUTION';
      evalStatus = 'SUCCESS';
      reason = 'Execução concluída com êxito e confirmada por evidência do runtime';
      confidence = qa?.status === 'PASSED' || review?.status === 'PASSED' ? 'HIGH' : 'MEDIUM';
    }
    // Priority 7: Partial Success
    else if (execution?.status === 'PARTIAL') {
      signal = 'PARTIAL_SUCCESS';
      evalStatus = 'UNKNOWN';
      reason = 'Execução parcialmente concluída';
      confidence = 'MEDIUM';
    }

    const evaluation: OutcomeEvaluation = {
      status: evalStatus,
      reason,
      confidence,
      evaluatedAt,
    };

    let emittedEventId: string | undefined;
    let memoryId: string | undefined;
    let patternId: string | undefined;
    let candidateId: string | undefined;

    // 2. DISPATCH OBSERVATION TO EXISTING MEMORY & PATTERN PIPELINE (Failure Isolated)
    try {
      if (signal === 'REVIEW_BLOCKED') {
        const evt = await this.memoryPipeline.ingestEvent({
          id: `evt-fb-rev-blk-${taskId}`,
          type: 'REVIEW_BLOCKED',
          actorId: agentId,
          project: projectId,
          taskId,
          summary: reason,
          payload: {
            blockerFindings: review?.blockerFindings,
            iteration: review?.iteration,
            maxIterations: 3,
            ruleId: priorFindingRuleId || 'RULE_REVIEW_BLOCKED',
          },
          timestamp: evaluatedAt,
        } as any);
        if (evt) {
          emittedEventId = evt.id;
          memoryId = evt.id;
        }
      } else if (signal === 'FAILED_EXECUTION' || signal === 'QA_FAILED' || signal === 'REGRESSION_DETECTED') {
        const evt = await this.memoryPipeline.ingestEvent({
          id: `evt-fb-fail-${taskId}`,
          type: 'REVIEW_FINDING',
          actorId: agentId,
          project: projectId,
          taskId,
          summary: reason,
          payload: {
            findingText: reason,
            ruleId: priorFindingRuleId || 'RULE_RUNTIME_FAILURE',
            component: 'runtime',
            reviewerConfirmed: review?.status === 'BLOCKED',
            qaConfirmed: qa?.status === 'FAILED',
            remediationVerified: false,
          },
          timestamp: evaluatedAt,
        } as any);
        if (evt) {
          emittedEventId = evt.id;
          memoryId = evt.id;
        }
      } else if (signal === 'REMEDIATION_VERIFIED' || signal === 'SUCCESSFUL_EXECUTION') {
        const evt = await this.memoryPipeline.ingestEvent({
          id: `evt-fb-succ-${taskId}`,
          type: 'AGENT_FINISHED_WORK',
          actorId: agentId,
          project: projectId,
          taskId,
          summary: action.summary,
          payload: {
            ruleId: priorFindingRuleId,
            remediationVerified: signal === 'REMEDIATION_VERIFIED',
            qaConfirmed: qa?.status === 'PASSED',
            reviewerConfirmed: review?.status === 'PASSED',
          },
          timestamp: evaluatedAt,
        } as any);
        if (evt) {
          emittedEventId = evt.id;
          memoryId = evt.id;
        }
      }
    } catch (err: any) {
      // Failure Isolation: Feedback failure NEVER breaks primary execution
      console.warn(`[LearningFeedback] Ingestion notice for task ${taskId}: ${err.message}`);
    }

    return {
      signal,
      evaluation,
      emittedEventId,
      memoryId,
      patternId,
      candidateId,
      provenance: {
        tenantId,
        projectId,
        taskId,
        agentId,
        actionId: action.id,
      },
    };
  }
}

/**
 * Builds ExecutionOutcome strictly from real runtime observables.
 * Never guesses or optimistically marks SUCCESS without proof.
 */
export function buildExecutionOutcomeFromRuntime(params: {
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  changedFiles?: string[];
  durationMs?: number;
  status?: ExecutionStatus;
}): ExecutionOutcome {
  let status: ExecutionStatus = params.status || 'UNKNOWN';

  if (params.exitCode !== undefined && params.exitCode !== null) {
    if (params.exitCode === 0) {
      status = 'SUCCESS';
    } else {
      status = 'FAILURE';
    }
  } else if (params.status) {
    status = params.status;
  }

  return {
    status,
    exitCode: params.exitCode ?? null,
    stdout: params.stdout,
    stderr: params.stderr,
    changedFiles: params.changedFiles || [],
    durationMs: params.durationMs,
  };
}

/**
 * Builds ReviewOutcome strictly from real review manager inspection events.
 */
export function buildReviewOutcomeFromReview(params: {
  iteration: number;
  findings?: Array<{ severity?: string; message?: string; blocker?: boolean }>;
  blocked?: boolean;
  passed?: boolean;
}): ReviewOutcome {
  const findings = params.findings || [];
  const blockerFindings = findings
    .filter((f) => f.blocker || f.severity === 'HIGH' || f.severity === 'CRITICAL')
    .map((f) => f.message || 'Blocker finding');

  let status: ReviewStatus = 'IN_PROGRESS';
  const maxIterationsReached = params.iteration >= 3;

  if (params.blocked || (maxIterationsReached && blockerFindings.length > 0)) {
    status = 'BLOCKED';
  } else if (params.passed || (findings.length === 0 && params.iteration > 0)) {
    status = 'PASSED';
  }

  return {
    status,
    iteration: params.iteration,
    findingsCount: findings.length,
    blockerFindings,
    maxIterationsReached,
  };
}

/**
 * Builds QAOutcome strictly from real test execution assertions.
 */
export function buildQAOutcomeFromTests(params: {
  exitCode?: number | null;
  totalTests?: number;
  passedTests?: number;
  failedTests?: number;
  regressionsDetected?: boolean;
}): QAOutcome {
  const total = params.totalTests ?? 0;
  const passed = params.passedTests ?? 0;
  const failed = params.failedTests ?? (params.exitCode !== 0 && params.exitCode !== null && params.exitCode !== undefined ? 1 : 0);

  let status: QAStatus = 'NOT_RUN';
  if (total > 0 || params.exitCode !== undefined) {
    if (failed === 0 && (params.exitCode === 0 || params.exitCode === undefined) && !params.regressionsDetected) {
      status = 'PASSED';
    } else {
      status = 'FAILED';
    }
  }

  return {
    status,
    totalTests: total,
    passedTests: passed,
    failedTests: failed,
    exitCode: params.exitCode ?? null,
    regressionsDetected: Boolean(params.regressionsDetected),
  };
}

export const defaultLearningFeedbackEngine = new LearningFeedbackEngine();
