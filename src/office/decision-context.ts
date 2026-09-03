import type { Task } from '../domain.js';
import type { OfficeAgentRole, ContextAssemblyResult, ContextBlock } from './context-assembly.js';

export type DecisionConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'NONE';

export interface DecisionObjective {
  statement: string;
  source: 'CEO_DIRECTIVE' | 'TASK_INSTRUCTION' | 'REVIEW_REQUIREMENT' | 'QA_REQUIREMENT' | 'UNKNOWN';
  isComplete: boolean;
}

export interface RoleResponsibilityContract {
  role: OfficeAgentRole;
  primaryDuties: string[];
  operationalScope: string;
  boundaryNote: string;
}

export interface DecisionEvidence {
  id: string;
  source: string;
  authority: 'CURRENT' | 'GOVERNED' | 'HISTORICAL';
  summary: string;
  provenance: {
    tenantId: string;
    projectId: string;
    taskId?: string;
    agentId?: string;
    memoryId?: string;
    lessonId?: string;
    skillId?: string;
  };
}

export interface DecisionConstraint {
  id: string;
  description: string;
  enforcedBy: 'RUNTIME' | 'GOVERNANCE' | 'STATUTORY_GUARDRAIL';
}

export interface DecisionOption {
  id: string;
  description: string;
  supportingEvidenceIds: string[];
  risks: string[];
  dependencies: string[];
  constraints: string[];
}

export interface DecisionRecommendation {
  selectedOptionId?: string;
  rationale: string;
  confidence: DecisionConfidenceLevel;
  supportingEvidenceIds: string[];
  risks: string[];
  requiresApproval: boolean;
  governanceRoute?: string;
}

export interface DecisionNextStep {
  action: 'INSPECT' | 'IMPLEMENT' | 'TEST' | 'REVIEW' | 'REQUEST_APPROVAL' | 'WAIT_DEPENDENCY' | 'COMPLETE';
  description: string;
  isAutomatic: false; // Invariant: Next steps are never automatically executed
}

export interface DecisionGovernanceCheck {
  approvalRequired: boolean;
  approvalType?: 'CEO_APPROVAL' | 'SECURITY_APPROVAL' | 'NONE';
  authorizationSource: string;
  reviewRequired: boolean;
  securityReviewRequired: boolean;
  blocked: boolean;
  blockingReason?: string;
}

export interface AgentAuthorityBoundary {
  canRecommend: boolean;
  canExecute: boolean;
  canReview: boolean;
  canBlock: boolean;
  canApprove: boolean;
  canModifyGovernance: boolean;
}

export interface DecisionConflict {
  type: 'AUTHORITY_CONFLICT' | 'EVIDENCE_CONFLICT' | 'PRECEDENCE_CONFLICT';
  description: string;
  involvedSources: string[];
}

export interface DecisionProvenance {
  tenantId: string;
  projectId: string;
  taskId?: string;
  agentId?: string;
}

export interface AgentDecisionContext {
  role: OfficeAgentRole;
  objective: DecisionObjective;
  responsibility: RoleResponsibilityContract;
  evidence: DecisionEvidence[];
  constraints: DecisionConstraint[];
  options: DecisionOption[];
  recommendation?: DecisionRecommendation;
  nextStep: DecisionNextStep;
  governance: DecisionGovernanceCheck;
  authorityBoundary: AgentAuthorityBoundary;
  conflicts: DecisionConflict[];
  missingContext: string[];
  provenance: DecisionProvenance;
  confidence: DecisionConfidenceLevel;
}

export const ROLE_AUTHORITY_BOUNDARIES: Record<OfficeAgentRole, AgentAuthorityBoundary> = {
  'chief-of-staff': {
    canRecommend: true,
    canExecute: false,
    canReview: false,
    canBlock: true,
    canApprove: false, // CEO approves, CoS plans/coordinates
    canModifyGovernance: false,
  },
  architect: {
    canRecommend: true,
    canExecute: false,
    canReview: true,
    canBlock: false,
    canApprove: false,
    canModifyGovernance: false,
  },
  developer: {
    canRecommend: true,
    canExecute: true,
    canReview: false,
    canBlock: false,
    canApprove: false,
    canModifyGovernance: false,
  },
  reviewer: {
    canRecommend: true,
    canExecute: false,
    canReview: true,
    canBlock: true, // Review iterations (up to MAX_REVIEW_ITERATIONS = 3)
    canApprove: true, // Can approve compliant review finding
    canModifyGovernance: false,
  },
  'qa-engineer': {
    canRecommend: true,
    canExecute: true, // Can execute test suites
    canReview: true,
    canBlock: true, // Can flag test failures
    canApprove: false,
    canModifyGovernance: false,
  },
};

export const ROLE_RESPONSIBILITY_CONTRACTS: Record<OfficeAgentRole, RoleResponsibilityContract> = {
  'chief-of-staff': {
    role: 'chief-of-staff',
    primaryDuties: ['Coordenar execução do projeto', 'Decompor objetivos do CEO', 'Priorizar tarefas', 'Identificar dependências e bloqueios'],
    operationalScope: 'Coordenação e planejamento operacional estruturado',
    boundaryNote: 'Não possui autoridade executiva para alterar governança ou aprovar em nome do CEO.',
  },
  architect: {
    role: 'architect',
    primaryDuties: ['Avaliar arquitetura e integridade de sistemas', 'Identificar riscos técnicos e acoplamento', 'Propor modularização e avaliar trade-offs'],
    operationalScope: 'Diretrizes técnicas e consultoria de design',
    boundaryNote: 'Diretrizes arquiteturais são consultivas e não alteram código diretamente.',
  },
  developer: {
    role: 'developer',
    primaryDuties: ['Implementar código em conformidade com a tarefa', 'Corrigir inconformidades apontadas pelo Reviewer', 'Executar builds e typechecks locais'],
    operationalScope: 'Construção técnica e refatoração de código',
    boundaryNote: 'Subordinado aos critérios de aceitação e aos guardrails de segurança.',
  },
  reviewer: {
    role: 'reviewer',
    primaryDuties: ['Inspecionar diffs de código', 'Identificar riscos de segurança e qualidade', 'Emitir findings ou aprovação técnica'],
    operationalScope: 'Inspeção de conformidade e segurança',
    boundaryNote: 'Limitado a 3 iterações (MAX_REVIEW_ITERATIONS = 3); não pode auto-aprovar com findings pendentes.',
  },
  'qa-engineer': {
    role: 'qa-engineer',
    primaryDuties: ['Validar comportamento do sistema', 'Executar testes automatizados e de regressão', 'Registrar evidências de execução e falhas'],
    operationalScope: 'Garantia de qualidade e validação empírica',
    boundaryNote: 'Evidências de falha em testes presentes prevalecem incondicionalmente sobre memórias passadas.',
  },
};

export interface RawDecisionInput {
  role: OfficeAgentRole;
  tenantId: string;
  projectId: string;
  task: Task;
  ceoObjective?: string;
  reviewIteration?: number;
  securityFlagged?: boolean;
}

export class DecisionContextEngine {
  public buildDecisionContext(
    assemblyResult: ContextAssemblyResult,
    input: RawDecisionInput
  ): AgentDecisionContext {
    const role = input.role;
    const boundary = ROLE_AUTHORITY_BOUNDARIES[role];
    const responsibility = ROLE_RESPONSIBILITY_CONTRACTS[role];
    const missingContext: string[] = [];
    const conflicts: DecisionConflict[] = [];

    // 1. OBJECTIVE EXTRACTION
    let objectiveStatement = '';
    let objectiveSource: DecisionObjective['source'] = 'UNKNOWN';

    if (role === 'chief-of-staff' && input.ceoObjective?.trim()) {
      objectiveStatement = input.ceoObjective.trim();
      objectiveSource = 'CEO_DIRECTIVE';
    } else if (input.task?.objective?.trim()) {
      objectiveStatement = input.task.objective.trim();
      objectiveSource = 'TASK_INSTRUCTION';
    } else if (input.task?.prompt?.trim()) {
      objectiveStatement = input.task.prompt.trim().slice(0, 150);
      objectiveSource = 'TASK_INSTRUCTION';
    } else {
      missingContext.push('MISSING_OBJECTIVE: No explicit task objective or prompt provided');
      objectiveStatement = 'Objetivo não especificado';
    }

    const objective: DecisionObjective = {
      statement: objectiveStatement,
      source: objectiveSource,
      isComplete: objectiveSource !== 'UNKNOWN',
    };

    // 2. EVIDENCE MAPPING
    const evidence: DecisionEvidence[] = assemblyResult.blocksIncluded.map((b) => ({
      id: b.id,
      source: b.source,
      authority: b.authority,
      summary: b.content.slice(0, 200),
      provenance: {
        tenantId: b.provenance.tenantId,
        projectId: b.provenance.projectId,
        taskId: b.provenance.taskId,
        agentId: b.provenance.agentId,
      },
    }));

    if (evidence.length === 0) {
      missingContext.push('MISSING_EVIDENCE: No evidence blocks available');
    }

    // 3. CONSTRAINTS MAPPING
    const constraints: DecisionConstraint[] = [
      {
        id: 'CONST_PREV_PRECEDENCE',
        description: 'CURRENT evidence strictly dominates GOVERNED lessons and HISTORICAL memory.',
        enforcedBy: 'STATUTORY_GUARDRAIL',
      },
    ];

    if (role === 'reviewer') {
      constraints.push({
        id: 'CONST_MAX_REVIEW_ITERATIONS',
        description: 'Review is strictly bounded by MAX_REVIEW_ITERATIONS = 3.',
        enforcedBy: 'GOVERNANCE',
      });
    }

    if (role === 'chief-of-staff') {
      constraints.push({
        id: 'CONST_CEO_SOVEREIGNTY',
        description: 'CEO objective is sovereign and cannot be superseded by historical plan memory.',
        enforcedBy: 'GOVERNANCE',
      });
    }

    // 4. GOVERNANCE CHECK
    const requiresCEO = input.securityFlagged || (input.task as any)?.type === 'approval' || input.task?.objective?.toLowerCase().includes('critical');
    const governance: DecisionGovernanceCheck = {
      approvalRequired: Boolean(requiresCEO),
      approvalType: requiresCEO ? 'CEO_APPROVAL' : 'NONE',
      authorizationSource: 'AUTHENTICATED_RUNTIME',
      reviewRequired: role === 'developer',
      securityReviewRequired: Boolean(input.securityFlagged),
      blocked: (input.reviewIteration ?? 0) >= 3,
      blockingReason: (input.reviewIteration ?? 0) >= 3 ? 'MAX_REVIEW_ITERATIONS_EXCEEDED' : undefined,
    };

    // 5. NEXT STEP RECOMMENDATION (Advisory Only)
    let nextAction: DecisionNextStep['action'] = 'IMPLEMENT';
    let nextDesc = 'Prosseguir com a execução técnica da tarefa.';

    switch (role) {
      case 'chief-of-staff':
        nextAction = 'INSPECT';
        nextDesc = 'Avaliar plano de execução e decomposição operacional.';
        break;
      case 'architect':
        nextAction = 'INSPECT';
        nextDesc = 'Avaliar integridade arquitetural e dependências.';
        break;
      case 'reviewer':
        nextAction = 'REVIEW';
        nextDesc = 'Inspecionar diffs de código e validar conformance com políticas de segurança.';
        break;
      case 'qa-engineer':
        nextAction = 'TEST';
        nextDesc = 'Executar testes de regressão e validar comportamento funcional.';
        break;
      case 'developer':
      default:
        nextAction = 'IMPLEMENT';
        nextDesc = 'Implementar alterações respeitando os critérios de aceitação.';
        break;
    }

    const nextStep: DecisionNextStep = {
      action: nextAction,
      description: nextDesc,
      isAutomatic: false,
    };

    // 6. CONFIDENCE ASSESSMENT
    let confidence: DecisionConfidenceLevel = 'MEDIUM';
    if (missingContext.length > 0) {
      confidence = 'LOW';
    } else if (evidence.some((e) => e.authority === 'CURRENT') && objective.isComplete) {
      confidence = 'HIGH';
    }

    return {
      role,
      objective,
      responsibility,
      evidence,
      constraints,
      options: [],
      nextStep,
      governance,
      authorityBoundary: boundary,
      conflicts,
      missingContext,
      provenance: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        taskId: input.task?.id,
        agentId: role,
      },
      confidence,
    };
  }

  public formatDecisionContext(ctx: AgentDecisionContext): string {
    const lines: string[] = [
      '---',
      `[OPERATIONAL DECISION CONTEXT — ${ctx.role.toUpperCase()}]`,
      `OBJETIVO OPERACIONAL: ${ctx.objective.statement} (Fonte: ${ctx.objective.source})`,
      `RESPONSABILIDADE: ${ctx.responsibility.operationalScope}`,
      `PRÓXIMA AÇÃO RECOMENDADA: ${ctx.nextStep.action} — ${ctx.nextStep.description}`,
      `AVISO: Esta estrutura de decisão é consultiva e NÃO constitui auto-aprovação ou mutação automática de estado.`,
      '---',
    ];
    return lines.join('\n');
  }
}

export const defaultDecisionContextEngine = new DecisionContextEngine();
