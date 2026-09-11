import { describe, it, expect } from 'vitest';
import { Pool } from 'pg';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPdlWorkerDaemon } from '../src/pdl/worker/entry.js';
import { PdlCorrectionWorker } from '../src/pdl/worker/correction-worker.js';
import { createPdlApp } from '../src/pdl/api/entry.js';
import { createProductionWorker } from '../src/worker.js';

describe('Phase 3D Step 4 — Runtime Decoupling', () => {
  const fakePool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({
      query: async () => ({ rows: [] }),
      release: () => {},
      on: () => {},
    }),
  } as unknown as Pool;

  function getRoutes(app: any): string[] {
    const routes: string[] = [];
    const stack = app.router?.stack || app._router?.stack || [];
    stack.forEach((layer: any) => {
      if (layer.route?.path) {
        if (Array.isArray(layer.route.path)) {
          routes.push(...layer.route.path);
        } else {
          routes.push(layer.route.path);
        }
      }
    });
    return routes;
  }

  it('1. createPdlWorkerDaemon creates PdlCorrectionWorker without ModeAwareWorker or PrototypeWorker', () => {
    process.env.AGENT_PROVIDER = 'mock';
    const worker = createPdlWorkerDaemon(fakePool);

    expect(worker).toBeInstanceOf(PdlCorrectionWorker);
    expect((worker as any).prototype).toBeUndefined();
  });

  it('2. PP worker entrypoint is completely decommissioned from PDL', () => {
    const ppWorkerPath = resolve(process.cwd(), 'src', 'pp', 'worker', 'entry.ts');
    expect(existsSync(ppWorkerPath)).toBe(false);
  });

  it('3. createPdlApp does not mount any /prototype routes', () => {
    const app = createPdlApp(fakePool);
    const routes = getRoutes(app);

    const hasPrototypeRoute = routes.some(r => r.startsWith('/prototype'));
    expect(hasPrototypeRoute).toBe(false);
  });

  it('4. PP API entrypoint is completely decommissioned from PDL', () => {
    const ppApiPath = resolve(process.cwd(), 'src', 'pp', 'api', 'entry.ts');
    expect(existsSync(ppApiPath)).toBe(false);
  });

  it('5. createProductionWorker supports dedicated PDL mode via WORKER_MODE=pdl', () => {
    process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/testdb';
    process.env.AGENT_PROVIDER = 'mock';
    process.env.WORKER_MODE = 'pdl';

    const worker = createProductionWorker();
    expect(worker).toBeInstanceOf(PdlCorrectionWorker);

    delete process.env.WORKER_MODE;
  });
});
