// src/providers/model-registry.ts

export type ModelProviderKind = '9router' | 'openrouter';

export type ModelTierName =
  | 'BEST_FREE'
  | 'FREE_FALLBACK_2'
  | 'FREE_FALLBACK_3'
  | 'FREE_FAST'
  | 'FREE_EMERGENCY';

export type FreeStatus = 'VERIFIED_FREE' | 'PAID_MODEL' | 'UNKNOWN_PRICING';

export type ProviderRouteType = '9router:kc' | '9router:openrouter' | 'openrouter:direct';
export type QuotaState = 'AVAILABLE' | 'EXHAUSTED' | 'UNKNOWN';
export type OperationalTier = 'PRIMARY' | 'SECONDARY' | 'TERTIARY' | 'QUATERNARY' | 'EMERGENCY';

export interface ModelPricingEvidence {
  promptPrice: string; // Must be exactly "0"
  completionPrice: string; // Must be exactly "0"
  evidenceSource: string;
  verifiedDate: string;
}

export interface ModelRegistryEntry {
  provider: ModelProviderKind;
  modelId: string;
  underlyingModelFamily: string;
  providerRoute: ProviderRouteType;
  tier: ModelTierName;
  priority: number;
  freeStatus: FreeStatus;
  pricingEvidence: ModelPricingEvidence;
  capabilities: string[];
  supportsTools: boolean;
  supportsStructuredOutput: boolean;
  supportsLongContext: boolean;
  contextWindow: number;
  qualityScore: number;
  codingScore?: number;
  reasoningScore?: number;
  reliabilityScore: number;
  upstreamQuotaObserved?: boolean;
  quotaState?: QuotaState;
  enabled: boolean;
  cooldownMs: number;
  maxRetries: number;
  notes: string;
}

/**
 * BEST_FREE_PROVEN definition:
 * The single best empirically proven FREE candidate in the current benchmark universe.
 * Strictly scoped to the empirical benchmark conducted on 2026-09-12.
 */
export const BEST_FREE_PROVEN = 'kc/cohere/north-mini-code:free';
export const BEST_FREE_SCOPE = 'best empirically proven FREE candidate in the current benchmark universe';

/**
 * MODEL_QUALITY_RANK:
 * Ranks models strictly by agentic intelligence and empirical benchmark score (0 to 100),
 * decoupled from route availability or upstream quota constraints.
 */
export interface ModelQualityRankEntry {
  rank: number;
  modelId: string;
  underlyingModelFamily: string;
  empiricalScore: number;
  notes: string;
}

export const EMPIRICAL_SCORES = {
  'kc/cohere/north-mini-code:free': 99.10,
  'kc/kilo-auto/free': 93.80,
  'kc/nvidia/nemotron-3.5-lightning:free': 83.05,
  'openrouter/cohere/north-mini-code:free': 82.70,
  'openrouter/openrouter/free': 81.55,
} as const;

export const MODEL_QUALITY_RANK: ModelQualityRankEntry[] = [
  {
    rank: 1,
    modelId: 'kc/cohere/north-mini-code:free',
    underlyingModelFamily: 'cohere/north-mini-code',
    empiricalScore: 99.10,
    notes: 'Rank 1 Quality: 100% coding, 100% reasoning/debugging, 0 protocol errors, 15.9s avg latency',
  },
  {
    rank: 2,
    modelId: 'kc/kilo-auto/free',
    underlyingModelFamily: 'kilo-auto',
    empiricalScore: 93.80,
    notes: 'Rank 2 Quality: 100% reasoning/debugging, passed coding unit tests, 31.8s avg latency',
  },
  {
    rank: 3,
    modelId: 'kc/nvidia/nemotron-3.5-lightning:free',
    underlyingModelFamily: 'nvidia/nemotron-3.5-lightning',
    empiricalScore: 83.05,
    notes: 'Rank 3 Quality: passed coding tests, slow execution (40.8s avg), low tool calling in debugging',
  },
  {
    rank: 4,
    modelId: 'openrouter/cohere/north-mini-code:free',
    underlyingModelFamily: 'cohere/north-mini-code',
    empiricalScore: 82.70,
    notes: 'Rank 4 Quality: Fast coding execution (8.9s avg), penalized by OpenRouter upstream daily quota lockout',
  },
  {
    rank: 5,
    modelId: 'openrouter/openrouter/free',
    underlyingModelFamily: 'openrouter/free',
    empiricalScore: 81.55,
    notes: 'Rank 5 Quality: Dynamic community router pool, penalized by OpenRouter upstream daily quota lockout',
  },
];

/**
 * ROUTE_OPERATIONAL_RANK:
 * Canonical operational hierarchy taking into account both model intelligence
 * and route operational availability (e.g. bypassing upstream 50 req/day quota).
 */
export interface RouteOperationalRankEntry {
  operationalRank: number;
  operationalTier: OperationalTier;
  modelId: string;
  providerRoute: ProviderRouteType;
  underlyingModelFamily: string;
  upstreamQuotaObserved: boolean;
  empiricalScore: number;
  priority: number;
  notes: string;
}

export const CANONICAL_OPERATIONAL_POLICY: RouteOperationalRankEntry[] = [
  {
    operationalRank: 1,
    operationalTier: 'PRIMARY',
    modelId: 'kc/cohere/north-mini-code:free',
    providerRoute: '9router:kc',
    underlyingModelFamily: 'cohere/north-mini-code',
    upstreamQuotaObserved: false,
    empiricalScore: 99.10,
    priority: 1,
    notes: 'PRIMARY FREE: Highest empirical score (99.10), direct KC route with no OpenRouter 50 req/day lockout',
  },
  {
    operationalRank: 2,
    operationalTier: 'SECONDARY',
    modelId: 'kc/kilo-auto/free',
    providerRoute: '9router:kc',
    underlyingModelFamily: 'kilo-auto',
    upstreamQuotaObserved: false,
    empiricalScore: 93.80,
    priority: 2,
    notes: 'SECONDARY FREE: Proven fast debugging & multi-turn (93.80), direct KC route with no OpenRouter lockout',
  },
  {
    operationalRank: 3,
    operationalTier: 'TERTIARY',
    modelId: 'kc/nvidia/nemotron-3.5-lightning:free',
    providerRoute: '9router:kc',
    underlyingModelFamily: 'nvidia/nemotron-3.5-lightning',
    upstreamQuotaObserved: false,
    empiricalScore: 83.05,
    priority: 3,
    notes: 'TERTIARY FREE: Solid code generation, higher latency (40.8s), direct KC route',
  },
  {
    operationalRank: 4,
    operationalTier: 'QUATERNARY',
    modelId: 'openrouter/cohere/north-mini-code:free',
    providerRoute: '9router:openrouter',
    underlyingModelFamily: 'cohere/north-mini-code',
    upstreamQuotaObserved: true,
    empiricalScore: 82.70,
    priority: 4,
    notes: 'QUATERNARY FREE: Identical model family as primary, but route subject to UPSTREAM_QUOTA_OBSERVED',
  },
  {
    operationalRank: 5,
    operationalTier: 'EMERGENCY',
    modelId: 'openrouter/openrouter/free',
    providerRoute: '9router:openrouter',
    underlyingModelFamily: 'openrouter/free',
    upstreamQuotaObserved: true,
    empiricalScore: 81.55,
    priority: 5,
    notes: 'EMERGENCY FREE: Dynamic community pool, route subject to UPSTREAM_QUOTA_OBSERVED',
  },
];

/**
 * Verified canonical free models for 9Router (endpoint: /v1/models on 9Router cloud).
 * STRICT RULE: Only models with verified 0/0 pricing through upstream free pools enter this catalog.
 * Commercial Gemini and any model with unknown or non-zero token costs are strictly excluded.
 */
export const NINE_ROUTER_REAL_FREE_MODELS: ModelRegistryEntry[] = [
  {
    provider: '9router',
    modelId: 'kc/cohere/north-mini-code:free',
    underlyingModelFamily: 'cohere/north-mini-code',
    providerRoute: '9router:kc',
    tier: 'BEST_FREE',
    priority: 1,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'KiloCode verified free pool endpoint via 9Router proxy',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 200000,
    qualityScore: 99.10,
    codingScore: 100,
    reasoningScore: 100,
    reliabilityScore: 100,
    upstreamQuotaObserved: false,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'PRIMARY FREE: Proven best agentic coding model on 9Router (Empirical Score: 99.10)',
  },
  {
    provider: '9router',
    modelId: 'kc/kilo-auto/free',
    underlyingModelFamily: 'kilo-auto',
    providerRoute: '9router:kc',
    tier: 'FREE_FALLBACK_2',
    priority: 2,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'KiloCode dynamic free community router pool (zero token price)',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: false,
    contextWindow: 200000,
    qualityScore: 93.80,
    codingScore: 80,
    reasoningScore: 100,
    reliabilityScore: 95,
    upstreamQuotaObserved: false,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'SECONDARY FREE: Proven debugging & multi-turn (Empirical Score: 93.80)',
  },
  {
    provider: '9router',
    modelId: 'kc/nvidia/nemotron-3.5-lightning:free',
    underlyingModelFamily: 'nvidia/nemotron-3.5-lightning',
    providerRoute: '9router:kc',
    tier: 'FREE_FALLBACK_3',
    priority: 3,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'KiloCode verified free tier endpoint via 9Router proxy',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'reasoning', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 128000,
    qualityScore: 83.05,
    codingScore: 90,
    reasoningScore: 20,
    reliabilityScore: 80,
    upstreamQuotaObserved: false,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'TERTIARY FREE: Solid code generation, higher latency (Empirical Score: 83.05)',
  },
  {
    provider: '9router',
    modelId: 'openrouter/cohere/north-mini-code:free',
    underlyingModelFamily: 'cohere/north-mini-code',
    providerRoute: '9router:openrouter',
    tier: 'FREE_FALLBACK_3',
    priority: 4,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter verified free tier endpoint via 9Router proxy',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 200000,
    qualityScore: 82.70,
    codingScore: 100,
    reasoningScore: 0,
    reliabilityScore: 85,
    upstreamQuotaObserved: true,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'QUATERNARY FREE: High quality model family, route subject to UPSTREAM_QUOTA_OBSERVED (Empirical Score: 82.70)',
  },
  {
    provider: '9router',
    modelId: 'openrouter/openrouter/free',
    underlyingModelFamily: 'openrouter/free',
    providerRoute: '9router:openrouter',
    tier: 'FREE_EMERGENCY',
    priority: 5,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter dynamic community free router pool (pricing.prompt="0", pricing.completion="0")',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: false,
    contextWindow: 200000,
    qualityScore: 81.55,
    codingScore: 100,
    reasoningScore: 0,
    reliabilityScore: 75,
    upstreamQuotaObserved: true,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 120000,
    maxRetries: 1,
    notes: 'EMERGENCY FREE: Dynamic free router pool on 9Router, subject to UPSTREAM_QUOTA_OBSERVED (Empirical Score: 81.55)',
  },
  {
    provider: '9router',
    modelId: 'kc/poolside/laguna-s-2.1:free',
    underlyingModelFamily: 'poolside/laguna-s-2.1',
    providerRoute: '9router:kc',
    tier: 'FREE_FALLBACK_3',
    priority: 6,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'KiloCode verified free tier endpoint via 9Router proxy',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 200000,
    qualityScore: 70,
    codingScore: 75,
    reasoningScore: 70,
    reliabilityScore: 70,
    upstreamQuotaObserved: false,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Agentic coding model with verified zero-cost execution',
  },
  {
    provider: '9router',
    modelId: 'openrouter/poolside/laguna-s-2.1:free',
    underlyingModelFamily: 'poolside/laguna-s-2.1',
    providerRoute: '9router:openrouter',
    tier: 'FREE_FALLBACK_3',
    priority: 7,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter verified free tier endpoint via 9Router proxy',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 200000,
    qualityScore: 70,
    codingScore: 75,
    reasoningScore: 70,
    reliabilityScore: 70,
    upstreamQuotaObserved: true,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'OpenRouter upstream mirror of poolside/laguna-s-2.1:free',
  },
  {
    provider: '9router',
    modelId: 'openrouter/google/gemma-4-31b-it:free',
    underlyingModelFamily: 'google/gemma-4-31b-it',
    providerRoute: '9router:openrouter',
    tier: 'FREE_FALLBACK_3',
    priority: 8,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter verified free tier endpoint via 9Router proxy',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'reasoning', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 128000,
    qualityScore: 70,
    codingScore: 75,
    reasoningScore: 75,
    reliabilityScore: 70,
    upstreamQuotaObserved: true,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Instruction-following model with verified 0/0 pricing',
  },
  {
    provider: '9router',
    modelId: 'openrouter/thinkingmachines/inkling-small:free',
    underlyingModelFamily: 'thinkingmachines/inkling-small',
    providerRoute: '9router:openrouter',
    tier: 'FREE_FAST',
    priority: 9,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter verified free tier endpoint via 9Router proxy',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 128000,
    qualityScore: 65,
    codingScore: 65,
    reasoningScore: 65,
    reliabilityScore: 70,
    upstreamQuotaObserved: true,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 30000,
    maxRetries: 2,
    notes: 'Fast lightweight model with verified 0/0 pricing',
  },
];

/**
 * Verified canonical free models for OpenRouter (endpoint: https://openrouter.ai/api/v1/models).
 * STRICT RULE: Only models where pricing.prompt === "0" AND pricing.completion === "0" are included.
 */
export const OPENROUTER_REAL_FREE_MODELS: ModelRegistryEntry[] = [
  {
    provider: 'openrouter',
    modelId: 'cohere/north-mini-code:free',
    underlyingModelFamily: 'cohere/north-mini-code',
    providerRoute: 'openrouter:direct',
    tier: 'BEST_FREE',
    priority: 1,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter API pricing.prompt === "0" && pricing.completion === "0"',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 256000,
    qualityScore: 99.10,
    codingScore: 100,
    reasoningScore: 100,
    reliabilityScore: 90,
    upstreamQuotaObserved: false,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Best dedicated code agent model on OpenRouter with proven 0/0 pricing',
  },
  {
    provider: 'openrouter',
    modelId: 'poolside/laguna-s-2.1:free',
    underlyingModelFamily: 'poolside/laguna-s-2.1',
    providerRoute: 'openrouter:direct',
    tier: 'FREE_FALLBACK_2',
    priority: 2,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter API pricing.prompt === "0" && pricing.completion === "0"',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 262144,
    qualityScore: 85,
    codingScore: 85,
    reasoningScore: 80,
    reliabilityScore: 86,
    upstreamQuotaObserved: false,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Agentic coding model with verified 0/0 pricing',
  },
  {
    provider: 'openrouter',
    modelId: 'google/gemma-4-31b-it:free',
    underlyingModelFamily: 'google/gemma-4-31b-it',
    providerRoute: 'openrouter:direct',
    tier: 'FREE_FALLBACK_3',
    priority: 3,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter API pricing.prompt === "0" && pricing.completion === "0"',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'reasoning', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 262144,
    qualityScore: 82,
    codingScore: 82,
    reasoningScore: 85,
    reliabilityScore: 85,
    upstreamQuotaObserved: false,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: 'Open model with verified 0/0 pricing',
  },
  {
    provider: 'openrouter',
    modelId: 'nvidia/nemotron-3.5-lightning:free',
    underlyingModelFamily: 'nvidia/nemotron-3.5-lightning',
    providerRoute: 'openrouter:direct',
    tier: 'FREE_FALLBACK_3',
    priority: 4,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter API pricing.prompt === "0" && pricing.completion === "0"',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'reasoning', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 1000000,
    qualityScore: 83.05,
    codingScore: 90,
    reasoningScore: 20,
    reliabilityScore: 80,
    upstreamQuotaObserved: false,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 60000,
    maxRetries: 2,
    notes: '1M context window with verified 0/0 pricing',
  },
  {
    provider: 'openrouter',
    modelId: 'thinkingmachines/inkling-small:free',
    underlyingModelFamily: 'thinkingmachines/inkling-small',
    providerRoute: 'openrouter:direct',
    tier: 'FREE_FAST',
    priority: 5,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter API pricing.prompt === "0" && pricing.completion === "0"',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: true,
    contextWindow: 1048576,
    qualityScore: 75,
    codingScore: 75,
    reasoningScore: 75,
    reliabilityScore: 85,
    upstreamQuotaObserved: false,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 30000,
    maxRetries: 2,
    notes: 'Fast lightweight model with verified 0/0 pricing',
  },
  {
    provider: 'openrouter',
    modelId: 'openrouter/free',
    underlyingModelFamily: 'openrouter/free',
    providerRoute: 'openrouter:direct',
    tier: 'FREE_EMERGENCY',
    priority: 6,
    freeStatus: 'VERIFIED_FREE',
    pricingEvidence: {
      promptPrice: '0',
      completionPrice: '0',
      evidenceSource: 'OpenRouter API pricing.prompt === "0" && pricing.completion === "0"',
      verifiedDate: '2026-09-12',
    },
    capabilities: ['coding', 'reasoning', 'tool_calling', 'multi-turn'],
    supportsTools: true,
    supportsStructuredOutput: false,
    supportsLongContext: false,
    contextWindow: 200000,
    qualityScore: 81.55,
    codingScore: 100,
    reasoningScore: 0,
    reliabilityScore: 70,
    upstreamQuotaObserved: false,
    quotaState: 'AVAILABLE',
    enabled: true,
    cooldownMs: 120000,
    maxRetries: 1,
    notes: 'Dynamic community free router pool - emergency fallback only',
  },
];

// Backwards compatibility aliases
export const NINE_ROUTER_FREE_MODELS = NINE_ROUTER_REAL_FREE_MODELS;
export const OPENROUTER_FREE_MODELS = OPENROUTER_REAL_FREE_MODELS;

/**
 * MANDATORY SAFETY FUNCTION:
 * Evaluates whether a model identifier or registry entry is provably free (prompt=0, completion=0).
 * If there is any doubt or lack of 0/0 pricing evidence, returns FALSE.
 */
export function isFreeModel(
  model:
    | string
    | ModelRegistryEntry
    | {
        pricing?: { prompt?: string | number; completion?: string | number };
        pricingEvidence?: { promptPrice?: string | number; completionPrice?: string | number };
        freeStatus?: FreeStatus;
        modelId?: string;
        id?: string;
      }
): boolean {
  if (!model) return false;

  // Object with pricing field (e.g. from OpenRouter API model object)
  if (typeof model === 'object' && 'pricing' in model && model.pricing) {
    const p = model.pricing.prompt;
    const c = model.pricing.completion;
    const promptZero = p === '0' || p === 0 || (typeof p === 'string' && parseFloat(p) === 0);
    const completionZero = c === '0' || c === 0 || (typeof c === 'string' && parseFloat(c) === 0);
    if (!promptZero || !completionZero) {
      return false; // Even if model ID has ":free", non-zero price rejects immediately
    }
    return true;
  }

  // ModelRegistryEntry or object with pricingEvidence
  if (typeof model === 'object' && ('freeStatus' in model || 'pricingEvidence' in model)) {
    if (model.freeStatus && model.freeStatus !== 'VERIFIED_FREE') {
      return false;
    }
    const p = model.pricingEvidence?.promptPrice;
    const c = model.pricingEvidence?.completionPrice;
    const promptZero = p === '0' || p === 0 || (typeof p === 'string' && parseFloat(p) === 0);
    const completionZero = c === '0' || c === 0 || (typeof c === 'string' && parseFloat(c) === 0);
    return promptZero && completionZero;
  }

  // String model ID or object with modelId/id but no explicit pricing
  const modelId = typeof model === 'string' ? model.trim().toLowerCase() : String(model.modelId || model.id || '').trim().toLowerCase();
  if (!modelId) return false;

  // STRICT RULE: Commercial Gemini models without verified 0/0 pricing evidence are NEVER free
  if (
    modelId.includes('gemini') &&
    !modelId.includes(':free') &&
    !modelId.startsWith('openrouter/') &&
    !modelId.startsWith('kc/')
  ) {
    return false;
  }

  // STRICT RULE: Known paid model prefixes/names are rejected immediately
  if (
    modelId.includes('gpt-4') ||
    modelId.includes('gpt-3.5') ||
    modelId.includes('claude-3') ||
    modelId.includes('claude-2') ||
    modelId.includes('paid')
  ) {
    return false;
  }

  // Search in verified 9Router catalog
  const entry9 = NINE_ROUTER_REAL_FREE_MODELS.find(m => m.modelId.toLowerCase() === modelId);
  if (entry9 && entry9.freeStatus === 'VERIFIED_FREE') {
    return true;
  }

  // Search in verified OpenRouter catalog
  const entryOr = OPENROUTER_REAL_FREE_MODELS.find(m => m.modelId.toLowerCase() === modelId);
  if (entryOr && entryOr.freeStatus === 'VERIFIED_FREE') {
    return true;
  }

  // Default: Any unverified model or unknown pricing is treated as NOT FREE
  return false;
}

/**
 * Retrieve verified free model entry from registry by provider and model identifier.
 */
export function getModelRegistryEntry(
  provider: ModelProviderKind,
  modelId: string
): ModelRegistryEntry | undefined {
  const norm = modelId.trim().toLowerCase();
  const catalog = provider === '9router' ? NINE_ROUTER_REAL_FREE_MODELS : OPENROUTER_REAL_FREE_MODELS;
  return catalog.find(m => m.modelId.toLowerCase() === norm);
}

/**
 * Return all verified free models for a given provider.
 */
export function getRegisteredModels(provider: ModelProviderKind): ModelRegistryEntry[] {
  return provider === '9router' ? [...NINE_ROUTER_REAL_FREE_MODELS] : [...OPENROUTER_REAL_FREE_MODELS];
}
