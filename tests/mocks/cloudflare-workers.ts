export class DurableObject {
  protected ctx: any;
  protected env: any;
  constructor(ctx: any, env: any) {
    this.ctx = ctx;
    this.env = env;
  }
}

export class WorkerEntrypoint {
  protected ctx: any;
  protected env: any;
  constructor(ctx: any, env: any) {
    this.ctx = ctx;
    this.env = env;
  }
}
