import { describe, it, expect } from 'vitest';
import { OpenRouterProvider } from '../../src/providers/openrouter.js';

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
});
