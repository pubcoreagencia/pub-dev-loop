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
  status: 'APPROVED' | 'CHANGES_REQUESTED' | 'BLOCKED';
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

  if (!result && overrides?.testPassed === undefined && overrides?.buildPassed === undefined && overrides?.typecheckPassed === undefined) {
    return {
      taskId: task.id,
      planId: overrides?.planId,
      developerAgentId: task.agentId || 'developer',
      reviewerAgentId: 'reviewer',
      project: task.project || 'pub-dev-loop',
      diff: overrides?.diff,
      changedFiles: overrides?.changedFiles,
      testPassed: undefined,
      typecheckPassed: undefined,
      buildPassed: undefined,
      findings: overrides?.findings,
    };
  }

  const finalize = (result as any)?.finalize;
  const stdout = (result?.stdout || (result as any)?.summary || '') as string;
  const stderr = (result?.stderr || finalize?.testOutput || '') as string;
  const exitCode = result?.exitCode ?? (task.status === 'COMPLETED' ? 0 : 1);

  const testPassed = overrides?.testPassed ?? (
    finalize?.testsPassed !== undefined
      ? Boolean(finalize.testsPassed)
      : (exitCode === 0 && !stderr.includes('FAIL') && !stdout.includes('Tests:       failed'))
  );

  const typecheckPassed = overrides?.typecheckPassed ?? (
    !stderr.includes('error TS') && !stdout.includes('error TS')
  );

  const buildPassed = overrides?.buildPassed ?? (
    exitCode === 0 && !stderr.includes('build failed')
  );

  const changedFiles = overrides?.changedFiles ?? (
    finalize?.changedFiles || (result as any)?.changedFiles || []
  );

  return {
    taskId: task.id,
    planId: overrides?.planId,
    developerAgentId: task.agentId || 'developer',
    reviewerAgentId: 'reviewer',
    project: task.project || 'pub-dev-loop',
    diff: overrides?.diff,
    changedFiles: changedFiles.length > 0 ? changedFiles : undefined,
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

    // Reality Gate: Fail closed on total absence of empirical execution evidence
    const hasEvidence =
      input.testPassed !== undefined ||
      input.buildPassed !== undefined ||
      input.typecheckPassed !== undefined ||
      (typeof input.diff === 'string' && input.diff.trim().length > 0) ||
      (Array.isArray(input.changedFiles) && input.changedFiles.length > 0) ||
      findings.length > 0;

    if (!hasEvidence) {
      const blockedSummary = 'Revisão BLOQUEADA: Nenhuma evidência empírica de testes, build, diff ou arquivos alterados foi fornecida (INSUFFICIENT_EVIDENCE).';
      const evidenceFinding: CodeReviewFinding = {
        ruleId: 'INSUFFICIENT_EVIDENCE',
        severity: 'ERROR',
        message: 'Ausência total de evidências de execução, testes ou artefatos alterados.',
        suggestion: 'Executar os testes automatizados ou fornecer artefatos antes de submeter à revisão.',
      };

      this.eventBus.publish({
        type: 'REVIEW_BLOCKED',
        actorId: reviewerId,
        targetId: developerId,
        taskId,
        planId: input.planId,
        project,
        summary: blockedSummary,
        payload: {
          iteration: currentIteration,
          maxIterations: MAX_REVIEW_ITERATIONS,
          findings: [evidenceFinding],
          requiresEscalation: false,
        },
      });

      return {
        reviewId: `rev-${Date.now()}`,
        taskId,
        status: 'BLOCKED',
        iteration: currentIteration,
        findings: [evidenceFinding],
        summary: blockedSummary,
      };
    }

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

    // Caso 1: Inconformidades detectadas
    if (hasBlockingErrors) {
      const topFinding = findings.find((f) => f.severity === 'ERROR') || findings[0];

      // Se atingiu ou excedeu o limite máximo de iterações -> HARD BLOCK (NUNCA AUTO-APROVA)
      if (currentIteration >= MAX_REVIEW_ITERATIONS) {
        const blockedSummary = `Revisão BLOQUEADA: Limite máximo de ${MAX_REVIEW_ITERATIONS} ciclos atingido com inconformidades pendentes (${topFinding.message}). Encaminhado para escalonamento/decisão do CEO.`;

        // 1. Emitir evento de bloqueio/escalonamento
        this.eventBus.publish({
          type: 'REVIEW_BLOCKED',
          actorId: reviewerId,
          targetId: developerId,
          taskId,
          planId: input.planId,
          project,
          summary: blockedSummary,
          payload: {
            iteration: currentIteration,
            maxIterations: MAX_REVIEW_ITERATIONS,
            findings,
            requiresEscalation: true,
          },
        });

        // 2. Emitir mensagem direta informando o bloqueio
        this.eventBus.publish({
          type: 'MESSAGE_SENT',
          actorId: reviewerId,
          targetId: developerId,
          taskId,
          project,
          summary: `[Code Review] ${blockedSummary}`,
          payload: {
            isDirectCommunication: true,
            finding: topFinding,
            blocked: true,
          },
        });

        return {
          reviewId: `rev-${Date.now()}`,
          taskId,
          status: 'BLOCKED',
          iteration: currentIteration,
          findings,
          summary: blockedSummary,
        };
      }

      // Se ainda dentro do limite de iterações -> CHANGES_REQUESTED
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

    // Caso 2: Sem erros bloqueantes -> APROVADO
    const approvedSummary = 'Código revisado, conformidade arquitetural e testes validados com sucesso.';

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
