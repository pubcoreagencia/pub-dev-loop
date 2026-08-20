// src/providers/openrouterConfig.ts
/**
 * Centralized loader for OpenRouter provider configuration.
 * Reads environment variables and provides strongly-typed defaults.
 */
export interface OpenRouterConfig {
  primaryModel: string;
  fallbackModels: string[];
  maxRetries: number;
  baseDelayMs: number;
}

export function loadOpenRouterConfig(modelOverride?: string): OpenRouterConfig {
  const primary = modelOverride?.trim() || process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free';
  const fallbackRaw = process.env.OPENROUTER_FALLBACK_MODELS?.trim() ?? '';
  const fallbackModels = fallbackRaw
    ? fallbackRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const maxRetries = Number(process.env.OPENROUTER_MAX_RETRIES ?? 2);
  const baseDelayMs = Number(process.env.OPENROUTER_RETRY_BASE_DELAY_MS ?? 500);

  return {
    primaryModel: primary,
    fallbackModels,
    maxRetries: Math.max(1, maxRetries),
    baseDelayMs: Math.max(0, baseDelayMs),
  };
}
