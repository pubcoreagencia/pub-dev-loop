// src/providers/model-registry.ts

export type ModelProviderKind = '9router' | 'openrouter';

export type ModelTierName =
  | 'BEST_FREE'
  | 'FALLBACK_2'
  | 'FALLBACK_3'
  | 'FAST_LIGHT'
  | 'EMERGENCY';

export interface ModelRegistryEntry {
  provider: ModelProviderKind;
  modelId: string;
  tier: ModelTierName;
  priority: number;
  capabilities: string[];
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  supportsLongContext: boolean;
  contextWindow: number;
  codingScore?: number;
  reasoningScore?: number;
  reliabilityScore: number;
  enabled: boolean;
  cooldownMs: number;
  maxRetries: number;
  notes: string;
}

/**
 * Verified canonical free models for 9Router (endpoint: /v1/models on 9Router cloud).
 * Prioritization: Coding / Agent Capability > Reasoning > Tool Calling > Reliability > Context > Latency > Cost.
 */
export const NINE_ROUTER_FREE_MODELS: ModelRegistryEntry[] = [
  {
    provider: '9router',
    modelId: 'gemini/gemini-3.7-flash',
    tier: 'BEST_FREE',
    priority: 1,
    capabilities: ['coding', 'agent', 'tool_calling', 'reasoning', 'planning', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsLongContext: true,
    contextWindow: 1048576,
    codingScore: 95,
    reasoningScore: 95,
    reliabilityScore: 90,
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Top tier reasoning and coding model with 1M context window',
  },
  {
    provider: '9router',
    modelId: 'gemini/gemini-3.6-flash',
    tier: 'FALLBACK_2',
    priority: 2,
    capabilities: ['coding', 'agent', 'tool_calling', 'reasoning', 'planning', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsLongContext: true,
    contextWindow: 1048576,
    codingScore: 90,
    reasoningScore: 90,
    reliabilityScore: 92,
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'High reliability fallback coding model with 1M context window',
  },
  {
    provider: '9router',
    modelId: 'kc/cohere/north-mini-code:free',
    tier: 'FALLBACK_3',
    priority: 3,
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 262144,
    codingScore: 86,
    reasoningScore: 80,
    reliabilityScore: 88,
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Specialized code completion and agent model',
  },
  {
    provider: '9router',
    modelId: 'kc/poolside/laguna-s-2.1:free',
    tier: 'FALLBACK_3',
    priority: 4,
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 262144,
    codingScore: 85,
    reasoningScore: 80,
    reliabilityScore: 85,
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Agentic coding model',
  },
  {
    provider: '9router',
    modelId: 'gemini/gemini-3.5-flash-lite',
    tier: 'FAST_LIGHT',
    priority: 5,
    capabilities: ['coding', 'agent', 'tool_calling', 'reasoning', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: true,
    supportsLongContext: true,
    contextWindow: 1048576,
    codingScore: 82,
    reasoningScore: 80,
    reliabilityScore: 88,
    enabled: true,
    cooldownMs: 30000,
    maxRetries: 2,
    notes: 'Ultra-low latency lightweight coding and tool-calling model',
  },
  {
    provider: '9router',
    modelId: 'openrouter/openrouter/free',
    tier: 'EMERGENCY',
    priority: 6,
    capabilities: ['coding', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: false,
    contextWindow: 200000,
    codingScore: 70,
    reasoningScore: 70,
    reliabilityScore: 75,
    enabled: true,
    cooldownMs: 120000,
    maxRetries: 1,
    notes: 'Dynamic free router pool on 9Router - emergency fallback only',
  },
  {
    provider: '9router',
    modelId: 'kc/kilo-auto/free',
    tier: 'EMERGENCY',
    priority: 7,
    capabilities: ['coding', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: false,
    contextWindow: 131072,
    codingScore: 65,
    reasoningScore: 65,
    reliabilityScore: 70,
    enabled: true,
    cooldownMs: 120000,
    maxRetries: 1,
    notes: 'Community free pool endpoint - emergency fallback only',
  },
];

/**
 * Verified canonical free models for OpenRouter (endpoint: https://openrouter.ai/api/v1/models).
 * Prioritization: Coding / Agent Capability > Reasoning > Tool Calling > Reliability > Context > Latency > Cost.
 */
export const OPENROUTER_FREE_MODELS: ModelRegistryEntry[] = [
  {
    provider: 'openrouter',
    modelId: 'cohere/north-mini-code:free',
    tier: 'BEST_FREE',
    priority: 1,
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 262144,
    codingScore: 88,
    reasoningScore: 82,
    reliabilityScore: 90,
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Best dedicated code agent model on OpenRouter free tier',
  },
  {
    provider: 'openrouter',
    modelId: 'poolside/laguna-s-2.1:free',
    tier: 'FALLBACK_2',
    priority: 2,
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 262144,
    codingScore: 85,
    reasoningScore: 80,
    reliabilityScore: 86,
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Agentic coding and file editing model',
  },
  {
    provider: 'openrouter',
    modelId: 'google/gemma-4-31b-it:free',
    tier: 'FALLBACK_3',
    priority: 3,
    capabilities: ['coding', 'reasoning', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 262144,
    codingScore: 82,
    reasoningScore: 85,
    reliabilityScore: 85,
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Strong instruction following and general reasoning',
  },
  {
    provider: 'openrouter',
    modelId: 'nvidia/nemotron-3.5-lightning:free',
    tier: 'FALLBACK_3',
    priority: 4,
    capabilities: ['coding', 'reasoning', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 1048576,
    codingScore: 80,
    reasoningScore: 84,
    reliabilityScore: 80,
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: '1M context window reasoning model',
  },
  {
    provider: 'openrouter',
    modelId: 'thinkingmachines/inkling-small:free',
    tier: 'FAST_LIGHT',
    priority: 5,
    capabilities: ['coding', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 262144,
    codingScore: 75,
    reasoningScore: 75,
    reliabilityScore: 85,
    enabled: true,
    cooldownMs: 30000,
    maxRetries: 2,
    notes: 'Fast lightweight model for simpler tasks',
  },
  {
    provider: 'openrouter',
    modelId: 'openrouter/free',
    tier: 'EMERGENCY',
    priority: 6,
    capabilities: ['coding', 'reasoning', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: false,
    contextWindow: 200000,
    codingScore: 70,
    reasoningScore: 70,
    reliabilityScore: 70,
    enabled: true,
    cooldownMs: 120000,
    maxRetries: 1,
    notes: 'Dynamic community free router pool - emergency fallback only',
  },
];

/**
 * Retrieve model entry from registry by provider and model identifier.
 */
export function getModelRegistryEntry(
  provider: ModelProviderKind,
  modelId: string
): ModelRegistryEntry | undefined {
  const norm = modelId.trim().toLowerCase();
  const catalog = provider === '9router' ? NINE_ROUTER_FREE_MODELS : OPENROUTER_FREE_MODELS;
  return catalog.find(m => m.modelId.toLowerCase() === norm);
}

/**
 * Return all registered models for a given provider.
 */
export function getRegisteredModels(provider: ModelProviderKind): ModelRegistryEntry[] {
  return provider === '9router' ? [...NINE_ROUTER_FREE_MODELS] : [...OPENROUTER_FREE_MODELS];
}
