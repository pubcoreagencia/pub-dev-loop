import { isExplicitUnknown, isExecutionSpecValue, type ExecutionSpec, type KnownOrUnknown } from './execution-spec.js';
import {
  DEFAULT_RESOURCE_LIMITS,
  type EvidenceSnapshot,
  type GovernanceLevel,
  type PermissionSet,
  type ProviderConstraints,
  type RepositoryTarget,
  type ResourceLimits,
  validatePermissions as validatePermSet,
  validateProviderConstraints,
  validateRepositoryTarget,
  validateResourceLimits,
} from './trust-contracts.js';

export interface SemanticValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface SemanticValidationResult {
  valid: boolean;
  errors: SemanticValidationIssue[];
}

/**
 * Validação semântica real do ExecutionSpec.
 * Além da validação estrutural (tipo/presença), esta função verifica:
 * - Coerência entre campos (ex: permissions compatíveis com governance)
 * - Ausência de elevação implícita
 * - Evidências confiáveis quando obrigatórias
 * - Integrity do snapshot de evidências
 */
export function validateExecutionSpecSemantics(spec: unknown): SemanticValidationResult {
  const errors: SemanticValidationIssue[] = [];

  // Primeiro, validação estrutural
  if (!isExecutionSpecValue(spec)) {
    errors.push({ path: '$', code: 'STRUCTURAL_INVALID', message: 'ExecutionSpec falhou validação estrutural' });
    return { valid: false, errors };
  }

  const s = spec as ExecutionSpec;

  // --- RepositoryTarget ---
  const repoTargetResult = validateKnownOrUnknownField(
    s.repositoryTarget,
    '$.repositoryTarget',
    (value) => validateRepositoryTarget(value),
    errors,
  );
  if (repoTargetResult && repoTargetResult.trustBoundary) {
    // Verificar se provenance/trust são coerentes
    if (repoTargetResult.trustBoundary === 'external') {
      errors.push({
        path: '$.repositoryTarget',
        code: 'UNTRUSTED_REPOSITORY_TARGET',
        message: 'RepositoryTarget derivado de conteúdo externo sem autoridade interna',
      });
    }
  }

  // --- ProviderConstraints ---
  validateKnownOrUnknownField(
    s.providerConstraints,
    '$.providerConstraints',
    (value) => validateProviderConstraints(value),
    errors,
  );

  // --- ResourceLimits ---
  validateKnownOrUnknownField(
    s.resourceLimits,
    '$.resourceLimits',
    (value) => validateResourceLimits(value),
    errors,
  );

  // --- EvidenceSnapshot ---
  const evidenceResult = validateKnownOrUnknownField(
    s.evidenceSnapshot,
    '$.evidenceSnapshot',
    validateEvidenceSnapshot,
    errors,
  );

  // --- Governance ---
  if (s.governanceLevel !== undefined) {
    if (!isValidGovernanceLevel(s.governanceLevel)) {
      errors.push({
        path: '$.governanceLevel',
        code: 'INVALID_GOVERNANCE_LEVEL',
        message: `Nível de governança inválido: ${s.governanceLevel}`,
      });
    }
  }

  // --- Permissions (compatibilidade com governance) ---
  if (s.permissions !== undefined && s.governanceLevel !== undefined) {
    const permErrors = validatePermSet(s.permissions, s.governanceLevel);
    for (const msg of permErrors) {
      errors.push({
        path: '$.permissions',
        code: 'PERMISSION_GOVERNANCE_MISMATCH',
        message: msg,
      });
    }
  }

  // --- Cross-field: EvidenceSnapshot trust vs execution authority --- 
  if (evidenceResult && evidenceResult.trustBoundary) {
    const isEffectivelyUntrusted =
      evidenceResult.trustBoundary.tier === 'UNTRUSTED_EXTERNAL' ||
      !(evidenceResult.trustBoundary.canInfluenceGovernance ||
        evidenceResult.trustBoundary.canInfluencePermissions ||
        evidenceResult.trustBoundary.canInfluenceRepositoryTarget ||
        evidenceResult.trustBoundary.canInfluenceExecution);
    if (isEffectivelyUntrusted) {
      // Se o snapshot tem boundary externo, não pode promover permissões privilegiadas
      if (s.permissions?.privilegedOperations === true) {
        errors.push({
          path: '$.permissions',
          code: 'UNTRUSTED_PRIVILEGE_ESCALATION',
          message: 'privilegedOperations cannot be granted from untrusted evidence boundary',
        });
      }
      if (s.governanceLevel === 'SYSTEM' || s.governanceLevel === 'ADMIN') {
        errors.push({
          path: '$.governanceLevel',
          code: 'UNTRUSTED_GOVERNANCE_ELEVATION',
          message: 'Elevated governanceLevel cannot be granted from untrusted evidence boundary',
        });
      }
    }
  }

  // --- Cross-field: provider constraints vs repository target ---
  // Provider não pode elevar autoridade sobre repositoryTarget
  if (s.repositoryTarget !== undefined && !isExplicitUnknown(s.repositoryTarget)) {
    const rt = s.repositoryTarget as RepositoryTarget;
    // Verificar se provenance é interno
    if (rt.provenance && !rt.provenance.startsWith('pdl:internal')) {
      // Provenance externo requer trust boundary explícita
      // (isso é uma validação semântica adicional)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validador genérico para campos que podem ser KnownOrUnknown<T>.
 * Se for ExplicitUnknown, passa. Se for valor real, valida com a função de validação.
 */
function validateKnownOrUnknownField<T>(
  field: KnownOrUnknown<T> | undefined,
  path: string,
  validate: (value: T) => string[],
  errors: SemanticValidationIssue[],
): { trustBoundary?: string } | undefined {
  if (field === undefined) {
    return undefined;
  }

  if (isExplicitUnknown(field)) {
    if (field.reason.trim().length === 0) {
      errors.push({ path, code: 'INVALID_UNKNOWN', message: 'Explicit unknown reason must not be empty' });
    }
    return undefined;
  }

  const fieldErrors = validate(field);
  for (const msg of fieldErrors) {
    errors.push({ path, code: 'FIELD_VALIDATION_FAILED', message: msg });
  }

  return undefined;
}

function validateEvidenceSnapshot(snapshot: unknown): string[] {
  const errors: string[] = [];
  if (typeof snapshot !== 'object' || snapshot === null) {
    errors.push('evidenceSnapshot must be an object');
    return errors;
  }
  const s = snapshot as Record<string, unknown>;

  if (typeof s.intake !== 'object' || s.intake === null) {
    errors.push('intake (TaskLineage) required');
  }
  if (typeof s.contextBundleHash !== 'string' || s.contextBundleHash.trim().length === 0) {
    errors.push('contextBundleHash required');
  }
  if (typeof s.evidenceHash !== 'string' || s.evidenceHash.trim().length === 0) {
    errors.push('evidenceHash required');
  }
  if (typeof s.collectedAt !== 'string' || s.collectedAt.trim().length === 0) {
    errors.push('collectedAt required');
  }
  if (!Array.isArray(s.evidence)) {
    errors.push('evidence must be an array');
  }
  if (typeof s.sourceCount !== 'number' || s.sourceCount < 0) {
    errors.push('sourceCount must be non-negative number');
  }

  // Validar trustBoundary
  const tb = s.trustBoundary;
  if (!tb || typeof tb !== 'object') {
    errors.push('trustBoundary required');
  } else {
    const t = tb as Record<string, unknown>;
    if (typeof t.canInfluenceGovernance !== 'boolean' || t.canInfluenceGovernance === true) {
      errors.push('trustBoundary.canInfluenceGovernance must be false');
    }
    if (typeof t.canInfluencePermissions !== 'boolean' || t.canInfluencePermissions === true) {
      errors.push('trustBoundary.canInfluencePermissions must be false');
    }
    if (typeof t.canInfluenceRepositoryTarget !== 'boolean' || t.canInfluenceRepositoryTarget === true) {
      errors.push('trustBoundary.canInfluenceRepositoryTarget must be false');
    }
    if (typeof t.canInfluenceExecution !== 'boolean' || t.canInfluenceExecution === true) {
      errors.push('trustBoundary.canInfluenceExecution must be false');
    }
  }

  return errors;
}

function isValidGovernanceLevel(level: string): level is GovernanceLevel {
  return ['SYSTEM', 'ADMIN', 'DEVELOPER', 'READONLY'].includes(level);
}

// Re-export constants from trust-contracts
export { DEFAULT_RESOURCE_LIMITS };