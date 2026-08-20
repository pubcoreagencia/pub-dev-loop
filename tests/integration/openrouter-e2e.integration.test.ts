import { describe, it, expect } from 'vitest';
import { OpenRouterProvider } from '../../src/providers/openrouter.js';
import type { Task } from '../../src/domain.js';

const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim().length > 0);
const enabled = hasApiKey || process.env.RUN_OPENROUTER_E2E === '1';

describe.skipIf(!enabled)('OpenRouter Real E2E Integration Test', () => {
  it('connects to real OpenRouter and queries models endpoint', async () => {
    const provider = new OpenRouterProvider(
      process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
      process.env.OPENROUTER_API_KEY,
    );

    const health = await provider.health();
    expect(health.available).toBe(true);
  });

  it('executes a real completion with ProviderTaskResult validation', async () => {
    const provider = new OpenRouterProvider(
      process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
      process.env.OPENROUTER_API_KEY,
    );

    const task: Task = {
      id: 'TASK-OR-REAL-1',
      project: 'openrouter-e2e',
      repository: 'https://github.com/test/repo.git',
      objective: 'Say hello',
      prompt: 'Respond with exactly: HELLO_OPENROUTER',
      status: 'RUNNING',
      priority: 0,
      worker: null,
      result: null,
      error: null,
      branch: null,
      commitSha: null,
      gitStatus: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await provider.execute(task, process.cwd());
    expect(result.provider).toBe('openrouter');
    expect(result.status).toBe('COMPLETED');
  });
});
