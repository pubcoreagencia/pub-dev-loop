// src/providers/model-routing-policy.ts
import type { Task } from '../domain.js';
import type { ProviderTaskInput } from './types.js';
import {
  type ModelProviderKind,
  type ModelTierName,
  type ModelRegistryEntry,
  type QuotaState,
  getRegisteredModels,
  getModelRegistryEntry,
  isFreeModel,
  BEST_FREE_PROVEN,
  BEST_FREE_SCOPE,
  MODEL_QUALITY_RANK,
  CANONICAL_OPERATIONAL_POLICY,
} from './model-registry.js';

export type ModelHealthState = 'HEALTHY' | 'DEGRADED' | 'COOLDOWN' | 'DISABLED';

export type ModelFailureType =
  | 'AUTH_FAILURE'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'HTTP_5XX'
  | 'MODEL_UNAVAILABLE'
  | 'TOOL_PROTOCOL_FAILURE'
  | 'INVALID_REQUEST'
  | 'CONTEXT_LIMIT'
  | 'UNKNOWN';

export interface ModelHealthRecord {
  modelId: string;
  provider: ModelProviderKind;
  state: ModelHealthState;
  consecutiveFailures: number;
  consecutiveTimeouts: number;
  lastFailureType?: ModelFailureType;
  lastFailureTime?: number;
  cooldownUntil?: number;
  disabledReason?: string;
  protocolFailureTrace?: string;
  quotaState?: QuotaState;
  upstreamQuotaObserved?: boolean;
}

export interface DecisionTraceEntry {
  modelId: string;
  provider: ModelProviderKind;
  tier?: ModelTierName;
  priority?: number;
  selected: boolean;
  role?: 'primary' | 'fallback' | 'emergency';
  rejectionReason?: string;
  healthState?: ModelHealthState;
  supportsTools?: boolean;
  codingScore?: number;
  reliabilityScore?: number;
}

export interface ResolvedModelQueue {
  provider: ModelProviderKind;
  primaryModel: string;
  fallbackModels: string[];
  candidateQueue: string[];
  decisionTrace: DecisionTraceEntry[];
  entries: ModelRegistryEntry[];
}

export interface ResolveQueueOptions {
  modelOverride?: string;
  catalog?: ModelRegistryEntry[];
  healthTracker?: ModelHealthTracker;
  allowEmergency?: boolean;
  allowCrossProviderFallback?: boolean;
  requireTools?: boolean;
  requireCoding?: boolean;
  minContextTokens?: number;
  now?: number;
}

/**
 * Classify raw HTTP response or network error into standardized ModelFailureType.
 */
export function classifyFailure(
  httpStatus: number | null,
  errorMessage: string,
  isConnectionError = false
): ModelFailureType {
  const msgLower = (errorMessage || '').toLowerCase();

  // Explicit check for protocol error (e.g. Gemini trailing model turn)
  if (
    msgLower.includes('requests ending with a model turn are not supported') ||
    msgLower.includes('model turn are not supported') ||
    msgLower.includes('tool_call_id') ||
    msgLower.includes('function_call') ||
    msgLower.includes('tool message format')
  ) {
    return 'TOOL_PROTOCOL_FAILURE';
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return 'AUTH_FAILURE';
  }

  if (httpStatus === 429) {
    return 'RATE_LIMIT';
  }

  if (
    msgLower.includes('timeout') ||
    msgLower.includes('timed out') ||
    msgLower.includes('aborted') ||
    msgLower.includes('router_timeout')
  ) {
    return 'TIMEOUT';
  }

  if (httpStatus === 404 || httpStatus === 503) {
    return 'MODEL_UNAVAILABLE';
  }

  if (httpStatus !== null && httpStatus >= 500) {
    return 'HTTP_5XX';
  }

  if (
    msgLower.includes('context length') ||
    msgLower.includes('context_length') ||
    msgLower.includes('token limit') ||
    msgLower.includes('maximum context') ||
    httpStatus === 413
  ) {
    return 'CONTEXT_LIMIT';
  }

  if (httpStatus === 400) {
    return 'INVALID_REQUEST';
  }

  if (isConnectionError) {
    return 'TIMEOUT';
  }

  return 'UNKNOWN';
}

/**
 * In-memory circuit breaker, model health tracker, and quota tracker.
 */
export class ModelHealthTracker {
  private records = new Map<string, ModelHealthRecord>();

  private makeKey(provider: ModelProviderKind, modelId: string): string {
    return `${provider}:${modelId.trim().toLowerCase()}`;
  }

  getState(provider: ModelProviderKind, modelId: string, now = Date.now()): ModelHealthState {
    const rec = this.records.get(this.makeKey(provider, modelId));
    if (!rec) return 'HEALTHY';

    if (rec.state === 'COOLDOWN') {
      if (rec.cooldownUntil && now >= rec.cooldownUntil) {
        rec.state = 'HEALTHY';
        rec.cooldownUntil = undefined;
        if (rec.quotaState === 'EXHAUSTED') {
          rec.quotaState = 'AVAILABLE';
        }
        return 'HEALTHY';
      }
      return 'COOLDOWN';
    }

    return rec.state;
  }

  isAvailable(provider: ModelProviderKind, modelId: string, now = Date.now()): boolean {
    const state = this.getState(provider, modelId, now);
    return state === 'HEALTHY' || state === 'DEGRADED';
  }

  getQuotaState(provider: ModelProviderKind, modelId: string, now = Date.now()): QuotaState {
    const rec = this.records.get(this.makeKey(provider, modelId));
    if (!rec) return 'AVAILABLE';
    if (rec.state === 'COOLDOWN' && rec.quotaState === 'EXHAUSTED') {
      if (rec.cooldownUntil && now >= rec.cooldownUntil) {
        rec.state = 'HEALTHY';
        rec.quotaState = 'AVAILABLE';
        rec.cooldownUntil = undefined;
        return 'AVAILABLE';
      }
      return 'EXHAUSTED';
    }
    return rec.quotaState || 'AVAILABLE';
  }

  recordSuccess(provider: ModelProviderKind, modelId: string): void {
    const key = this.makeKey(provider, modelId);
    const rec = this.records.get(key) || {
      modelId,
      provider,
      state: 'HEALTHY',
      consecutiveFailures: 0,
      consecutiveTimeouts: 0,
    };
    rec.state = 'HEALTHY';
    rec.consecutiveFailures = 0;
    rec.consecutiveTimeouts = 0;
    rec.cooldownUntil = undefined;
    rec.quotaState = 'AVAILABLE';
    this.records.set(key, rec);
  }

  recordQuotaExhaustion(
    provider: ModelProviderKind,
    modelId: string,
    cooldownMs = 60000,
    details?: string,
    now = Date.now()
  ): void {
    const key = this.makeKey(provider, modelId);
    const rec = this.records.get(key) || {
      modelId,
      provider,
      state: 'HEALTHY',
      consecutiveFailures: 0,
      consecutiveTimeouts: 0,
    };
    rec.consecutiveFailures++;
    rec.lastFailureType = 'RATE_LIMIT';
    rec.lastFailureTime = now;
    rec.state = 'COOLDOWN';
    rec.quotaState = 'EXHAUSTED';
    rec.upstreamQuotaObserved = true;
    rec.cooldownUntil = now + cooldownMs;
    rec.disabledReason = details || 'Upstream quota exhausted (HTTP 429)';
    this.records.set(key, rec);
  }

  recordFailure(
    provider: ModelProviderKind,
    modelId: string,
    failureType: ModelFailureType,
    errorDetails?: string,
    cooldownMs?: number,
    now = Date.now()
  ): void {
    const key = this.makeKey(provider, modelId);
    const rec = this.records.get(key) || {
      modelId,
      provider,
      state: 'HEALTHY',
      consecutiveFailures: 0,
      consecutiveTimeouts: 0,
    };

    rec.consecutiveFailures++;
    rec.lastFailureType = failureType;
    rec.lastFailureTime = now;

    switch (failureType) {
      case 'AUTH_FAILURE':
        rec.state = 'DISABLED';
        rec.disabledReason = errorDetails || 'Authentication failure';
        break;

      case 'RATE_LIMIT': {
        rec.state = 'COOLDOWN';
        const duration = cooldownMs ?? 60000;
        rec.cooldownUntil = now + duration;
        rec.quotaState = 'EXHAUSTED';
        rec.upstreamQuotaObserved = true;
        rec.disabledReason = errorDetails || 'Rate limit / quota exceeded';
        break;
      }

      case 'TIMEOUT': {
        rec.consecutiveTimeouts++;
        if (rec.consecutiveTimeouts >= 2) {
          rec.state = 'COOLDOWN';
          rec.cooldownUntil = now + (cooldownMs ?? 60000);
        } else {
          rec.state = 'DEGRADED';
        }
        break;
      }

      case 'HTTP_5XX': {
        if (rec.consecutiveFailures >= 2) {
          rec.state = 'COOLDOWN';
          rec.cooldownUntil = now + (cooldownMs ?? 60000);
        } else {
          rec.state = 'DEGRADED';
        }
        break;
      }

      case 'MODEL_UNAVAILABLE': {
        if (errorDetails && errorDetails.includes('404')) {
          rec.state = 'DISABLED';
          rec.disabledReason = errorDetails;
        } else {
          rec.state = 'COOLDOWN';
          rec.cooldownUntil = now + (cooldownMs ?? 60000);
        }
        break;
      }

      case 'TOOL_PROTOCOL_FAILURE': {
        rec.state = 'DEGRADED';
        rec.protocolFailureTrace = errorDetails;
        break;
      }

      default:
        if (rec.consecutiveFailures >= 3) {
          rec.state = 'COOLDOWN';
          rec.cooldownUntil = now + (cooldownMs ?? 30000);
        } else {
          rec.state = 'DEGRADED';
        }
        break;
    }

    this.records.set(key, rec);
  }

  reset(): void {
    this.records.clear();
  }

  getRecord(provider: ModelProviderKind, modelId: string): ModelHealthRecord | undefined {
    return this.records.get(this.makeKey(provider, modelId));
  }
}

export const defaultModelHealthTracker = new ModelHealthTracker();

/**
 * Filter models by capabilities required by the task.
 */
export function filterCapableModelsForTask(
  models: ModelRegistryEntry[],
  options: {
    requireTools?: boolean;
    requireCoding?: boolean;
    minContextTokens?: number;
  } = {}
): {
  capable: ModelRegistryEntry[];
  rejected: { model: ModelRegistryEntry; reason: string }[];
} {
  const requireTools = options.requireTools ?? true;
  const requireCoding = options.requireCoding ?? true;
  const minContext = options.minContextTokens ?? 32768;

  const capable: ModelRegistryEntry[] = [];
  const rejected: { model: ModelRegistryEntry; reason: string }[] = [];

  for (const m of models) {
    if (!m.enabled) {
      rejected.push({ model: m, reason: 'MODEL_DISABLED_IN_REGISTRY' });
      continue;
    }
    if (requireTools && !m.supportsTools) {
      rejected.push({ model: m, reason: 'LACKS_TOOL_CALLING_SUPPORT' });
      continue;
    }
    if (requireCoding && !m.capabilities.includes('coding') && (!m.codingScore || m.codingScore <= 0)) {
      rejected.push({ model: m, reason: 'LACKS_CODING_CAPABILITY' });
      continue;
    }
    if (m.contextWindow < minContext) {
      rejected.push({ model: m, reason: `INSUFFICIENT_CONTEXT_WINDOW (${m.contextWindow} < ${minContext})` });
      continue;
    }
    capable.push(m);
  }

  return { capable, rejected };
}

/**
 * Rank candidate models according to canonical PUB criteria:
 * 0. Quota & Circuit Breaker Health (Active routes before exhausted/cooldown routes)
 * 1. Priority Tier (1: PRIMARY, 2: SECONDARY, 3: TERTIARY, 4: QUATERNARY, 5: EMERGENCY)
 * 2. Empirical Quality Score (Higher is better)
 * 3. Coding Score (Higher is better)
 * 4. Reasoning Score (Higher is better)
 * 5. Reliability Score (Higher is better)
 * 6. Context Window (Larger is better)
 * 7. Deterministic tie-breaker: modelId.localeCompare
 */
export function rankCandidateModels(
  models: ModelRegistryEntry[],
  tracker?: ModelHealthTracker,
  now = Date.now()
): ModelRegistryEntry[] {
  return [...models].sort((a, b) => {
    // 0. Quota state: if tracker provided, demote models with exhausted quota
    if (tracker) {
      const quotaA = tracker.getQuotaState(a.provider, a.modelId, now);
      const quotaB = tracker.getQuotaState(b.provider, b.modelId, now);
      if (quotaA === 'EXHAUSTED' && quotaB !== 'EXHAUSTED') return 1;
      if (quotaB === 'EXHAUSTED' && quotaA !== 'EXHAUSTED') return -1;
    }

    // 1. Priority tier
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }

    // 2. Empirical Quality Score
    const qualA = a.qualityScore ?? 0;
    const qualB = b.qualityScore ?? 0;
    if (qualA !== qualB) {
      return qualB - qualA;
    }

    // 3. Coding score
    const codingA = a.codingScore ?? 0;
    const codingB = b.codingScore ?? 0;
    if (codingA !== codingB) {
      return codingB - codingA;
    }

    // 4. Reasoning score
    const reasoningA = a.reasoningScore ?? 0;
    const reasoningB = b.reasoningScore ?? 0;
    if (reasoningA !== reasoningB) {
      return reasoningB - reasoningA;
    }

    // 5. Reliability score
    if (a.reliabilityScore !== b.reliabilityScore) {
      return b.reliabilityScore - a.reliabilityScore;
    }

    // 6. Context window
    if (a.contextWindow !== b.contextWindow) {
      return b.contextWindow - a.contextWindow;
    }

    // 7. Deterministic tie-breaker
    return a.modelId.localeCompare(b.modelId);
  });
}

/**
 * Classify rejection reason for models that fail FREE-ONLY validation.
 */
export function classifyPricingRejection(model: any): 'PAID_MODEL' | 'UNKNOWN_PRICING' {
  if (!model) return 'UNKNOWN_PRICING';
  if (typeof model === 'object') {
    if (model.freeStatus === 'PAID_MODEL') return 'PAID_MODEL';
    if (model.pricing) {
      const p = parseFloat(String(model.pricing.prompt || '0'));
      const c = parseFloat(String(model.pricing.completion || '0'));
      if (p > 0 || c > 0) return 'PAID_MODEL';
    }
    if (model.pricingEvidence) {
      const p = parseFloat(String(model.pricingEvidence.promptPrice || '0'));
      const c = parseFloat(String(model.pricingEvidence.completionPrice || '0'));
      if (p > 0 || c > 0) return 'PAID_MODEL';
    }
  }
  const id = typeof model === 'string' ? model.toLowerCase() : String(model.modelId || model.id || '').toLowerCase();
  if (
    id.includes('gpt-') ||
    id.includes('claude-') ||
    id.includes('gemini') ||
    id.includes('paid')
  ) {
    return 'PAID_MODEL';
  }
  return 'UNKNOWN_PRICING';
}

/**
 * Filter models to strictly enforce FREE_ONLY_POLICY.
 */
export function filterFreeModels(
  models: (ModelRegistryEntry | any)[]
): {
  free: ModelRegistryEntry[];
  rejected: { model: any; reason: 'PAID_MODEL' | 'UNKNOWN_PRICING' }[];
} {
  const free: ModelRegistryEntry[] = [];
  const rejected: { model: any; reason: 'PAID_MODEL' | 'UNKNOWN_PRICING' }[] = [];

  for (const m of models) {
    if (!isFreeModel(m)) {
      rejected.push({ model: m, reason: classifyPricingRejection(m) });
    } else {
      free.push(m);
    }
  }

  return { free, rejected };
}

/**
 * Resolve candidate model queue according to the canonical 7-stage PDL pipeline:
 * 1. PROVIDER CATALOG
 * 2. FREE-ONLY FILTER (Absolute requirement: prompt=0 && completion=0)
 * 3. CAPABILITY FILTER (Tools, Coding, Context Window)
 * 4. HEALTH FILTER (Circuit breaker: Cooldown / Disabled / Quota state)
 * 5. PROTOCOL HEALTH FILTER (Protocol errors do not disqualify models)
 * 6. QUALITY & OPERATIONAL RANKING (Priority tier, Quality score, Coding, Reasoning, Reliability)
 * 7. FALLBACK CHAIN (Active queue, emergency fallback, fail-closed safety assertion)
 */
export function resolveModelQueue(
  provider: ModelProviderKind,
  task?: Task | ProviderTaskInput,
  options: ResolveQueueOptions = {}
): ResolvedModelQueue {
  const tracker = options.healthTracker ?? defaultModelHealthTracker;
  const now = options.now ?? Date.now();
  const allowEmergency = options.allowEmergency ?? false;
  const decisionTrace: DecisionTraceEntry[] = [];

  // =========================================================================
  // STAGE 1: PROVIDER CATALOG
  // =========================================================================
  const rawCatalog: ModelRegistryEntry[] = options.catalog ?? getRegisteredModels(provider);
  let candidatePool: ModelRegistryEntry[] = [...rawCatalog];

  // If explicit model override was requested:
  if (options.modelOverride) {
    const overrideId = options.modelOverride.trim();
    const existing = rawCatalog.find(m => m.modelId.toLowerCase() === overrideId.toLowerCase()) ||
                     getModelRegistryEntry(provider, overrideId);

    if (existing) {
      candidatePool = [existing];
    } else {
      // Synthetic or caller-provided override entry
      candidatePool = [
        {
          provider,
          modelId: overrideId,
          underlyingModelFamily: overrideId,
          providerRoute: provider === '9router' ? '9router:kc' : 'openrouter:direct',
          tier: 'BEST_FREE',
          priority: 0,
          freeStatus: 'UNKNOWN_PRICING',
          pricingEvidence: {
            promptPrice: 'UNKNOWN',
            completionPrice: 'UNKNOWN',
            evidenceSource: 'Unverified caller override',
            verifiedDate: '',
          },
          capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
          supportsTools: true,
          supportsStructuredOutput: false,
          supportsLongContext: true,
          contextWindow: 128000,
          qualityScore: 50,
          reliabilityScore: 85,
          enabled: true,
          cooldownMs: 60000,
          maxRetries: 2,
          notes: 'Unverified caller override',
        },
      ];
    }
  }

  // =========================================================================
  // STAGE 2: FREE-ONLY FILTER
  // Absolute Rule: Any model not proven promptPrice==="0" && completionPrice==="0"
  // is strictly rejected before any capability or ranking evaluation.
  // =========================================================================
  const { free: freeCandidates, rejected: pricingRejected } = filterFreeModels(candidatePool);

  for (const rej of pricingRejected) {
    const m = rej.model;
    decisionTrace.push({
      modelId: m.modelId || m.id || String(m),
      provider: m.provider ?? provider,
      tier: m.tier,
      priority: m.priority,
      selected: false,
      rejectionReason: rej.reason,
      healthState: tracker.getState(m.provider ?? provider, m.modelId || m.id || String(m), now),
      supportsTools: m.supportsTools,
      codingScore: m.codingScore,
      reliabilityScore: m.reliabilityScore,
    });
  }

  // If no free models survived, fail closed immediately
  if (freeCandidates.length === 0) {
    return {
      provider,
      primaryModel: '',
      fallbackModels: [],
      candidateQueue: [],
      decisionTrace,
      entries: [],
    };
  }

  // =========================================================================
  // STAGE 3: CAPABILITY FILTER
  // =========================================================================
  const { capable, rejected: capabilityRejected } = filterCapableModelsForTask(freeCandidates, {
    requireTools: options.requireTools ?? true,
    requireCoding: options.requireCoding ?? true,
    minContextTokens: options.minContextTokens ?? 32768,
  });

  for (const rej of capabilityRejected) {
    decisionTrace.push({
      modelId: rej.model.modelId,
      provider: rej.model.provider,
      tier: rej.model.tier,
      priority: rej.model.priority,
      selected: false,
      rejectionReason: rej.reason,
      healthState: tracker.getState(rej.model.provider, rej.model.modelId, now),
      supportsTools: rej.model.supportsTools,
      codingScore: rej.model.codingScore,
      reliabilityScore: rej.model.reliabilityScore,
    });
  }

  // =========================================================================
  // STAGE 4: HEALTH FILTER & CIRCUIT BREAKER (Including Quota State)
  // =========================================================================
  const healthyCandidates: ModelRegistryEntry[] = [];
  for (const m of capable) {
    const health = tracker.getState(provider, m.modelId, now);
    const isAvailable = health === 'HEALTHY' || health === 'DEGRADED';

    if (!isAvailable) {
      decisionTrace.push({
        modelId: m.modelId,
        provider,
        tier: m.tier,
        priority: m.priority,
        selected: false,
        rejectionReason: `CIRCUIT_BREAKER_${health}`,
        healthState: health,
        supportsTools: m.supportsTools,
        codingScore: m.codingScore,
        reliabilityScore: m.reliabilityScore,
      });
      continue;
    }

    healthyCandidates.push(m);
  }

  // =========================================================================
  // STAGE 5: PROTOCOL HEALTH FILTER
  // Protocol formatting failures (e.g. Gemini trailing turn) do NOT disqualify
  // models permanently, keeping them DEGRADED or HEALTHY.
  // =========================================================================
  const protocolPassed = healthyCandidates.filter(m => {
    return true;
  });

  // =========================================================================
  // STAGE 6: QUALITY & OPERATIONAL RANKING
  // =========================================================================
  const ranked = rankCandidateModels(protocolPassed, tracker, now);

  // =========================================================================
  // STAGE 7: FALLBACK CHAIN ASSEMBLY
  // =========================================================================
  const activeCandidates: ModelRegistryEntry[] = [];
  const emergencyCandidates: ModelRegistryEntry[] = [];

  for (const m of ranked) {
    if (m.tier === 'FREE_EMERGENCY') {
      emergencyCandidates.push(m);
    } else {
      activeCandidates.push(m);
    }
  }

  const selectedEntries: ModelRegistryEntry[] = [...activeCandidates];
  if (allowEmergency || selectedEntries.length === 0) {
    selectedEntries.push(...emergencyCandidates);
  }

  // Cross-provider fallback (only if authorized and active list is empty)
  if (options.allowCrossProviderFallback && selectedEntries.length === 0) {
    const otherProvider: ModelProviderKind = provider === '9router' ? 'openrouter' : '9router';
    const otherCatalog = getRegisteredModels(otherProvider);

    for (const om of otherCatalog) {
      if (
        isFreeModel(om) &&
        tracker.isAvailable(otherProvider, om.modelId, now) &&
        om.supportsTools &&
        om.tier !== 'FREE_EMERGENCY'
      ) {
        selectedEntries.push(om);
      }
    }
  }

  // MANDATORY SAFETY ASSERTION: 100% of candidate models must be VERIFIED FREE
  const verifiedFreeSelected = selectedEntries.filter(m => isFreeModel(m));

  // Populate decision trace for selected entries
  for (let i = 0; i < verifiedFreeSelected.length; i++) {
    const m = verifiedFreeSelected[i];
    const role: 'primary' | 'fallback' | 'emergency' =
      i === 0 ? 'primary' : m.tier === 'FREE_EMERGENCY' ? 'emergency' : 'fallback';

    decisionTrace.push({
      modelId: m.modelId,
      provider: m.provider,
      tier: m.tier,
      priority: m.priority,
      selected: true,
      role,
      healthState: tracker.getState(m.provider, m.modelId, now),
      supportsTools: m.supportsTools,
      codingScore: m.codingScore,
      reliabilityScore: m.reliabilityScore,
    });
  }

  const candidateQueue = verifiedFreeSelected.map(e => e.modelId);
  const primaryModel = candidateQueue[0] || '';
  const fallbackModels = candidateQueue.slice(1);

  return {
    provider,
    primaryModel,
    fallbackModels,
    candidateQueue,
    decisionTrace,
    entries: verifiedFreeSelected,
  };
}
