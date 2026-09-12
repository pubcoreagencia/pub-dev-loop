// src/providers/model-routing-policy.ts
import type { Task } from '../domain.js';
import type { ProviderTaskInput } from './types.js';
import {
  type ModelProviderKind,
  type ModelTierName,
  type ModelRegistryEntry,
  getRegisteredModels,
  getModelRegistryEntry,
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
}

export interface DecisionTraceEntry {
  modelId: string;
  provider: ModelProviderKind;
  tier: ModelTierName;
  priority: number;
  selected: boolean;
  role?: 'primary' | 'fallback' | 'emergency';
  rejectionReason?: string;
  healthState: ModelHealthState;
  supportsTools: boolean;
  codingScore?: number;
  reliabilityScore: number;
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
 * In-memory circuit breaker and model health tracker.
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
        // If 404, disable; if 503, cooldown
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
        // Strict rule: Protocol failures (e.g. transcript formatting, missing tool message content)
        // must NOT mark model as inferior or permanently broken.
        rec.protocolFailureTrace = errorDetails;
        // Keep as DEGRADED or HEALTHY, not DISABLED or COOLDOWN
        rec.state = 'DEGRADED';
        break;
      }

      case 'INVALID_REQUEST':
      case 'CONTEXT_LIMIT':
      case 'UNKNOWN':
      default:
        rec.state = 'DEGRADED';
        break;
    }

    this.records.set(key, rec);
  }

  getRecord(provider: ModelProviderKind, modelId: string): ModelHealthRecord | undefined {
    return this.records.get(this.makeKey(provider, modelId));
  }

  reset(): void {
    this.records.clear();
  }
}

/** Global default tracker instance */
export const defaultModelHealthTracker = new ModelHealthTracker();

/**
 * Filter models that satisfy the given task capability requirements.
 */
export function filterCapableModelsForTask(
  models: ModelRegistryEntry[],
  options: {
    requireTools?: boolean;
    requireCoding?: boolean;
    minContextTokens?: number;
  } = {}
): { capable: ModelRegistryEntry[]; rejected: { model: ModelRegistryEntry; reason: string }[] } {
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
 * Rank candidate models according to explicit PUB criteria:
 * 1. Priority (lower is better, e.g. 1 is BEST_FREE)
 * 2. Coding Score (higher is better)
 * 3. Reasoning Score (higher is better)
 * 4. Reliability Score (higher is better)
 * 5. Context Window (larger is better)
 */
export function rankCandidateModels(models: ModelRegistryEntry[]): ModelRegistryEntry[] {
  return [...models].sort((a, b) => {
    // 1. Priority tier
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // 2. Coding score
    const codingA = a.codingScore ?? 0;
    const codingB = b.codingScore ?? 0;
    if (codingA !== codingB) {
      return codingB - codingA;
    }
    // 3. Reasoning score
    const reasoningA = a.reasoningScore ?? 0;
    const reasoningB = b.reasoningScore ?? 0;
    if (reasoningA !== reasoningB) {
      return reasoningB - reasoningA;
    }
    // 4. Reliability score
    if (a.reliabilityScore !== b.reliabilityScore) {
      return b.reliabilityScore - a.reliabilityScore;
    }
    // 5. Context window
    return b.contextWindow - a.contextWindow;
  });
}

/**
 * Resolve candidate model queue according to policy, capability filtering,
 * health status, and fallback requirements.
 */
export function resolveModelQueue(
  provider: ModelProviderKind,
  task?: Task | ProviderTaskInput,
  options: ResolveQueueOptions = {}
): ResolvedModelQueue {
  const tracker = options.healthTracker ?? defaultModelHealthTracker;
  const now = options.now ?? Date.now();
  const allowEmergency = options.allowEmergency ?? false;

  const registered = getRegisteredModels(provider);
  const decisionTrace: DecisionTraceEntry[] = [];

  // If explicit model override was requested, handle it with capability verification
  if (options.modelOverride) {
    const overrideId = options.modelOverride.trim();
    const existing = getModelRegistryEntry(provider, overrideId);

    const overrideEntry: ModelRegistryEntry = existing || {
      provider,
      modelId: overrideId,
      tier: 'BEST_FREE',
      priority: 0,
      capabilities: ['coding', 'agent', 'tool_calling', 'multi-turn'],
      supportsTools: true,
      supportsStructuredOutput: false,
      supportsLongContext: true,
      contextWindow: 128000,
      reliabilityScore: 85,
      enabled: true,
      cooldownMs: 60000,
      maxRetries: 2,
      notes: 'Explicit caller override',
    };

    const health = tracker.getState(provider, overrideId, now);
    decisionTrace.push({
      modelId: overrideId,
      provider,
      tier: overrideEntry.tier,
      priority: overrideEntry.priority,
      selected: true,
      role: 'primary',
      healthState: health,
      supportsTools: overrideEntry.supportsTools,
      codingScore: overrideEntry.codingScore,
      reliabilityScore: overrideEntry.reliabilityScore,
    });

    return {
      provider,
      primaryModel: overrideId,
      fallbackModels: [],
      candidateQueue: [overrideId],
      decisionTrace,
      entries: [overrideEntry],
    };
  }

  // 1. Capability Filtering
  const { capable, rejected } = filterCapableModelsForTask(registered, {
    requireTools: options.requireTools ?? true,
    requireCoding: options.requireCoding ?? true,
    minContextTokens: options.minContextTokens ?? 32768,
  });

  for (const rej of rejected) {
    decisionTrace.push({
      modelId: rej.model.modelId,
      provider,
      tier: rej.model.tier,
      priority: rej.model.priority,
      selected: false,
      rejectionReason: rej.reason,
      healthState: tracker.getState(provider, rej.model.modelId, now),
      supportsTools: rej.model.supportsTools,
      codingScore: rej.model.codingScore,
      reliabilityScore: rej.model.reliabilityScore,
    });
  }

  // 2. Ranking
  const ranked = rankCandidateModels(capable);

  // 3. Health & Tier Partitioning
  const activeCandidates: ModelRegistryEntry[] = [];
  const emergencyCandidates: ModelRegistryEntry[] = [];

  for (const m of ranked) {
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

    if (m.tier === 'EMERGENCY') {
      emergencyCandidates.push(m);
      continue;
    }

    activeCandidates.push(m);
  }

  // 4. Assemble candidate queue: active candidates first, emergency only if allowed or if active empty
  const selectedEntries: ModelRegistryEntry[] = [...activeCandidates];
  if (allowEmergency || selectedEntries.length === 0) {
    selectedEntries.push(...emergencyCandidates);
  }

  // 5. Cross-provider fallback (if explicitly authorized and active queue exhausted)
  if (options.allowCrossProviderFallback && selectedEntries.length === 0) {
    const otherProvider: ModelProviderKind = provider === '9router' ? 'openrouter' : '9router';
    const otherRegistered = getRegisteredModels(otherProvider);
    const otherCapable = filterCapableModelsForTask(otherRegistered, {
      requireTools: options.requireTools ?? true,
      requireCoding: options.requireCoding ?? true,
      minContextTokens: options.minContextTokens ?? 32768,
    }).capable;

    for (const m of otherCapable) {
      if (tracker.isAvailable(otherProvider, m.modelId, now) && m.tier !== 'EMERGENCY') {
        selectedEntries.push(m);
      }
    }
  }

  // Record selected decisions
  for (let i = 0; i < selectedEntries.length; i++) {
    const m = selectedEntries[i];
    const role: 'primary' | 'fallback' | 'emergency' =
      i === 0 ? 'primary' : m.tier === 'EMERGENCY' ? 'emergency' : 'fallback';

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

  const candidateQueue = selectedEntries.map(e => e.modelId);
  const primaryModel = candidateQueue[0] || '';
  const fallbackModels = candidateQueue.slice(1);

  return {
    provider,
    primaryModel,
    fallbackModels,
    candidateQueue,
    decisionTrace,
    entries: selectedEntries,
  };
}
