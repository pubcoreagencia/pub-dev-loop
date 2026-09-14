/**
 * Canonical Query Contracts and Enums for PDL <-> PUB Neural integration.
 * Mirrors the canonical schemas established in PUB Neural Phase A & Phase B.
 */

export type KnowledgeClass =
  | 'DECISION'
  | 'RULE'
  | 'GOVERNANCE'
  | 'PATTERN'
  | 'LESSON'
  | 'SKILL'
  | 'PROJECT'
  | 'REPOSITORY';

export const CANONICAL_KNOWLEDGE_CLASSES: readonly KnowledgeClass[] = [
  'DECISION',
  'RULE',
  'GOVERNANCE',
  'PATTERN',
  'LESSON',
  'SKILL',
  'PROJECT',
  'REPOSITORY',
] as const;

export type GateStatus =
  | 'SUCCESS'
  | 'NO_MATCH'
  | 'ABSTAIN'
  | 'CONFLICT'
  | 'STALE'
  | 'UNAVAILABLE'
  | 'INVALID_REQUEST'
  | 'INTERNAL_ERROR';

export type AuthorityLevel =
  | 'RUNTIME_DIRECT_EVIDENCE'
  | 'REAL_EXECUTION'
  | 'TEST_EVIDENCE'
  | 'VALIDATED_KNOWLEDGE'
  | 'HISTORICAL_MEMORY';

export const AUTHORITY_RANKS: Record<AuthorityLevel, number> = {
  HISTORICAL_MEMORY: 1,
  VALIDATED_KNOWLEDGE: 2,
  TEST_EVIDENCE: 3,
  REAL_EXECUTION: 4,
  RUNTIME_DIRECT_EVIDENCE: 5,
};

export type FreshnessState = 'VALID' | 'STALE' | 'UNKNOWN' | 'EXPIRED';

export type ConflictState =
  | 'RESOLVED'
  | 'CONTRADICTORY'
  | 'BLOCKED'
  | 'SUPERSEDED'
  | 'DEPRECATED'
  | 'REJECTED';

export type PromotionState =
  | 'CAPTURED'
  | 'OBSERVED'
  | 'EXTRACTED'
  | 'CANDIDATE'
  | 'VALIDATED'
  | 'ADOPTED'
  | 'INSTITUTIONAL_CANDIDATE'
  | 'INSTITUTIONAL';

export interface NeuralCallerIdentity {
  actorId: string;
  agentRole?: string;
  trustZone?: string;
}

export interface NeuralProvenanceMetadata {
  sourceId?: string | null;
  originatingEventId?: string | null;
  evidenceId?: string | null;
  repository?: string | null;
  commitSha?: string | null;
  filePath?: string | null;
  startLine?: number | null;
  endLine?: number | null;
  exactQuote?: string | null;
  contentHash?: string | null;
  capturedAt?: string | null;
  observedAt?: string | null;
  storageUri?: string | null;
}

export interface NeuralAuthorityMetadata {
  level: AuthorityLevel;
  rank: number;
  isDataOnly: true;
  description?: string | null;
}

export interface NeuralFreshnessMetadata {
  state: FreshnessState;
  isStale: boolean;
  checkedAt?: string | null;
  divergedCommitSha?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  reason?: string | null;
}

export interface NeuralAbstentionMetadata {
  abstained: boolean;
  decisionReason: string;
  topDenseSimilarity?: number | null;
  topRrfScore?: number | null;
  lexicalCandidateCount?: number;
  denseCandidateCount?: number;
  thresholdApplied?: number | null;
}

export interface NeuralKnowledgeItem {
  id: string;
  knowledgeClass: KnowledgeClass;
  title: string;
  content: string;
  scope: 'GLOBAL' | 'PROJECT';
  projectId?: string | null;
  relevanceScore: number;
  confidenceScore: number;
  promotionState: PromotionState;
  conflictState: ConflictState;
  authority: NeuralAuthorityMetadata;
  provenance: NeuralProvenanceMetadata;
  freshness: NeuralFreshnessMetadata;
}

export interface NeuralContradictionItem {
  itemAId: string;
  itemBId: string;
  reason: string;
}

export interface NeuralQueryRequestPayload {
  request_id: string;
  task_id: string;
  project_id: string;
  repository: string;
  objective: string;
  requested_knowledge_classes: KnowledgeClass[];
  caller: {
    actor_id: string;
    agent_role?: string | null;
    trust_zone: string;
  };
  timestamp: string;
  branch?: string | null;
  commit_sha?: string | null;
  filters?: Record<string, unknown>;
  limit?: number;
}

export interface NeuralQueryResponsePayload {
  request_id: string;
  status: GateStatus;
  results?: Array<{
    id: string;
    knowledge_class: string;
    title: string;
    content: string;
    scope: string;
    project_id?: string | null;
    relevance_score?: number;
    confidence_score?: number;
    promotion_state?: string;
    conflict_state?: string;
    authority?: {
      level: string;
      rank?: number;
      is_data_only: boolean;
      description?: string | null;
    };
    provenance?: {
      source_id?: string | null;
      originating_event_id?: string | null;
      evidence_id?: string | null;
      repository?: string | null;
      commit_sha?: string | null;
      file_path?: string | null;
      start_line?: number | null;
      end_line?: number | null;
      exact_quote?: string | null;
      content_hash?: string | null;
      captured_at?: string | null;
      observed_at?: string | null;
      storage_uri?: string | null;
    };
    freshness?: {
      state: string;
      is_stale: boolean;
      checked_at?: string | null;
      diverged_commit_sha?: string | null;
      valid_from?: string | null;
      valid_until?: string | null;
      reason?: string | null;
    };
  }>;
  abstention?: {
    abstained: boolean;
    decision_reason: string;
    top_dense_similarity?: number | null;
    top_rrf_score?: number | null;
    lexical_candidate_count?: number;
    dense_candidate_count?: number;
    threshold_applied?: number | null;
  } | null;
  reason?: string | null;
  contradictions?: Array<{
    item_a_id: string;
    item_b_id: string;
    reason: string;
  }>;
  metadata?: Record<string, unknown>;
  source_references?: string[];
  event_references?: string[];
  evidence_references?: string[];
}
