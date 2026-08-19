import type { AgentProvider } from './providers/types.js';
import type { BaseWorker } from './worker-service.js';
import { RouterWorker } from './router-worker.js';
import { PostgresTaskRepository } from './repository.js';
import { PostgresPrototypeRepository } from './prototype/repository.js';
import { PrototypeEventStream } from './prototype/events.js';
import { PrototypeWorker } from './prototype-worker.js';

export class ModeAwareWorker {
  private readonly prototype: PrototypeWorker;
  private readonly development: BaseWorker;
  private state = 'IDLE';

  constructor(
    tasks: PostgresTaskRepository,
    prototypes: PostgresPrototypeRepository,
    provider: AgentProvider,
    events: PrototypeEventStream,
  ) {
    this.prototype = new PrototypeWorker(tasks, prototypes, provider, events);
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
