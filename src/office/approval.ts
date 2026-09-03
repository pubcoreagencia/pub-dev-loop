import { OfficeEventBus, defaultOfficeEventBus } from './events.js';

export type ApprovalType = 'CRITICAL_ARCHITECTURE_CHANGE' | 'PRODUCTION_PROMOTION' | 'SECURITY_OVERRIDE';
export type ApprovalStatus = 'PENDING' | 'GRANTED' | 'REJECTED';

export interface ApprovalRequestInput {
  planId?: string;
  taskId?: string;
  project?: string;
  type: ApprovalType;
  title: string;
  rationale: string;
  requestedBy: string;
}

export interface ApprovalItem {
  id: string;
  planId?: string;
  taskId?: string;
  project: string;
  type: ApprovalType;
  title: string;
  rationale: string;
  requestedBy: string;
  status: ApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNotes?: string;
  createdAt: string;
}

export class ApprovalManager {
  private approvals = new Map<string, ApprovalItem>();

  constructor(private readonly eventBus: OfficeEventBus = defaultOfficeEventBus) {}

  requestApproval(input: ApprovalRequestInput): ApprovalItem {
    const id = `appr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const project = input.project || 'pub-dev-loop';

    const item: ApprovalItem = {
      id,
      planId: input.planId,
      taskId: input.taskId,
      project,
      type: input.type,
      title: input.title,
      rationale: input.rationale,
      requestedBy: input.requestedBy,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    this.approvals.set(id, item);

    this.eventBus.publish({
      type: 'APPROVAL_REQUESTED',
      actorId: input.requestedBy,
      targetId: 'ceo',
      planId: input.planId,
      taskId: input.taskId,
      project,
      summary: `Aprovação solicitada ao CEO: ${input.title}`,
      payload: {
        approvalId: id,
        type: input.type,
        rationale: input.rationale,
      },
    });

    return item;
  }

  decideApproval(
    approvalId: string,
    decision: 'GRANT' | 'REJECT',
    userRoleOrPrincipal: string | { role: string; userId?: string; tenantId?: string },
    notes?: string,
    expectedProject?: string
  ): ApprovalItem {
    const role = typeof userRoleOrPrincipal === 'string' ? userRoleOrPrincipal : userRoleOrPrincipal.role;
    const userId = typeof userRoleOrPrincipal === 'string' ? 'ceo' : userRoleOrPrincipal.userId || 'ceo';
    const tenantId = typeof userRoleOrPrincipal === 'string' ? undefined : userRoleOrPrincipal.tenantId;

    // 1. Validação estrita de autoridade: Somente o CEO pode aprovar
    if (!role || role.toUpperCase() !== 'CEO') {
      throw new Error('UNAUTHORIZED: Apenas o CEO possui autoridade para aprovar ou rejeitar decisões de diretoria.');
    }

    const item = this.approvals.get(approvalId);
    if (!item) {
      throw new Error(`NOT_FOUND: Solicitação de aprovação '${approvalId}' não encontrada.`);
    }

    // 2. Tenant / Project Isolation
    if (expectedProject && item.project !== expectedProject) {
      throw new Error(`FORBIDDEN_TENANT: Solicitação '${approvalId}' não pertence ao projeto '${expectedProject}'.`);
    }

    if (tenantId && item.project !== tenantId && tenantId !== 'global') {
      throw new Error(`FORBIDDEN_TENANT: Identidade não possui autorização no tenant '${item.project}'.`);
    }

    // 3. Idempotência / Status check
    if (item.status !== 'PENDING') {
      throw new Error(`CONFLICT: Solicitação '${approvalId}' já foi decidida anteriormente (${item.status}).`);
    }

    item.status = decision === 'GRANT' ? 'GRANTED' : 'REJECTED';
    item.decidedBy = userId;
    item.decidedAt = new Date().toISOString();
    item.decisionNotes = notes;

    const eventType = decision === 'GRANT' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED';
    const summary = decision === 'GRANT'
      ? `CEO APROVOU: ${item.title}`
      : `CEO REJEITOU: ${item.title}`;

    this.eventBus.publish({
      type: eventType,
      actorId: 'ceo',
      targetId: item.requestedBy,
      planId: item.planId,
      taskId: item.taskId,
      project: item.project,
      summary,
      payload: {
        approvalId,
        decision,
        notes,
      },
    });

    return item;
  }

  getApproval(approvalId: string): ApprovalItem | undefined {
    return this.approvals.get(approvalId);
  }

  listApprovals(project?: string): ApprovalItem[] {
    const list = Array.from(this.approvals.values());
    if (project) {
      return list.filter((a) => a.project === project);
    }
    return list;
  }

  clear(): void {
    this.approvals.clear();
  }
}

export const defaultApprovalManager = new ApprovalManager();
