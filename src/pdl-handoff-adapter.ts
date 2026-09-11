import type { Task, TaskRepository } from './domain.js';
import type { PostgresTaskRepository } from './repository.js';
import type {
  PdlTaskIngestionPort,
  PdlTaskIngestionRequest,
  PdlTaskIngestionResult,
} from './pp/handoff/handoff.js';

/**
 * FASE 4.3: Adaptador concreto do PDL para o contrato neutro de ingestão de tarefas.
 * Pertence ao lado PDL: conhece TaskRepository/PostgresTaskRepository e o tipo de domínio Task.
 * Traduz a solicitação de promoção do PP em uma Task canônica na tabela `tasks`.
 */
export class PdlTaskIngestionAdapter implements PdlTaskIngestionPort {
  constructor(private readonly tasks: TaskRepository | PostgresTaskRepository) {}

  async ingest(request: PdlTaskIngestionRequest): Promise<PdlTaskIngestionResult> {
    const existingList = await this.tasks.list();
    const existing = existingList.find(t =>
      t.branch === request.branch &&
      ((((t.result as Record<string, unknown> | null))?.promotionId === request.promotionId) ||
       (((t.result as Record<string, unknown> | null))?.prototypeSessionId === request.prototypeSessionId) ||
       /Prototype/i.test(t.objective))
    );

    if (existing) {
      return {
        ...existing,
        id: existing.id,
        taskId: existing.id,
        status: existing.status,
        branch: existing.branch,
        repository: existing.repository,
        prototypeSessionId: existing.prototypeSessionId,
        result: existing.result,
      };
    }

    const created = await this.tasks.create({
      project: request.project,
      repository: request.repository,
      objective: request.objective,
      prompt: request.prompt,
      priority: request.priority ?? 0,
    });

    const resultPayload = {
      ...(created.result ?? {}),
      promotionId: request.promotionId,
      prototypeSessionId: request.prototypeSessionId,
      checkpointSha: request.checkpointSha,
    };

    const updated = await this.tasks.update(created.id, {
      branch: request.branch,
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
