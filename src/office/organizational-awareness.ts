import type { OfficeAgentRole } from './context-assembly.js';
import {
  defaultOrganizationalIntelligenceEngine,
  OrganizationalIntelligenceEngine,
  type OrganizationalIntelligenceResult,
  type ProjectHealthStatus,
  type SignalSeverity,
  type IntelligenceConfidence,
  type TrendDirection,
  type IntelligenceComputeInput,
} from './organizational-intelligence.js';

export interface AwarenessPulse {
  status: ProjectHealthStatus;
  badgeLabel: string;
  badgeColor: 'green' | 'amber' | 'red' | 'gray';
  summary: string;
}

export interface AwarenessHealth {
  status: ProjectHealthStatus;
  summary: string;
  successRateText: string;
  failureRateText: string;
  tasksCompleted: number;
  tasksFailed: number;
  tasksBlocked: number;
  evaluatedAt: string;
}

export interface AwarenessRisk {
  id: string;
  riskType: string;
  severity: SignalSeverity;
  confidence: IntelligenceConfidence;
  evidence: string[];
  firstObservedAt: string;
  status: 'ACTIVE' | 'MITIGATED' | 'DISMISSED';
}

export interface AwarenessTrend {
  metricName: string;
  direction: TrendDirection;
  currentValueText: string;
  previousValueText?: string;
  reason: string;
}

export interface AwarenessBottleneck {
  id: string;
  title: string;
  description: string;
  severity: SignalSeverity;
  affectedRole?: OfficeAgentRole;
}

export interface AwarenessAgentLoad {
  role: OfficeAgentRole;
  taskCount: number;
  failureCount: number;
  blockedCount: number;
  reviewCount: number;
  qaCount: number;
  // Invariant: No individual productivity scores, rankings, or performance judgments
}

export interface AwarenessInsight {
  id: string;
  category: 'OBSERVED' | 'INFERRED';
  title: string;
  description: string;
  evidence: string[];
  confidence: IntelligenceConfidence;
}

export interface AwarenessRecommendation {
  id: string;
  title: string;
  description: string;
  suggestedAction: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  targetRole?: OfficeAgentRole | 'CEO';
  requiresHumanDecision: true; // Invariant: recommendations are strictly advisory
}

export interface AwarenessMetadata {
  tenantId: string;
  projectId?: string;
  sampleSize: number;
  evaluatedAt: string;
  isReadOnly: true;
}

export interface OrganizationAwareness {
  pulse: AwarenessPulse;
  health: AwarenessHealth;
  risks: AwarenessRisk[];
  trends: AwarenessTrend[];
  bottlenecks: AwarenessBottleneck[];
  agentLoad: Record<string, AwarenessAgentLoad>;
  insights: AwarenessInsight[];
  recommendations: AwarenessRecommendation[];
  metadata: AwarenessMetadata;
}

export class OrganizationalAwarenessEngine {
  constructor(
    private intelligenceEngine: OrganizationalIntelligenceEngine = defaultOrganizationalIntelligenceEngine
  ) {}

  /**
   * Transforms raw compute input into the human-navigable OrganizationAwareness model.
   * Strictly read-only, non-autonomous, and preserving CEO sovereignty.
   */
  public generateAwareness(input: IntelligenceComputeInput): OrganizationAwareness {
    const intelligence: OrganizationalIntelligenceResult = this.intelligenceEngine.evaluateIntelligence(input);
    const { metrics, signals, risks, trends, insights, recommendations, projectHealth, provenance } = intelligence;

    // 1. PULSE MAPPING
    let badgeColor: AwarenessPulse['badgeColor'] = 'gray';
    let badgeLabel = 'UNKNOWN';
    let pulseSummary = 'Dados insuficientes para avaliação organizacional.';

    switch (projectHealth) {
      case 'HEALTHY':
        badgeColor = 'green';
        badgeLabel = 'HEALTHY';
        pulseSummary = 'Operações estáveis e alto índice de sucesso.';
        break;
      case 'ATTENTION':
        badgeColor = 'amber';
        badgeLabel = 'ATTENTION';
        pulseSummary = 'Pequenos bloqueios ou taxa de falha moderada requerem atenção.';
        break;
      case 'AT_RISK':
        badgeColor = 'red';
        badgeLabel = 'AT RISK';
        pulseSummary = 'Taxa elevada de falhas ou riscos operacionais identificados.';
        break;
      case 'BLOCKED':
        badgeColor = 'red';
        badgeLabel = 'BLOCKED';
        pulseSummary = 'Múltiplas tarefas bloqueadas ou sinais críticos exigem intervenção.';
        break;
      case 'UNKNOWN':
      default:
        badgeColor = 'gray';
        badgeLabel = 'UNKNOWN';
        pulseSummary = 'Sem histórico suficiente para cálculo de saúde.';
        break;
    }

    const pulse: AwarenessPulse = {
      status: projectHealth,
      badgeLabel,
      badgeColor,
      summary: pulseSummary,
    };

    // 2. HEALTH MAPPING
    const health: AwarenessHealth = {
      status: projectHealth,
      summary: pulseSummary,
      successRateText: metrics.delivery.successRate >= 0 ? `${Math.round(metrics.delivery.successRate * 100)}%` : 'UNKNOWN',
      failureRateText: metrics.delivery.failureRate >= 0 ? `${Math.round(metrics.delivery.failureRate * 100)}%` : 'UNKNOWN',
      tasksCompleted: metrics.delivery.tasksCompleted,
      tasksFailed: metrics.delivery.tasksFailed,
      tasksBlocked: metrics.delivery.tasksBlocked,
      evaluatedAt: provenance.evaluatedAt,
    };

    // 3. RISKS MAPPING
    const awarenessRisks: AwarenessRisk[] = risks.map((r) => ({
      id: r.id,
      riskType: r.riskType,
      severity: r.severity,
      confidence: r.confidence,
      evidence: r.evidence,
      firstObservedAt: r.firstObservedAt,
      status: r.status,
    }));

    // 4. TRENDS MAPPING
    const awarenessTrends: AwarenessTrend[] = trends.map((t) => ({
      metricName: t.metricName,
      direction: t.direction,
      currentValueText: t.currentValue >= 0 ? `${Math.round(t.currentValue * 100)}%` : 'UNKNOWN',
      previousValueText: t.previousValue !== undefined && t.previousValue >= 0 ? `${Math.round(t.previousValue * 100)}%` : undefined,
      reason: t.reason,
    }));

    // 5. BOTTLENECK MAPPING (Organizational, not employee blame)
    const bottlenecks: AwarenessBottleneck[] = [];
    if (metrics.dependencies.bottleneckDetected || signals.some((s) => s.type === 'BOTTLENECK_DETECTED')) {
      bottlenecks.push({
        id: `btnk-dep-${Date.now()}`,
        title: 'Gargalo no Fluxo de Execução',
        description: `Identificado acúmulo de ${metrics.delivery.tasksBlocked} tarefa(s) bloqueada(s) ou fila de inspeção travada.`,
        severity: metrics.delivery.tasksBlocked >= 3 ? 'HIGH' : 'MEDIUM',
      });
    }

    // 6. WORKFORCE LOAD (Visibility without individual ranking)
    const agentLoad: Record<string, AwarenessAgentLoad> = {};
    for (const [role, data] of Object.entries(metrics.workforce)) {
      agentLoad[role] = {
        role: data.agentRole,
        taskCount: data.taskCount,
        failureCount: data.failureCount,
        blockedCount: data.blockedCount,
        reviewCount: data.reviewCount,
        qaCount: data.qaCount,
      };
    }

    // 7. INSIGHTS MAPPING (Separating OBSERVED and INFERRED)
    const awarenessInsights: AwarenessInsight[] = insights.map((i) => ({
      id: i.id,
      category: 'INFERRED',
      title: i.observation,
      description: i.interpretation,
      evidence: i.evidence,
      confidence: i.confidence,
    }));

    // Add directly observed fact if any
    if (metrics.delivery.totalTasks > 0) {
      awarenessInsights.unshift({
        id: `ins-obs-tasks-${Date.now()}`,
        category: 'OBSERVED',
        title: 'Volume Operacional Observado',
        description: `Foram processadas ${metrics.delivery.totalTasks} tarefas no ciclo avaliado.`,
        evidence: [`Total Tasks: ${metrics.delivery.totalTasks}`, `Completed: ${metrics.delivery.tasksCompleted}`],
        confidence: 'HIGH',
      });
    }

    // 8. RECOMMENDATIONS MAPPING (Strictly requiresHumanDecision: true)
    const awarenessRecommendations: AwarenessRecommendation[] = recommendations.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      suggestedAction: r.suggestedAction,
      priority: r.priority,
      targetRole: r.targetRole,
      requiresHumanDecision: true,
    }));

    const metadata: AwarenessMetadata = {
      tenantId: provenance.tenantId,
      projectId: provenance.projectId,
      sampleSize: metrics.sampleSize,
      evaluatedAt: provenance.evaluatedAt,
      isReadOnly: true,
    };

    return {
      pulse,
      health,
      risks: awarenessRisks,
      trends: awarenessTrends,
      bottlenecks,
      agentLoad,
      insights: awarenessInsights,
      recommendations: awarenessRecommendations,
      metadata,
    };
  }
}

export const defaultOrganizationalAwarenessEngine = new OrganizationalAwarenessEngine();
