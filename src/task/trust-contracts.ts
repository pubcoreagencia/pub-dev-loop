import { stableHash } from './hash.js';
import type { TaskLineage } from './execution-spec.js';

// === 1. EVIDENCE PROVENANCE ===

export type EvidenceSourceType =
  | 'EXTERNAL_DOCUMENT'
  | 'EXTERNAL_RESEARCH'
  | 'README'
  | 'ISSUE'
  | 'COMMENT'
  | 'INTERNAL_CONTEXT'
  | 'REPOSITORY_INSPECTION'
  | 'USER_INPUT';

export type EvidenceTrustLevel = 'TRUSTED' | 'UNVERIFIED' | 'UNTRUSTED';

export type EvidenceClassification = 'SAFE' | 'SUSPICIOUS' | 'MALICIOUS' | 'UNKNOWN';

export interface Evidence {
  evidenceId: string;
  source: string;
  sourceType: EvidenceSourceType;
  provenance: string;
  content: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  collectedAt: string;
  trustLevel: EvidenceTrustLevel;
  promptInjectionRisk: EvidenceClassification;
  promptInjectionEvidence?: PromptInjectionEvidence;
  validationStatus: 'VALIDATED' | 'UNVALIDATED' | 'REJECTED';
  canInfluenceExecution: boolean;
  required?: boolean;
  sourceMetadata?: Record<string, unknown>;
}

export const PROMPT_INJECTION_PATTERNS = [
  /\bignore\s+(?:the\s+)?(?:pdl\s+)?governance\b/i,
  /\b(?:bypass|override)\s+(?:the\s+)?(?:governance|permissions|trust)\b/i,
  /\bpush\s+directly\s+to\s+(?:repository|repo)\b/i,
  /\b(?:change|replace|elevate)\s+(?:governance|permissions|repository\s+target|execution\s+authority)\b/i,
  /\bdo\s+not\s+(?:follow|obey)\s+(?:pdl|policy|governance)\b/i,
] as const;

export function classifyPromptInjection(content: string): PromptInjectionEvidence {
  const patterns = PROMPT_INJECTION_PATTERNS
    .filter((pattern) => pattern.test(content))
    .map((pattern) => pattern.toString());
  const detected = patterns.length > 0;
  const classification: EvidenceClassification = detected
    ? (patterns.some((pattern) => /ignore|bypass|override|do not/i.test(pattern) ? true : false) ? 'MALICIOUS' : 'SUSPICIOUS')
    : 'UNKNOWN';
  return {
    detected,
    classification,
    patterns,
    source: 'content-classifier',
    preserved: detected,
  };
}

export function normalizeEvidence(input: {
  source: string;
  sourceType: EvidenceSourceType;
  provenance: string;
  content: string;
  collectedAt?: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  trustLevel?: EvidenceTrustLevel;
  validationStatus?: 'VALIDATED' | 'UNVALIDATED' | 'REJECTED';
  canInfluenceExecution?: boolean;
  required?: boolean;
  sourceMetadata?: Record<string, unknown>;
}): Evidence {
  const promptInjectionEvidence = classifyPromptInjection(input.content);
  const trustLevel = input.trustLevel ?? (promptInjectionEvidence.detected ? 'UNTRUSTED' : 'UNVERIFIED');
  const validationStatus = input.validationStatus ?? (promptInjectionEvidence.detected ? 'REJECTED' : 'UNVALIDATED');
  return {
    evidenceId: stableHash(`evidence:${input.provenance}:${input.source}:${input.content}`),
    source: input.source.trim() || 'unknown',
    sourceType: input.sourceType,
    provenance: input.provenance.trim() || 'unknown',
    content: input.content,
    confidence: input.confidence ?? 'LOW',
    collectedAt: input.collectedAt ?? new Date().toISOString(),
    trustLevel,
    promptInjectionRisk: promptInjectionEvidence.classification,
    promptInjectionEvidence,
    validationStatus,
    canInfluenceExecution: input.canInfluenceExecution ?? false,
    required: input.required ?? false,
    sourceMetadata: input.sourceMetadata,
  };
}

// === 2. TRUST BOUNDARY ===

export type TrustTier = 'TRUSTED_CONTROL' | 'UNTRUSTED_EXTERNAL' | 'DERIVED';

export interface TrustBoundary {
  tier: TrustTier;
  data: unknown;
  origin: string;
  canInfluenceGovernance: boolean;
  canInfluencePermissions: boolean;
  canInfluenceRepositoryTarget: boolean;
  canInfluenceExecution: boolean;
}

// === 3. PROMPT INJECTION ===

export interface PromptInjectionEvidence {
  detected: boolean;
  classification: EvidenceClassification;
  patterns: string[];
  source: string;
  preserved: boolean;
}

// === 4. GOVERNANCE ===

export type GovernanceLevel = 'SYSTEM' | 'ADMIN' | 'DEVELOPER' | 'READONLY';

export type GovernanceAction =
  | 'READ_REPOSITORY'
  | 'WRITE_REPOSITORY'
  | 'COMMIT'
  | 'PUSH'
  | 'EXECUTE_EXTERNAL_RESEARCH'
  | 'OPERATE_EXTERNAL_REPOSITORY'
  | 'MODIFY_GOVERNANCE'
  | 'MODIFY_PERMISSIONS'
  | 'ELEVATE_PRIVILEGES';

export interface GovernanceRule {
  level: GovernanceLevel;
  allowedActions: GovernanceAction[];
  requiresApproval: boolean;
  maxExternalRepos: number;
  maxExecutionSteps: number;
  maxTimeoutSeconds: number;
  canCommit: boolean;
  canPush: boolean;
  canOperateExternalRepos: boolean;
}

export const DEFAULT_GOVERNANCE_RULES: Record<GovernanceLevel, GovernanceRule> = {
  SYSTEM: {
    level: 'SYSTEM',
    allowedActions: [
      'READ_REPOSITORY',
      'WRITE_REPOSITORY',
      'COMMIT',
      'PUSH',
      'EXECUTE_EXTERNAL_RESEARCH',
      'OPERATE_EXTERNAL_REPOSITORY',
      'MODIFY_GOVERNANCE',
      'MODIFY_PERMISSIONS',
      'ELEVATE_PRIVILEGES',
    ],
    requiresApproval: false,
    maxExternalRepos: 100,
    maxExecutionSteps: 500,
    maxTimeoutSeconds: 3600,
    canCommit: true,
    canPush: true,
    canOperateExternalRepos: true,
  },
  ADMIN: {
    level: 'ADMIN',
    allowedActions: [
      'READ_REPOSITORY',
      'WRITE_REPOSITORY',
      'COMMIT',
      'PUSH',
      'EXECUTE_EXTERNAL_RESEARCH',
    ],
    requiresApproval: false,
    maxExternalRepos: 10,
    maxExecutionSteps: 200,
    maxTimeoutSeconds: 1800,
    canCommit: true,
    canPush: true,
    canOperateExternalRepos: true,
  },
  DEVELOPER: {
    level: 'DEVELOPER',
    allowedActions: [
      'READ_REPOSITORY',
      'WRITE_REPOSITORY',
      'COMMIT',
      'EXECUTE_EXTERNAL_RESEARCH',
    ],
    requiresApproval: true,
    maxExternalRepos: 3,
    maxExecutionSteps: 100,
    maxTimeoutSeconds: 600,
    canCommit: true,
    canPush: false,
    canOperateExternalRepos: false,
  },
  READONLY: {
    level: 'READONLY',
    allowedActions: ['READ_REPOSITORY'],
    requiresApproval: true,
    maxExternalRepos: 0,
    maxExecutionSteps: 0,
    maxTimeoutSeconds: 0,
    canCommit: false,
    canPush: false,
    canOperateExternalRepos: false,
  },
};

export interface GovernanceContract {
  governanceLevel: GovernanceLevel;
  rules: GovernanceRule;
  inheritedFrom?: string;
  effectiveAt: string;
}

// === 5. PERMISSIONS ===

export type PermissionType =
  | 'REPOSITORY_READ'
  | 'REPOSITORY_WRITE'
  | 'BRANCH_WRITE'
  | 'COMMIT'
  | 'PUSH'
  | 'EXTERNAL_RESEARCH'
  | 'FILESYSTEM_WORKSPACE'
  | 'PRIVILEGED_OPERATIONS';

export interface PermissionSet {
  repositoryRead: boolean;
  repositoryWrite: boolean;
  branchWrite: boolean;
  commit: boolean;
  push: boolean;
  externalResearch: boolean;
  filesystemWorkspace: boolean;
  privilegedOperations: boolean;
}

export interface PermissionsContract {
  permissions: PermissionSet;
  governanceLevel: GovernanceLevel;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  constraints: string[];
}

export function defaultPermissionsFor(level: GovernanceLevel): PermissionSet {
  const rules = DEFAULT_GOVERNANCE_RULES[level];
  return {
    repositoryRead: rules.allowedActions.includes('READ_REPOSITORY'),
    repositoryWrite: rules.allowedActions.includes('WRITE_REPOSITORY'),
    branchWrite: rules.allowedActions.includes('WRITE_REPOSITORY'),
    commit: rules.canCommit,
    push: rules.canPush,
    externalResearch: rules.allowedActions.includes('EXECUTE_EXTERNAL_RESEARCH'),
    filesystemWorkspace: rules.level !== 'READONLY',
    privilegedOperations: rules.level === 'SYSTEM',
  };
}

export function validatePermissions(perms: PermissionSet, level: GovernanceLevel): string[] {
  const errors: string[] = [];
  const allowed = defaultPermissionsFor(level);
  if (perms.commit && !allowed.commit) errors.push('commit not allowed for governance level');
  if (perms.push && !allowed.push) errors.push('push not allowed for governance level');
  if (perms.privilegedOperations && !allowed.privilegedOperations) errors.push('privileged operations not allowed');
  return errors;
}

// === 6. REPOSITORY TARGET ===

export interface RepositoryIdentity {
  owner: string;
  name: string;
  fullName: string;
}

export interface RepositoryTarget {
  identity: RepositoryIdentity;
  scmProvider: string; // 'git', 'hg', 'svn', etc. — explícito, não hardcoded GitHub
  remote: string;
  branch: string;
  workspace: string;
  baseRevision: string;
  authorization: string;
  provenance: string;
  lineage: TaskLineage;
  isDefault: boolean;
}

export function createRepositoryTarget(
  identity: RepositoryIdentity,
  scmProvider: string,
  remote: string,
  branch: string,
  workspace: string,
  baseRevision: string,
  authorization: string,
  provenance: string,
  lineage: TaskLineage,
  isDefault = false,
): RepositoryTarget {
  return {
    identity,
    scmProvider,
    remote,
    branch,
    workspace,
    baseRevision,
    authorization,
    provenance,
    lineage,
    isDefault,
  };
}

export function validateRepositoryTarget(target: unknown): string[] {
  const errors: string[] = [];
  if (typeof target !== 'object' || target === null) {
    errors.push('repository target must be an object');
    return errors;
  }
  const t = target as Record<string, unknown>;
  if (!t.identity || typeof t.identity !== 'object') errors.push('identity required');
  else {
    const i = t.identity as Record<string, unknown>;
    if (typeof i.owner !== 'string' || i.owner.trim().length === 0) errors.push('owner required');
    if (typeof i.name !== 'string' || i.name.trim().length === 0) errors.push('name required');
    if (typeof i.fullName !== 'string' || i.fullName.trim().length === 0) errors.push('fullName required');
  }
  if (typeof t.remote !== 'string' || t.remote.trim().length === 0) errors.push('remote required');
  if (typeof t.branch !== 'string' || t.branch.trim().length === 0) errors.push('branch required');
  if (typeof t.workspace !== 'string' || t.workspace.trim().length === 0) errors.push('workspace required');
  if (typeof t.baseRevision !== 'string' || t.baseRevision.trim().length === 0) errors.push('baseRevision required');
  if (typeof t.authorization !== 'string' || t.authorization.trim().length === 0) errors.push('authorization required');
  if (typeof t.provenance !== 'string' || t.provenance.trim().length === 0) errors.push('provenance required');
  if (!t.lineage) errors.push('lineage required');
  if (typeof t.isDefault !== 'boolean') errors.push('isDefault must be boolean');
  return errors;
}

// === 7. PROVIDER CONSTRAINTS ===

export type ProviderIdentity = '9ROUTER' | 'OPENROUTER' | 'ANTHROPIC' | 'OPENAI' | 'LOCAL' | 'OTHER';

export interface ProviderConstraints {
  provider: ProviderIdentity;
  allowedModels?: string[];
  disallowedModels?: string[];
  maxTokens?: number;
  maxTemperature?: number;
  requireStructuredOutput?: boolean;
  enforceCostGuard?: boolean;
  paidFallbackAllowed?: boolean;
  maxPaidAttempts?: number;
  costCeilingUsd?: number;
  customConstraints?: Record<string, unknown>;
}

export interface ProviderGeneratedContent {
  content: string;
  model: string;
  provider: ProviderIdentity;
  trustLevel: 'TRUSTED' | 'UNVERIFIED' | 'UNTRUSTED';
  canInfluenceGovernance: false;
  canInfluencePermissions: false;
  canInfluenceRepositoryTarget: false;
  canInfluenceExecutionAuthority: false;
  usage?: { promptTokens: number; completionTokens: number; costUsd?: number };
}

export function validateProviderConstraints(constraints: unknown): string[] {
  const errors: string[] = [];
  if (typeof constraints !== 'object' || constraints === null) {
    errors.push('provider constraints must be an object');
    return errors;
  }
  const c = constraints as Record<string, unknown>;
  const validProviders = ['9ROUTER', 'OPENROUTER', 'ANTHROPIC', 'OPENAI', 'LOCAL', 'OTHER'];
  if (!c.provider || !validProviders.includes(c.provider as string)) {
    errors.push('provider must be a valid ProviderIdentity');
  }
  if (c.maxTokens !== undefined && (typeof c.maxTokens !== 'number' || !Number.isFinite(c.maxTokens) || c.maxTokens <= 0)) {
    errors.push('maxTokens must be a positive finite number');
  }
  if (c.maxTemperature !== undefined && (typeof c.maxTemperature !== 'number' || c.maxTemperature < 0 || c.maxTemperature > 2)) {
    errors.push('maxTemperature must be between 0 and 2');
  }
  if (c.maxPaidAttempts !== undefined && (typeof c.maxPaidAttempts !== 'number' || c.maxPaidAttempts < 0 || !Number.isInteger(c.maxPaidAttempts))) {
    errors.push('maxPaidAttempts must be a non-negative integer');
  }
  if (c.costCeilingUsd !== undefined && (typeof c.costCeilingUsd !== 'number' || c.costCeilingUsd < 0 || !Number.isFinite(c.costCeilingUsd))) {
    errors.push('costCeilingUsd must be a non-negative finite number');
  }
  return errors;
}

// === 8. RESOURCE LIMITS ===

export const DEFAULT_RESOURCE_LIMITS = {
  MAX_TIMEOUT_SECONDS: 3600,
  MIN_TIMEOUT_SECONDS: 1,
  MAX_RETRIES: 10,
  MAX_STEPS: 500,
  MAX_EXECUTION_SIZE_BYTES: 10 * 1024 * 1024,
  MAX_STEP_DESCRIPTION_LENGTH: 2000,
} as const;

export interface ResourceLimits {
  timeoutSeconds: number;
  maxRetries: number;
  maxSteps: number;
  maxExecutionSizeBytes: number;
  customLimits?: Record<string, number>;
}

export function createResourceLimits(overrides: Partial<ResourceLimits> = {}): ResourceLimits {
  return {
    timeoutSeconds: overrides.timeoutSeconds ?? DEFAULT_RESOURCE_LIMITS.MAX_TIMEOUT_SECONDS,
    maxRetries: overrides.maxRetries ?? DEFAULT_RESOURCE_LIMITS.MAX_RETRIES,
    maxSteps: overrides.maxSteps ?? DEFAULT_RESOURCE_LIMITS.MAX_STEPS,
    maxExecutionSizeBytes: overrides.maxExecutionSizeBytes ?? DEFAULT_RESOURCE_LIMITS.MAX_EXECUTION_SIZE_BYTES,
    customLimits: overrides.customLimits,
  };
}

export function validateResourceLimits(limits: unknown): string[] {
  const errors: string[] = [];
  if (typeof limits !== 'object' || limits === null) {
    errors.push('resource limits must be an object');
    return errors;
  }
  const l = limits as Record<string, unknown>;
  if (l.timeoutSeconds !== undefined) {
    if (typeof l.timeoutSeconds !== 'number' || !Number.isFinite(l.timeoutSeconds) || l.timeoutSeconds <= 0 || l.timeoutSeconds > DEFAULT_RESOURCE_LIMITS.MAX_TIMEOUT_SECONDS) {
      errors.push(`timeoutSeconds must be 1-${DEFAULT_RESOURCE_LIMITS.MAX_TIMEOUT_SECONDS}`);
    }
  }
  if (l.maxRetries !== undefined) {
    if (typeof l.maxRetries !== 'number' || !Number.isInteger(l.maxRetries) || l.maxRetries < 0 || l.maxRetries > DEFAULT_RESOURCE_LIMITS.MAX_RETRIES) {
      errors.push(`maxRetries must be 0-${DEFAULT_RESOURCE_LIMITS.MAX_RETRIES}`);
    }
  }
  if (l.maxSteps !== undefined) {
    if (typeof l.maxSteps !== 'number' || !Number.isInteger(l.maxSteps) || l.maxSteps < 0 || l.maxSteps > DEFAULT_RESOURCE_LIMITS.MAX_STEPS) {
      errors.push(`maxSteps must be 0-${DEFAULT_RESOURCE_LIMITS.MAX_STEPS}`);
    }
  }
  if (l.maxExecutionSizeBytes !== undefined) {
    if (typeof l.maxExecutionSizeBytes !== 'number' || !Number.isFinite(l.maxExecutionSizeBytes) || l.maxExecutionSizeBytes <= 0 || l.maxExecutionSizeBytes > DEFAULT_RESOURCE_LIMITS.MAX_EXECUTION_SIZE_BYTES) {
      errors.push(`maxExecutionSizeBytes must be 1-${DEFAULT_RESOURCE_LIMITS.MAX_EXECUTION_SIZE_BYTES}`);
    }
  }
  return errors;
}

// === EVIDENCE SNAPSHOT (shared immutable context) ===

export interface EvidenceSnapshot {
  intake: TaskLineage;
  contextBundleHash: string;
  evidenceHash: string;
  collectedAt: string;
  sourceCount: number;
  promptInjectionRisk: EvidenceClassification;
  // Additional metadata for trust boundary
  trustBoundary: TrustBoundary;
  sourceMetadata?: Record<string, unknown>; // preserved source info for audit
  evidence: readonly Evidence[]; // normalized, immutable evidence snapshot
}

export function createEvidenceSnapshot(
  intake: TaskLineage,
  contextBundleHash: string,
  evidenceHash: string,
  sourceCount: number,
  promptInjectionRisk: EvidenceClassification,
  trustBoundary: TrustBoundary,
  sourceMetadata?: Record<string, unknown>,
  evidence: Evidence[] = [],
): EvidenceSnapshot {
  const frozenEvidence = Object.freeze(evidence.map((ev) => Object.freeze({ ...ev })));
  return {
    intake,
    contextBundleHash,
    evidenceHash,
    collectedAt: new Date().toISOString(),
    sourceCount,
    promptInjectionRisk,
    trustBoundary,
    sourceMetadata,
    evidence: frozenEvidence,
  } as EvidenceSnapshot;
}

// === 10. EXECUTION INSTRUCTIONS (structured, validated, non-external) ===

export interface ExecutionInstruction {
  id: string;
  type: 'STEP' | 'BRANCH' | 'LOOP' | 'WAIT' | 'VALIDATE' | 'COMMIT';
  description: string;
  parameters?: Record<string, unknown>;
  dependsOn?: string[];
  critical: boolean;
  provenance: 'INTERNAL' | 'PROVIDER_GENERATED' | 'USER_DEFINED';
  validated: boolean;
  lineage: string;
}

export function validateExecutionInstruction(inst: unknown): string[] {
  const errors: string[] = [];
  if (typeof inst !== 'object' || inst === null) {
    errors.push('execution instruction must be an object');
    return errors;
  }
  const i = inst as Record<string, unknown>;
  if (typeof i.id !== 'string' || i.id.trim().length === 0) errors.push('id required');
  if (!['STEP', 'BRANCH', 'LOOP', 'WAIT', 'VALIDATE', 'COMMIT'].includes(i.type as string)) {
    errors.push('type must be valid instruction type');
  }
  if (typeof i.description !== 'string' || i.description.trim().length === 0) errors.push('description required');
  if (typeof i.critical !== 'boolean') errors.push('critical must be boolean');
  if (!['INTERNAL', 'PROVIDER_GENERATED', 'USER_DEFINED'].includes(i.provenance as string)) {
    errors.push('provenance must be INTERNAL | PROVIDER_GENERATED | USER_DEFINED');
  }
  if (typeof i.validated !== 'boolean') errors.push('validated must be boolean');
  if (typeof i.lineage !== 'string' || i.lineage.trim().length === 0) errors.push('lineage required');
  return errors;
}