import { OfficeEventBus, defaultOfficeEventBus } from './events.js';

export interface CodeReviewFinding {
  ruleId: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  file?: string;
  line?: number;
  message: string;
  suggestion?: string;
}

export interface CodeReviewEvaluationInput {
  taskId: string;
  planId?: string;
  developerAgentId?: string;
  reviewerAgentId?: string;
  project?: string;
  changedFiles?: string[];
  diff?: string;
  testPassed?: boolean;
  typecheckPassed?: boolean;
  buildPassed?: boolean;
  findings?: CodeReviewFinding[];
  iteration?: number;
}

export interface CodeReviewResult {
  reviewId: string;
  taskId: string;
  status: 'APPROVED' | 'CHANGES_REQUESTED';
  iteration: number;
  findings: CodeReviewFinding[];
  summary: string;
}

export const MAX_REVIEW_ITERATIONS = 3;

/**
 * Extracts review input metrics from real Task execution results.
 * SOURCE (TaskResult/Worker) → PRODUCER (extractReviewContextFromTask) → CONSUMER (CodeReviewManager)
 */
export function extractReviewContextFromTask(
  task: { id: string; agentId?: string | null; project?: string; status?: string; result?: any },
  overrides?: Partial<CodeReviewEvaluationInput>
): CodeReviewEvaluationInput {
  const result = task.result;
  const stdout = result?.stdout || '';
  const stderr = result?.stderr || '';
  const exitCode = result?.exitCode ?? (task.status === 'COMPLETED' ? 0 : 1);

  const testPassed = overrides?.testPassed ?? (
    exitCode === 0 && !stderr.includes('FAIL') && !stdout.includes('Tests:       failed')
  );

  const typecheckPassed = overrides?.typecheckPassed ?? (
    !stderr.includes('error TS') && !stdout.includes('error TS')
  );

  const buildPassed = overrides?.buildPassed ?? (
    exitCode === 0 && !stderr.includes('build failed')
  );

  return {
    taskId: task.id,
    planId: overrides?.planId,
    developerAgentId: task.agentId || 'developer',
    reviewerAgentId: 'reviewer',
    project: task.project || 'pub-dev-loop',
    diff: overrides?.diff,
    changedFiles: overrides?.changedFiles,
    testPassed,
    typecheckPassed,
    buildPassed,
    findings: overrides?.findings,
  };
}

export class CodeReviewManager {
  private iterations = new Map<string, number>();

  constructor(private readonly eventBus: OfficeEventBus = defaultOfficeEventBus) {}

  evaluateReview(input: CodeReviewEvaluationInput): CodeReviewResult {
    const taskId = input.taskId;
    const currentIteration = (this.iterations.get(taskId) || 0) + 1;
    this.iterations.set(taskId, currentIteration);

    const project = input.project || 'pub-dev-loop';
    const developerId = input.developerAgentId || 'developer';
    const reviewerId = input.reviewerAgentId || 'reviewer';

    const findings: CodeReviewFinding[] = [...(input.findings || [])];

    // Heurística de inspeção de testes e build reais se não fornecidos explicitamente
    if (input.testPassed === false) {
      findings.push({
        ruleId: 'TEST_SUITE_FAILURE',
        severity: 'ERROR',
        message: 'A suíte automatizada de testes falhou na branch de entrega.',
        suggestion: 'Corrigir as asserções com falha antes de solicitar nova revisão.',
      });
    }

    if (input.typecheckPassed === false) {
      findings.push({
        ruleId: 'TYPECHECK_ERROR',
        severity: 'ERROR',
        message: 'Erros de tipagem TypeScript detectados no compilador.',
        suggestion: 'Executar tsc --noEmit e corrigir as assinaturas de tipo.',
      });
    }

    if (input.buildPassed === false) {
      findings.push({
        ruleId: 'BUILD_FAILURE',
        severity: 'ERROR',
        message: 'Falha no build do pacote para produção.',
        suggestion: 'Verificar os scripts de build e dependências ausentes.',
      });
    }

    const hasBlockingErrors = findings.some((f) => f.severity === 'ERROR');

    // Se houver erros e não atingiu o limite de guardrail
    if (hasBlockingErrors && currentIteration <= MAX_REVIEW_ITERATIONS) {
      const topFinding = findings.find((f) => f.severity === 'ERROR') || findings[0];
      const summary = `Revisão detectou ${findings.length} inconformidade(s): ${topFinding.message}`;

      // 1. Emitir evento de finding
      this.eventBus.publish({
        type: 'REVIEW_FINDING',
        actorId: reviewerId,
        targetId: developerId,
        taskId,
        planId: input.planId,
        project,
        summary,
        payload: {
          iteration: currentIteration,
          maxIterations: MAX_REVIEW_ITERATIONS,
          findings,
        },
      });

      // 2. Emitir mensagem direta do Reviewer para o Developer
      this.eventBus.publish({
        type: 'MESSAGE_SENT',
        actorId: reviewerId,
        targetId: developerId,
        taskId,
        project,
        summary: `[Code Review] ${topFinding.message}`,
        payload: {
          isDirectCommunication: true,
          finding: topFinding,
        },
      });

      return {
        reviewId: `rev-${Date.now()}`,
        taskId,
        status: 'CHANGES_REQUESTED',
        iteration: currentIteration,
        findings,
        summary,
      };
    }

    // Se aprovado ou limite de iterações atingido
    const approvedSummary = currentIteration > MAX_REVIEW_ITERATIONS
      ? `Aprovado com ressalvas após atingir limite de ${MAX_REVIEW_ITERATIONS} ciclos de revisão.`
      : 'Código revisado, conformidade arquitetural e testes validados com sucesso.';

    this.eventBus.publish({
      type: 'REVIEW_APPROVED',
      actorId: reviewerId,
      targetId: developerId,
      taskId,
      planId: input.planId,
      project,
      summary: approvedSummary,
      payload: {
        iteration: currentIteration,
        findings,
      },
    });

    this.eventBus.publish({
      type: 'MESSAGE_SENT',
      actorId: reviewerId,
      targetId: developerId,
      taskId,
      project,
      summary: `[Code Review] ${approvedSummary}`,
      payload: {
        isDirectCommunication: true,
      },
    });

    return {
      reviewId: `rev-${Date.now()}`,
      taskId,
      status: 'APPROVED',
      iteration: currentIteration,
      findings,
      summary: approvedSummary,
    };
  }

  getIteration(taskId: string): number {
    return this.iterations.get(taskId) || 0;
  }

  reset(taskId?: string): void {
    if (taskId) {
      this.iterations.delete(taskId);
    } else {
      this.iterations.clear();
    }
  }
}

export const defaultCodeReviewManager = new CodeReviewManager();
