import type { OfficeAgentRole } from './context-assembly.js';
import type { Task } from '../domain.js';
import type { OfficeEvent } from './events.js';
import type { OrganizationalPattern } from './pattern-detection.js';

export type OrganizationalSignalType =
  | 'EXECUTION_FAILURE_RATE'
  | 'EXECUTION_SUCCESS_RATE'
  | 'REVIEW_BLOCK_RATE'
  | 'QA_FAILURE_RATE'
  | 'REGRESSION_RATE'
  | 'REMEDIATION_SUCCESS_RATE'
  | 'REPEATED_FAILURE_PATTERN'
  | 'BOTTLENECK_DETECTED'
  | 'AGENT_LOAD_SIGNAL'
  | 'DEPENDENCY_BLOCK_SIGNAL'
  | 'PROJECT_HEALTH_SIGNAL'
  | 'GOVERNANCE_BLOCK_SIGNAL'
  | 'DELIVERY_TREND'
  | 'QUALITY_TREND';

export type SignalSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IntelligenceConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface OrganizationalSignal {
  id: string;
  type: OrganizationalSignalType;
  severity: SignalSeverity;
  confidence: IntelligenceConfidence;
  value: number | string | Record<string, any>;
  description: string;
  provenance: {
    tenantId: string;
    projectId?: string;
    agentId?: string;
    observedAt: string;
  };
}

export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'VOLATILE' | 'UNKNOWN';

export interface OrganizationalTrend {
  metricName: string;
  direction: TrendDirection;
  currentValue: number;
  previousValue?: number;
  sampleSize: number;
  reason: string;
}

export type ProjectHealthStatus = 'HEALTHY' | 'ATTENTION' | 'AT_RISK' | 'BLOCKED' | 'UNKNOWN';

export interface AgentWorkforceMetric {
  agentRole: OfficeAgentRole;
  taskCount: number;
  failureCount: number;
  blockedCount: number;
  reviewCount: number;
  qaCount: number;
  averageDurationMs?: number;
}

export interface DeliveryMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  tasksBlocked: number;
  totalTasks: number;
  successRate: number; // 0.0 - 1.0 or -1 if UNKNOWN
  failureRate: number; // 0.0 - 1.0 or -1 if UNKNOWN
  averageDurationMs?: number;
}

export interface QualityMetrics {
  reviewBlockRate: number; // 0.0 - 1.0 or -1 if UNKNOWN
  qaFailureRate: number; // 0.0 - 1.0 or -1 if UNKNOWN
  regressionRate: number; // 0.0 - 1.0 or -1 if UNKNOWN
  remediationSuccessRate: number; // 0.0 - 1.0 or -1 if UNKNOWN
  totalReviews: number;
  totalQARuns: number;
}

export interface ReliabilityMetrics {
  repeatedFailureCount: number;
  recurringPatternCount: number;
  unresolvedContradictionCount: number;
  blockedProjectCount: number;
}

export interface DependencyMetrics {
  dependencyBlockedCount: number;
  waitingForDependencyCount: number;
  bottleneckDetected: boolean;
}

export interface OrganizationalMetricsSummary {
  delivery: DeliveryMetrics;
  quality: QualityMetrics;
  reliability: ReliabilityMetrics;
  workforce: Record<string, AgentWorkforceMetric>;
  dependencies: DependencyMetrics;
  sampleSize: number;
  evaluatedAt: string;
}

export interface OrganizationalRisk {
  id: string;
  tenantId: string;
  projectId?: string;
  riskType: string;
  severity: SignalSeverity;
  confidence: IntelligenceConfidence;
  evidence: string[];
  firstObservedAt: string;
  lastObservedAt: string;
  supportingSignals: string[];
  status: 'ACTIVE' | 'MITIGATED' | 'DISMISSED';
}

export interface OrganizationalInsight {
  id: string;
  observation: string;
  evidence: string[];
  interpretation: string;
  confidence: IntelligenceConfidence;
  temporalScope: string;
  affectedAgents: string[];
  affectedProjects: string[];
  supportingSignals: string[];
}

export interface OrganizationalRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedAction: string;
  requiresHumanDecision: true; // Invariant: AI never auto-executes recommendations
  targetRole?: OfficeAgentRole | 'CEO';
}

export interface OrganizationalIntelligenceResult {
  metrics: OrganizationalMetricsSummary;
  signals: OrganizationalSignal[];
  risks: OrganizationalRisk[];
  trends: OrganizationalTrend[];
  insights: OrganizationalInsight[];
  recommendations: OrganizationalRecommendation[];
  projectHealth: ProjectHealthStatus;
  provenance: {
    tenantId: string;
    projectId?: string;
    evaluatedAt: string;
  };
}

export interface IntelligenceComputeInput {
  tenantId: string;
  projectId?: string;
  tasks?: Task[];
  events?: OfficeEvent[];
  patterns?: OrganizationalPattern[];
  previousPeriodMetrics?: Partial<OrganizationalMetricsSummary>;
}

export class OrganizationalIntelligenceEngine {
  /**
   * 1. Compute Deterministic Metrics
   */
  public computeMetrics(input: IntelligenceComputeInput): OrganizationalMetricsSummary {
    const { tenantId, projectId } = input;
    const evaluatedAt = new Date().toISOString();

    // Filter tasks strictly by tenant (and project if specified)
    const tasks = (input.tasks || []).filter((t) => {
      const matchTenant = (t.tenantId as any) === tenantId || (!t.tenantId && tenantId === 'pub-dev-loop');
      const matchProject = !projectId || t.project === projectId;
      return matchTenant && matchProject;
    });

    const events = (input.events || []).filter((e) => {
      const matchTenant = (e as any).tenantId === tenantId || (!(e as any).tenantId && tenantId === 'pub-dev-loop');
      const matchProject = !projectId || e.project === projectId;
      return matchTenant && matchProject;
    });

    const patterns = (input.patterns || []).filter((p) => {
      const matchTenant = p.tenantId === tenantId;
      const matchProject = !projectId || p.projectId === projectId;
      return matchTenant && matchProject;
    });

    let completed = 0;
    let failed = 0;
    let blocked = 0;

    const workforce: Record<string, AgentWorkforceMetric> = {};

    for (const t of tasks) {
      const agent = (t.agentId || 'unknown') as OfficeAgentRole;
      if (!workforce[agent]) {
        workforce[agent] = {
          agentRole: agent,
          taskCount: 0,
          failureCount: 0,
          blockedCount: 0,
          reviewCount: 0,
          qaCount: 0,
        };
      }
      workforce[agent].taskCount++;

      const statusStr = String(t.status || '').toLowerCase();
      if (statusStr === 'completed') completed++;
      else if (statusStr === 'failed') {
        failed++;
        workforce[agent].failureCount++;
      } else if (statusStr === 'blocked') {
        blocked++;
        workforce[agent].blockedCount++;
      }
    }

    const totalTasks = tasks.length;
    const successRate = totalTasks > 0 ? Number((completed / totalTasks).toFixed(2)) : -1;
    const failureRate = totalTasks > 0 ? Number((failed / totalTasks).toFixed(2)) : -1;

    // Quality metrics from events
    const reviewEvents = events.filter((e) => e.type === 'REVIEW_FINDING' || e.type === 'REVIEW_BLOCKED');
    const reviewBlockedEvents = events.filter((e) => e.type === 'REVIEW_BLOCKED');
    const qaEvents = events.filter((e) => e.type === 'AGENT_FINISHED_WORK' && (e.payload as any)?.qaConfirmed !== undefined);
    const qaFailedEvents = events.filter((e) => (e.payload as any)?.qaConfirmed === false || (e.payload as any)?.regressionsDetected === true);
    const regressionEvents = events.filter((e) => (e.payload as any)?.regressionsDetected === true);
    const remediationEvents = events.filter((e) => (e.payload as any)?.remediationVerified === true);

    const totalReviews = reviewEvents.length;
    const totalQARuns = qaEvents.length;

    const reviewBlockRate = totalReviews > 0 ? Number((reviewBlockedEvents.length / totalReviews).toFixed(2)) : -1;
    const qaFailureRate = totalQARuns > 0 ? Number((qaFailedEvents.length / totalQARuns).toFixed(2)) : -1;
    const regressionRate = totalQARuns > 0 ? Number((regressionEvents.length / totalQARuns).toFixed(2)) : -1;
    const remediationSuccessRate = remediationEvents.length > 0 ? 1.0 : totalQARuns > 0 ? 0.0 : -1;

    // Reliability & Dependencies
    const recurringPatternCount = patterns.filter((p) => p.recurrenceCount > 1 || (p.status as any) === 'RECURRING').length;
    const repeatedFailureCount = patterns.reduce((acc, p) => acc + (p.recurrenceCount > 1 ? p.recurrenceCount : 0), 0);
    const unresolvedContradictionCount = patterns.filter((p) => (p as any).contradictionStatus === 'CONTRADICTED' || (p as any).metadata?.contradictionStatus === 'CONTRADICTED').length;

    return {
      delivery: {
        tasksCompleted: completed,
        tasksFailed: failed,
        tasksBlocked: blocked,
        totalTasks,
        successRate,
        failureRate,
      },
      quality: {
        reviewBlockRate,
        qaFailureRate,
        regressionRate,
        remediationSuccessRate,
        totalReviews,
        totalQARuns,
      },
      reliability: {
        repeatedFailureCount,
        recurringPatternCount,
        unresolvedContradictionCount,
        blockedProjectCount: blocked > 0 ? 1 : 0,
      },
      workforce,
      dependencies: {
        dependencyBlockedCount: blocked,
        waitingForDependencyCount: 0,
        bottleneckDetected: blocked >= 3 || reviewBlockRate >= 0.5,
      },
      sampleSize: totalTasks + events.length + patterns.length,
      evaluatedAt,
    };
  }

  /**
   * 2. Detect Signals
   */
  public detectSignals(
    metrics: OrganizationalMetricsSummary,
    input: IntelligenceComputeInput
  ): OrganizationalSignal[] {
    const signals: OrganizationalSignal[] = [];
    const { tenantId, projectId } = input;
    const observedAt = metrics.evaluatedAt;

    if (metrics.delivery.failureRate >= 0.3) {
      signals.push({
        id: `sig-fail-rate-${Date.now()}`,
        type: 'EXECUTION_FAILURE_RATE',
        severity: metrics.delivery.failureRate >= 0.8 ? 'CRITICAL' : 'HIGH',
        confidence: metrics.delivery.totalTasks >= 5 ? 'HIGH' : 'MEDIUM',
        value: metrics.delivery.failureRate,
        description: `Taxa de falha de execução elevada (${Math.round(metrics.delivery.failureRate * 100)}%)`,
        provenance: { tenantId, projectId, observedAt },
      });
    }

    if (metrics.quality.reviewBlockRate >= 0.4) {
      signals.push({
        id: `sig-rev-blk-${Date.now()}`,
        type: 'REVIEW_BLOCK_RATE',
        severity: 'HIGH',
        confidence: 'HIGH',
        value: metrics.quality.reviewBlockRate,
        description: `Bloqueios frequentes em code review (${Math.round(metrics.quality.reviewBlockRate * 100)}%)`,
        provenance: { tenantId, projectId, observedAt },
      });
    }

    if (metrics.quality.regressionRate > 0) {
      signals.push({
        id: `sig-reg-rate-${Date.now()}`,
        type: 'REGRESSION_RATE',
        severity: 'CRITICAL',
        confidence: 'HIGH',
        value: metrics.quality.regressionRate,
        description: 'Regressões funcionais detectadas em suítes de testes',
        provenance: { tenantId, projectId, observedAt },
      });
    }

    if (metrics.dependencies.bottleneckDetected) {
      signals.push({
        id: `sig-btnk-${Date.now()}`,
        type: 'BOTTLENECK_DETECTED',
        severity: 'MEDIUM',
        confidence: 'MEDIUM',
        value: { blockedCount: metrics.dependencies.dependencyBlockedCount },
        description: 'Potencial gargalo identificado no fluxo de dependências/revisão',
        provenance: { tenantId, projectId, observedAt },
      });
    }

    if (metrics.reliability.recurringPatternCount > 0) {
      signals.push({
        id: `sig-rep-pat-${Date.now()}`,
        type: 'REPEATED_FAILURE_PATTERN',
        severity: 'MEDIUM',
        confidence: 'HIGH',
        value: metrics.reliability.recurringPatternCount,
        description: `Detectados ${metrics.reliability.recurringPatternCount} padrões recorrentes na organização`,
        provenance: { tenantId, projectId, observedAt },
      });
    }

    return signals;
  }

  /**
   * 3. Analyze Temporal Trends
   */
  public analyzeTrends(
    current: OrganizationalMetricsSummary,
    previous?: Partial<OrganizationalMetricsSummary>
  ): OrganizationalTrend[] {
    const trends: OrganizationalTrend[] = [];

    if (!previous || !previous.delivery || current.delivery.totalTasks < 3) {
      trends.push({
        metricName: 'deliveryTrend',
        direction: 'UNKNOWN',
        currentValue: current.delivery.successRate,
        sampleSize: current.sampleSize,
        reason: 'Amostra insuficiente para cálculo de tendência temporal',
      });
      return trends;
    }

    const prevSuccess = previous.delivery.successRate ?? -1;
    const currSuccess = current.delivery.successRate;

    let dir: TrendDirection = 'STABLE';
    let reason = 'Taxa de sucesso estável em relação ao período anterior';

    if (currSuccess > prevSuccess + 0.1) {
      dir = 'IMPROVING';
      reason = `Taxa de sucesso melhorou de ${prevSuccess} para ${currSuccess}`;
    } else if (currSuccess < prevSuccess - 0.1) {
      dir = 'DEGRADING';
      reason = `Taxa de sucesso degradou de ${prevSuccess} para ${currSuccess}`;
    }

    trends.push({
      metricName: 'deliveryTrend',
      direction: dir,
      currentValue: currSuccess,
      previousValue: prevSuccess,
      sampleSize: current.sampleSize,
      reason,
    });

    return trends;
  }

  /**
   * 4. Evaluate Project Health
   */
  public evaluateProjectHealth(
    metrics: OrganizationalMetricsSummary,
    signals: OrganizationalSignal[]
  ): ProjectHealthStatus {
    if (metrics.sampleSize === 0) return 'UNKNOWN';
    if (metrics.delivery.tasksBlocked >= 3 || signals.some((s) => s.severity === 'CRITICAL')) {
      return 'BLOCKED';
    }
    if (metrics.delivery.failureRate >= 0.4 || signals.some((s) => s.severity === 'HIGH')) {
      return 'AT_RISK';
    }
    if (metrics.delivery.failureRate >= 0.2 || metrics.dependencies.bottleneckDetected) {
      return 'ATTENTION';
    }
    return 'HEALTHY';
  }

  /**
   * 5. Detect Organizational Risks
   */
  public detectRisks(
    signals: OrganizationalSignal[],
    input: IntelligenceComputeInput
  ): OrganizationalRisk[] {
    const risks: OrganizationalRisk[] = [];
    const { tenantId, projectId } = input;
    const now = new Date().toISOString();

    for (const sig of signals) {
      if (sig.severity === 'HIGH' || sig.severity === 'CRITICAL') {
        risks.push({
          id: `risk-${sig.type.toLowerCase()}-${Date.now()}`,
          tenantId,
          projectId,
          riskType: sig.type,
          severity: sig.severity,
          confidence: sig.confidence,
          evidence: [sig.description],
          firstObservedAt: now,
          lastObservedAt: now,
          supportingSignals: [sig.id],
          status: 'ACTIVE',
        });
      }
    }

    return risks;
  }

  /**
   * 6. Generate Insights
   */
  public generateInsights(
    metrics: OrganizationalMetricsSummary,
    signals: OrganizationalSignal[],
    risks: OrganizationalRisk[]
  ): OrganizationalInsight[] {
    const insights: OrganizationalInsight[] = [];
    const now = new Date().toISOString();

    if (risks.length > 0) {
      insights.push({
        id: `ins-risks-${Date.now()}`,
        observation: `Identificados ${risks.length} riscos ativos na organização.`,
        evidence: risks.map((r) => r.riskType),
        interpretation: 'A integridade das entregas pode ser impactada se as falhas recorrentes não forem remediadas.',
        confidence: 'HIGH',
        temporalScope: 'CURRENT_CYCLE',
        affectedAgents: Object.keys(metrics.workforce),
        affectedProjects: [],
        supportingSignals: signals.map((s) => s.id),
      });
    }

    return insights;
  }

  /**
   * 7. Generate Recommendations (Advisory Only)
   */
  public generateRecommendations(
    signals: OrganizationalSignal[],
    risks: OrganizationalRisk[],
    health: ProjectHealthStatus
  ): OrganizationalRecommendation[] {
    const recs: OrganizationalRecommendation[] = [];

    if (health === 'BLOCKED' || health === 'AT_RISK') {
      recs.push({
        id: `rec-health-${Date.now()}`,
        title: 'Revisão Operacional de Bloqueios',
        description: 'O projeto apresenta status crítico ou tarefas bloqueadas que requerem alinhamento.',
        priority: 'HIGH',
        suggestedAction: 'Auditar gargalos de code review e mitigar dependências travadas.',
        requiresHumanDecision: true,
        targetRole: 'chief-of-staff',
      });
    }

    if (signals.some((s) => s.type === 'REGRESSION_RATE')) {
      recs.push({
        id: `rec-qa-reg-${Date.now()}`,
        title: 'Priorizar Correção de Regressão',
        description: 'Regressões em suítes de testes foram detectadas.',
        priority: 'HIGH',
        suggestedAction: 'Executar bateria de testes de regressão e verificar remediação antes do merge.',
        requiresHumanDecision: true,
        targetRole: 'qa-engineer',
      });
    }

    return recs;
  }

  /**
   * 8. Full Evaluation Pipeline
   */
  public evaluateIntelligence(input: IntelligenceComputeInput): OrganizationalIntelligenceResult {
    const metrics = this.computeMetrics(input);
    const signals = this.detectSignals(metrics, input);
    const trends = this.analyzeTrends(metrics, input.previousPeriodMetrics);
    const health = this.evaluateProjectHealth(metrics, signals);
    const risks = this.detectRisks(signals, input);
    const insights = this.generateInsights(metrics, signals, risks);
    const recommendations = this.generateRecommendations(signals, risks, health);

    return {
      metrics,
      signals,
      risks,
      trends,
      insights,
      recommendations,
      projectHealth: health,
      provenance: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        evaluatedAt: metrics.evaluatedAt,
      },
    };
  }
}

export const defaultOrganizationalIntelligenceEngine = new OrganizationalIntelligenceEngine();
