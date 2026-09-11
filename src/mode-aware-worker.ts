import type { AgentProvider } from './providers/types.js';
import type { BaseWorker } from './worker-service.js';
import { RouterWorker } from './router-worker.js';
import { PostgresTaskRepository } from './repository.js';
import { PostgresPrototypeRepository } from './pp/persistence/repository.js';
import { PostgresPpTaskRepository } from './pp/persistence/task-repository.js';
import type { PpTaskRepository } from './pp/domain/domain.js';
import type { PrototypeEventPublisher } from './pp/events/events.js';
import { PrototypeWorker } from './pp/worker/prototype-worker.js';

/**
 * @deprecated [DEPRECATED na Fase 2 do Desacoplamento PDL × PP]
 * ModeAwareWorker acoplava rigidamente o ciclo de vida do PP (PrototypeWorker)
 * com o PDL (RouterWorker).
 * 
 * Utilize os entrypoints dedicados e desacoplados:
 * - Para o PUB Prototype: `src/pp/worker/entry.ts` (npm run pp:worker)
 * - Para o PUB Development Loop: `src/pdl/worker/entry.ts` (npm run pdl:worker)
 */
export class ModeAwareWorker {
  readonly prototype: PrototypeWorker;
  readonly development: RouterWorker;
  private state = 'IDLE';

  constructor(
    tasks: PostgresTaskRepository,
    prototypes: PostgresPrototypeRepository,
    provider: AgentProvider,
    events: PrototypeEventPublisher,
    ppTasks?: PpTaskRepository,
  ) {
    const ppRepo = ppTasks ?? new PostgresPpTaskRepository((tasks as any).pool);
    this.prototype = new PrototypeWorker(ppRepo, prototypes, provider, events);
    this.development = new RouterWorker(tasks, provider, 'router');
  }

  status(): string { return this.state; }

  async executeOnce(): Promise<boolean> {
    this.state = 'PROTOTYPE';
    const prototypeWorked = await this.prototype.executeOnce();
    if (prototypeWorked) {
      this.state = 'IDLE';
      return true;
    }

    this.state = 'DEVELOPMENT';
    const developmentWorked = await this.development.executeOnce();
    this.state = 'IDLE';
    return developmentWorked;
  }

  async cancel(): Promise<void> {
    await this.development.cancel();
    this.state = 'CANCELLED';
  }
}
