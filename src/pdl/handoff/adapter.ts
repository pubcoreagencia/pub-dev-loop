import type { Task, TaskRepository } from '../../domain.js';
import type { PostgresTaskRepository } from '../../repository.js';
import type {
  PdlTaskIngestionPort,
  PdlTaskIngestionRequest,
  PdlTaskIngestionResult,
} from './types.js';
import { TaskIntakeError } from '../../task/intake.js';
import { TaskIntakeService } from '../service/task-intake-service.js';
import { defaultRepositoryAuthorizationPolicy } from '../security/repo-authorization.js';

/**
 * FASE 4.3: Adaptador concreto do PDL para o contrato neutro de ingestão de tarefas.
 * Pertence ao lado PDL: conhece TaskRepository/PostgresTaskRepository e o tipo de domínio Task.
 * Traduz a solicitação de promoção do PP em uma Task canônica na tabela `tasks`.
 */
export class PdlTaskIngestionAdapter implements PdlTaskIngestionPort {
  private readonly intakeService?: TaskIntakeService;

  constructor(
    private readonly tasks: TaskRepository | PostgresTaskRepository,
    intakeService?: TaskIntakeService,
  ) {
    if (intakeService) {
      this.intakeService = intakeService;
    } else if ((tasks as any)?.intakeService) {
      this.intakeService = (tasks as any).intakeService;
    } else if ((tasks as any)?.pool) {
      this.intakeService = new TaskIntakeService((tasks as any).pool);
    }
  }

  async ingest(request: PdlTaskIngestionRequest): Promise<PdlTaskIngestionResult> {
    const auth = defaultRepositoryAuthorizationPolicy.authorize({
      repository: request.repository,
      branch: request.branch,
    });
    if (!auth.authorized) {
      throw new TaskIntakeError('INVALID_TASK', `Repository authorization denied: ${auth.reason}`);
    }

    const existingList = typeof this.tasks.list === 'function' ? await this.tasks.list() : [];
    const existing = existingList.find(t => {
      const res = t.result as Record<string, unknown> | null;
      if (res?.promotionId && res.promotionId === request.promotionId) return true;
      if (t.branch === request.branch) {
        if (res?.prototypeSessionId === request.prototypeSessionId) return true;
        if (t.prototypeSessionId === request.prototypeSessionId) return true;
      }
      return false;
    });

    if (existing) {
      return {
        ...existing,
        id: existing.id,
        taskId: existing.id,
        status: existing.status,
        branch: existing.branch,
        repository: existing.repository,
        prototypeSessionId: existing.prototypeSessionId ?? (existing.result as any)?.prototypeSessionId ?? request.prototypeSessionId,
        result: existing.result,
      };
    }

    if (!this.intakeService) {
      throw new Error('TaskIntakeService dependency missing; direct PDL task creation is prohibited');
    }

    const intakeRes = await this.intakeService.processIntake({
      rawRequest: request.prompt,
      source: 'prototype-promotion',
      project: request.project,
      repository: request.repository,
      priority: request.priority ?? 0,
      executionInstructions: [request.objective],
      acceptanceCriteria: [`Complete prototype promotion for branch ${request.branch}`],
      validationPlan: [`Verify integration of prototype checkpoint ${request.checkpointSha}`],
    });
    const created = intakeRes.task;

    const resultPayload = {
      ...(created.result ?? {}),
      promotionId: request.promotionId,
      prototypeSessionId: request.prototypeSessionId,
      checkpointSha: request.checkpointSha,
    };

    const updated = await this.tasks.update(created.id, {
      branch: request.branch,
      prototypeSessionId: request.prototypeSessionId,
      result: resultPayload,
    });

    const finalTask = updated ?? created;

    return {
      ...finalTask,
      id: finalTask.id,
      taskId: finalTask.id,
      status: finalTask.status,
      branch: finalTask.branch,
      repository: finalTask.repository,
      prototypeSessionId: finalTask.prototypeSessionId,
      result: resultPayload,
    };
  }
}
