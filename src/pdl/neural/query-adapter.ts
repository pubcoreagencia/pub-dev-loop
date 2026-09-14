/**
 * PDL Neural Query Adapter.
 * Bridges PDL task planning and execution contexts with the canonical PUB Neural Query port.
 * Enforces:
 *   - Clean transport separation (Transport vs Domain)
 *   - Strict preservation of all 8 gate semantic statuses
 *   - DATA-ONLY rule: Neural knowledge is contextual evidence, never an executable command or governance override
 *   - Zero provenance fabrication: absent fields remain null/undefined
 */

import { randomUUID } from 'node:crypto';
import type {
  AuthorityLevel,
  ConflictState,
  FreshnessState,
  GateStatus,
  KnowledgeClass,
  NeuralAbstentionMetadata,
  NeuralCallerIdentity,
  NeuralContradictionItem,
  NeuralKnowledgeItem,
  NeuralProvenanceMetadata,
  NeuralQueryRequestPayload,
  NeuralQueryResponsePayload,
  PromotionState,
} from './query-types.js';
import {
  AUTHORITY_RANKS,
  CANONICAL_KNOWLEDGE_CLASSES,
} from './query-types.js';
import {
  HttpNeuralQueryTransport,
  type NeuralQueryTransport,
} from './query-transport.js';

export interface PdlTaskQueryContext {
  taskId: string;
  projectId: string;
  repository: string;
  objective: string;
  branch?: string;
  commitSha?: string | null;
  requestedKnowledgeClasses?: KnowledgeClass[];
  caller?: NeuralCallerIdentity;
  filters?: Record<string, unknown>;
  limit?: number;
  requestId?: string;
}

export interface PdlNeuralQueryResult {
  requestId: string;
  status: GateStatus;
  isSuccess: boolean;
  isAbstention: boolean;
  isStale: boolean;
  isUnavailable: boolean;
  isError: boolean;
  items: NeuralKnowledgeItem[];
  abstention?: NeuralAbstentionMetadata;
  contradictions?: NeuralContradictionItem[];
  reason?: string;
  metadata?: Record<string, unknown>;
  sourceReferences: string[];
  eventReferences: string[];
  evidenceReferences: string[];
}

export interface PubNeuralQueryClient {
  query(context: PdlTaskQueryContext): Promise<PdlNeuralQueryResult>;
}

export class DefaultPubNeuralQueryAdapter implements PubNeuralQueryClient {
  private readonly transport: NeuralQueryTransport;

  constructor(transport?: NeuralQueryTransport) {
    this.transport = transport ?? new HttpNeuralQueryTransport();
  }

  async query(context: PdlTaskQueryContext): Promise<PdlNeuralQueryResult> {
    const requestId = context.requestId || `pdl-req-${randomUUID()}`;

    // 1. Structural Validation of Context
    const validationError = this.validateContext(context);
    if (validationError) {
      return {
        requestId,
        status: 'INVALID_REQUEST',
        isSuccess: false,
        isAbstention: false,
        isStale: false,
        isUnavailable: false,
        isError: true,
        items: [],
        reason: validationError,
        sourceReferences: [],
        eventReferences: [],
        evidenceReferences: [],
      };
    }

    // 2. Build Canonical Request Payload without fabricating missing fields
    const knowledgeClasses: KnowledgeClass[] =
      context.requestedKnowledgeClasses && context.requestedKnowledgeClasses.length > 0
        ? context.requestedKnowledgeClasses
        : ['DECISION', 'RULE', 'GOVERNANCE', 'PATTERN', 'LESSON'];

    const payload: NeuralQueryRequestPayload = {
      request_id: requestId,
      task_id: context.taskId.trim(),
      project_id: context.projectId.trim(),
      repository: context.repository.trim(),
      objective: context.objective.trim(),
      requested_knowledge_classes: knowledgeClasses,
      caller: {
        actor_id: context.caller?.actorId?.trim() || `pdl:agent:${context.taskId.trim()}`,
        agent_role: context.caller?.agentRole?.trim() || null,
        trust_zone: context.caller?.trustZone?.trim() || 'tz_internal_holding',
      },
      timestamp: new Date().toISOString(),
      branch: context.branch?.trim() || null,
      commit_sha: context.commitSha?.trim() || null,
      filters: context.filters,
      limit: context.limit ? Math.min(Math.max(context.limit, 1), 50) : 5,
    };

    // 3. Dispatch through transport layer
    let responsePayload: NeuralQueryResponsePayload;
    try {
      responsePayload = await this.transport.sendQuery(payload);
    } catch (err: any) {
      return {
        requestId,
        status: 'UNAVAILABLE',
        isSuccess: false,
        isAbstention: false,
        isStale: false,
        isUnavailable: true,
        isError: false,
        items: [],
        reason: `Transport layer execution failure: ${err?.message || String(err)}`,
        sourceReferences: [],
        eventReferences: [],
        evidenceReferences: [],
      };
    }

    // 4. Adapt Canonical Response to PDL Domain Result
    return this.adaptResponse(requestId, responsePayload);
  }

  private validateContext(context: PdlTaskQueryContext): string | null {
    if (!context) return 'Query context is mandatory';
    if (!context.taskId || typeof context.taskId !== 'string' || !context.taskId.trim()) {
      return "Field 'taskId' must be a non-empty string";
    }
    if (!context.projectId || typeof context.projectId !== 'string' || !context.projectId.trim()) {
      return "Field 'projectId' must be a non-empty string";
    }
    if (!context.repository || typeof context.repository !== 'string' || !context.repository.trim()) {
      return "Field 'repository' must be a non-empty string";
    }
    if (!context.objective || typeof context.objective !== 'string' || !context.objective.trim()) {
      return "Field 'objective' must be a non-empty string";
    }
    if (context.requestedKnowledgeClasses) {
      for (const kc of context.requestedKnowledgeClasses) {
        if (!CANONICAL_KNOWLEDGE_CLASSES.includes(kc)) {
          return `Invalid knowledge class '${kc}'. Allowed: ${CANONICAL_KNOWLEDGE_CLASSES.join(', ')}`;
        }
      }
    }
    return null;
  }

  private adaptResponse(
    fallbackRequestId: string,
    res: NeuralQueryResponsePayload
  ): PdlNeuralQueryResult {
    const requestId = res.request_id || fallbackRequestId;
    const status = res.status || 'INTERNAL_ERROR';

    const isSuccess = status === 'SUCCESS';
    const isAbstention = status === 'ABSTAIN';
    const isUnavailable = status === 'UNAVAILABLE';
    const isError = status === 'INTERNAL_ERROR' || status === 'INVALID_REQUEST';

    // Map Knowledge Items ensuring DATA-ONLY guarantee
    const items: NeuralKnowledgeItem[] = (res.results || []).map((raw) => {
      const authLevel = (raw.authority?.level as AuthorityLevel) || 'VALIDATED_KNOWLEDGE';
      const rank = raw.authority?.rank ?? (AUTHORITY_RANKS[authLevel] || 2);

      const provenance: NeuralProvenanceMetadata = {
        sourceId: raw.provenance?.source_id ?? null,
        originatingEventId: raw.provenance?.originating_event_id ?? null,
        evidenceId: raw.provenance?.evidence_id ?? null,
        repository: raw.provenance?.repository ?? null,
        commitSha: raw.provenance?.commit_sha ?? null,
        filePath: raw.provenance?.file_path ?? null,
        startLine: raw.provenance?.start_line ?? null,
        endLine: raw.provenance?.end_line ?? null,
        exactQuote: raw.provenance?.exact_quote ?? null,
        contentHash: raw.provenance?.content_hash ?? null,
        capturedAt: raw.provenance?.captured_at ?? null,
        observedAt: raw.provenance?.observed_at ?? null,
        storageUri: raw.provenance?.storage_uri ?? null,
      };

      const freshnessState = (raw.freshness?.state as FreshnessState) || 'VALID';
      const isItemStale = Boolean(raw.freshness?.is_stale || freshnessState === 'STALE');

      return {
        id: raw.id,
        knowledgeClass: (raw.knowledge_class as KnowledgeClass) || 'DECISION',
        title: raw.title,
        content: raw.content,
        scope: (raw.scope?.toUpperCase() === 'PROJECT' ? 'PROJECT' : 'GLOBAL') as 'GLOBAL' | 'PROJECT',
        projectId: raw.project_id ?? null,
        relevanceScore: typeof raw.relevance_score === 'number' ? raw.relevance_score : 0,
        confidenceScore: typeof raw.confidence_score === 'number' ? raw.confidence_score : 1,
        promotionState: (raw.promotion_state as PromotionState) || 'VALIDATED',
        conflictState: (raw.conflict_state as ConflictState) || 'RESOLVED',
        authority: {
          level: authLevel,
          rank,
          // CRITICAL INVARIANT: Neural knowledge is DATA, never executable command
          isDataOnly: true,
          description: raw.authority?.description ?? 'Neural knowledge contextual data',
        },
        provenance,
        freshness: {
          state: freshnessState,
          isStale: isItemStale,
          checkedAt: raw.freshness?.checked_at ?? null,
          divergedCommitSha: raw.freshness?.diverged_commit_sha ?? null,
          validFrom: raw.freshness?.valid_from ?? null,
          validUntil: raw.freshness?.valid_until ?? null,
          reason: raw.freshness?.reason ?? null,
        },
      };
    });

    const isStale = status === 'STALE' || items.some((it) => it.freshness.isStale);

    // Map Abstention Metadata
    let abstention: NeuralAbstentionMetadata | undefined;
    if (res.abstention) {
      abstention = {
        abstained: Boolean(res.abstention.abstained),
        decisionReason: res.abstention.decision_reason || 'ABSTAIN_DEFAULT',
        topDenseSimilarity: res.abstention.top_dense_similarity,
        topRrfScore: res.abstention.top_rrf_score,
        lexicalCandidateCount: res.abstention.lexical_candidate_count,
        denseCandidateCount: res.abstention.dense_candidate_count,
        thresholdApplied: res.abstention.threshold_applied,
      };
    }

    // Map Contradictions
    const contradictions: NeuralContradictionItem[] = (res.contradictions || []).map((c) => ({
      itemAId: c.item_a_id,
      itemBId: c.item_b_id,
      reason: c.reason,
    }));

    // Collect distinct references
    const sourceReferences = Array.from(
      new Set(
        (res.source_references || []).concat(
          items.map((i) => i.provenance.sourceId).filter(Boolean) as string[]
        )
      )
    );
    const eventReferences = Array.from(
      new Set(
        (res.event_references || []).concat(
          items.map((i) => i.provenance.originatingEventId).filter(Boolean) as string[]
        )
      )
    );
    const evidenceReferences = Array.from(
      new Set(
        (res.evidence_references || []).concat(
          items.map((i) => i.provenance.evidenceId).filter(Boolean) as string[]
        )
      )
    );

    return {
      requestId,
      status,
      isSuccess,
      isAbstention,
      isStale,
      isUnavailable,
      isError,
      items,
      abstention,
      contradictions: contradictions.length > 0 ? contradictions : undefined,
      reason: res.reason ?? undefined,
      metadata: res.metadata,
      sourceReferences,
      eventReferences,
      evidenceReferences,
    };
  }
}
