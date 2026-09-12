// src/providers/routerConfig.ts
import { resolveModelQueue } from './model-routing-policy.js';

/**
 * Centralized loader for Router provider configuration.
 * Reads environment variables and provides strongly-typed defaults based on the Model Routing Policy.
 */
export interface RouterConfig {
  primaryModel: string; // required
  fallbackModels: string[]; // optional list, order matters
  maxRetries: number; // attempts per model (including the first try)
  baseDelayMs: number; // base delay for exponential backoff
}

export function loadRouterConfig(modelOverride?: string): RouterConfig {
  const envModel = process.env.ROUTER_MODEL?.trim();
  const fallbackRaw = process.env.ROUTER_FALLBACK_MODELS?.trim() ?? '';
  const fallbackEnvModels = fallbackRaw
    ? fallbackRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // Resolve defaults from canonical Model Routing Policy if not overridden by env
  const routing = resolveModelQueue('9router', undefined, {
    modelOverride: modelOverride || envModel || undefined,
    allowEmergency: process.env.ROUTER_ALLOW_EMERGENCY === 'true',
  });

  const primary = modelOverride?.trim() || envModel || routing.primaryModel || 'gemini/gemini-3.7-flash';
  const fallbackModels = fallbackEnvModels.length > 0 ? fallbackEnvModels : routing.fallbackModels;

  const maxRetries = Number(process.env.ROUTER_MAX_RETRIES ?? 2);
  const baseDelayMs = Number(process.env.ROUTER_RETRY_BASE_DELAY_MS ?? 500);

  return {
    primaryModel: primary,
    fallbackModels,
    maxRetries: Math.max(1, maxRetries), // at least 1 attempt
    baseDelayMs: Math.max(0, baseDelayMs),
  };
}
