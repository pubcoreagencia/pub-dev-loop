import { describe, it, expect, afterEach, vi } from 'vitest';
import { RouterWorker } from '../src/router-worker.js';
import { CodexWorker, BaseWorker } from '../src/worker-service.js';
import { ModeAwareWorker } from '../src/mode-aware-worker.js';
import { execSync } from 'node:child_process';

/**
 * PHASE 2: TESTS PROVING REAL PRODUCTION ENTRYPOINT USES TASK-000030 FEATURES
 *
 * Critically: prove that worker.ts → createProductionWorker()
 * returns a ModeAwareWorker (with development=RouterWorker containing TASK-000030 retry/fallback) when
 * AGENT_PROVIDER is set, NOT CodexWorker (which lacks retry).
 *
 * TASK-000030 protection coverage = COMPLETE only when the real entrypoint
 * uses RouterWorker.
 */

// Mock git clone to avoid network calls in test3
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof execSync>();
  return {
    ...actual,
    execSync: vi.fn((cmd: string, options: any) => {
      // Allow git config commands through
      if (cmd.startsWith('git init') || cmd.startsWith('git config') || cmd.startsWith('git add') || cmd.startsWith('git commit') || cmd.startsWith('git rev-parse') || cmd.startsWith('git status') || cmd.startsWith('git checkout')) {
        return Buffer.from('');
      }
      // Simulate successful git clone
      if (cmd.startsWith('git clone')) {
        return Buffer.from('');
      }
      return Buffer.from('');
    }),
  };
});

describe('PRODUCTION ENTRYPOINT — worker.ts createProductionWorker()', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore env for every test
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('test1: AGENT_PROVIDER=9router → ModeAwareWorker with RouterWorker (TASK-000030 active)', async () => {
    process.env.AGENT_PROVIDER = '9router';
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

    // Import dynamically so env is set before module evaluation
    const mod = await import('../src/worker.js');
    const w = mod.createProductionWorker();

    // CRITICAL ASSERTION: must be ModeAwareWorker wrapping RouterWorker, not CodexWorker
    expect(w).toBeInstanceOf(ModeAwareWorker);
    expect(w).not.toBeInstanceOf(CodexWorker);

    if (w instanceof ModeAwareWorker) {
      expect(w.development).toBeInstanceOf(RouterWorker);
      // PROVE TASK-000030 features are present on the production development worker
      const proto = Object.getPrototypeOf(w.development);
      expect(proto.constructor.name).toBe('RouterWorker');
      expect(proto.executeWithRetry).not.toBe(BaseWorker.prototype.executeWithRetry);
    }
  });

  it('test2: no AGENT_PROVIDER → CodexWorker (mock/codex path)', async () => {
    delete process.env.AGENT_PROVIDER;
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
    process.env.AGENT_MODE = 'mock'; // createAgent() defaults to mock

    const mod = await import('../src/worker.js');
    const w = mod.createProductionWorker();

    expect(w).toBeInstanceOf(CodexWorker);
    expect(w).not.toBeInstanceOf(ModeAwareWorker);
    expect(w).not.toBeInstanceOf(RouterWorker);
  });

  it('test3: AGENT_PROVIDER=codex-api → ModeAwareWorker with RouterWorker (provider path, not CLI)', async () => {
    process.env.AGENT_PROVIDER = 'codex-api';
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

    const mod = await import('../src/worker.js');
    const w = mod.createProductionWorker();

    // codex-api is a provider → should use ModeAwareWorker with RouterWorker (TASK-000030 active)
    expect(w).toBeInstanceOf(ModeAwareWorker);
    if (w instanceof ModeAwareWorker) {
      expect(w.development).toBeInstanceOf(RouterWorker);
    }
  });

  it('test4: AGENT_PROVIDER=mock → ModeAwareWorker with RouterWorker (mock provider, but still TASK-000030 path)', async () => {
    process.env.AGENT_PROVIDER = 'mock';
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

    const mod = await import('../src/worker.js');
    const w = mod.createProductionWorker();

    // Even mock provider goes through ModeAwareWorker with RouterWorker — same code path as production
    expect(w).toBeInstanceOf(ModeAwareWorker);
    expect(w).not.toBeInstanceOf(CodexWorker);
    if (w instanceof ModeAwareWorker) {
      expect(w.development).toBeInstanceOf(RouterWorker);
    }
  });
});
