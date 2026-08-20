import type { Pool } from 'pg';
import type { Task } from '../domain.js';
import type { PrototypeSession, PrototypePromotion } from './domain.js';
import type { PrototypeEventPublisher } from './events.js';

export interface PrototypeHandoffInput {
  sessionId: string;
  objective?: string;
  prompt?: string;
  priority?: number;
}

export interface PrototypeHandoffResult {
  session: PrototypeSession;
  promotion: PrototypePromotion;
  task: Task;
  mode: 'DEVELOPMENT';
}

export class PrototypeHandoffService {
  constructor(
    private readonly tasks: { create(input: any): Promise<Task>; list(): Promise<Task[]>; get(id: string): Promise<Task | null>; update(id: string, patch: Partial<Task>): Promise<Task | null>; },
    private readonly prototypes: { getSession(id: string): Promise<PrototypeSession | null>; promoteSession(id: string): Promise<PrototypeSession | null>; createPromotion(input: Omit<PrototypePromotion, 'id'>): Promise<PrototypePromotion>; getPromotion?(sessionId: string): Promise<PrototypePromotion | null>; },
    private readonly events: PrototypeEventPublisher,
  ) {}

  async execute(input: PrototypeHandoffInput): Promise<PrototypeHandoffResult> {
    const session = await this.prototypes.getSession(input.sessionId);
    if (!session) {
      throw new Error('NOT_FOUND: prototype session not found');
    }

    if (!session.lastCheckpointSha) {
      throw new Error('CONFLICT: session must have a valid lastCheckpointSha to be promoted');
    }

    if (!session.branch || !session.repository) {
      throw new Error('CONFLICT: session must have repository and branch configured');
    }

    const promoted = await this.prototypes.promoteSession(session.id);
    if (!promoted) {
      const maybeExistingPromotion = typeof this.prototypes.getPromotion === 'function'
        ? await this.prototypes.getPromotion(session.id)
        : null;
      if (maybeExistingPromotion) {
        const maybeExistingTask = 'list' in this.tasks
          ? await this.tasks.list().then(list =>
              list.find(t => t.branch === session.branch && t.prototypeSessionId === null && /Prototype/i.test(t.objective)),
            )
          : null;
        if (maybeExistingTask) {
          return {
            session: { ...session, status: 'PROMOTED', mode: 'DEVELOPMENT' },
            promotion: maybeExistingPromotion,
            task: maybeExistingTask,
            mode: 'DEVELOPMENT',
          };
        }
      }
      if (!['READY', 'APPROVED'].includes(session.status)) {
        throw new Error(`CONFLICT: session status ${session.status} cannot be promoted. Must be READY or APPROVED.`);
      }
      throw new Error('CONFLICT: session could not be promoted');
    }

    const promotion = await this.prototypes.createPromotion({
      sessionId: promoted.id,
      fromMode: 'PROTOTYPE',
      toMode: 'DEVELOPMENT',
      repository: promoted.repository,
      branch: promoted.branch,
      checkpointSha: promoted.lastCheckpointSha!,
      promotedAt: new Date(),
    });

    const {
      objective = `Development handoff from Prototype ${promoted.project}`,
      prompt = `Continue development from approved prototype (${promoted.branch} @ ${promoted.lastCheckpointSha})`,
      priority = 0,
    } = input;

    const devTask = await this.tasks.create({
      project: promoted.project,
      repository: promoted.repository,
      objective,
      prompt,
      priority,
    });

    const updatedDevTask = await this.tasks.update(devTask.id, {
      branch: promoted.branch,
      result: {
        ...(devTask.result ?? {}),
        promotionId: promotion.id,
        prototypeSessionId: promoted.id,
        checkpointSha: promoted.lastCheckpointSha,
      } as Record<string, unknown>,
    });

    const taskResult = { ...(updatedDevTask?.result ?? devTask.result ?? {}), promotionId: promotion.id, prototypeSessionId: promoted.id, checkpointSha: promoted.lastCheckpointSha } as Record<string, unknown>;

    this.events.emit({
      sessionId: promoted.id,
      type: 'PROMOTED_TO_DEVELOPMENT',
      payload: {
        sessionId: promoted.id,
        promotionId: promotion.id,
        taskId: devTask.id,
        branch: promoted.branch,
        checkpointSha: promoted.lastCheckpointSha,
        repository: promoted.repository,
      },
    });

    return {
      session: promoted,
      promotion,
      task: { ...(updatedDevTask ?? devTask), result: taskResult },
      mode: 'DEVELOPMENT',
    };
  }
}
