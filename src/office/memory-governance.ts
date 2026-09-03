import type { MemoryStatus, MemoryType, MemoryEpistemicStatus, MemorySource, OrganizationalMemory } from './memory.js';

export interface TransitionContext {
  actorId: string;
  reason?: string;
  supersededBy?: string;
  forceAdminOverride?: boolean;
}

export interface TransitionResult {
  valid: boolean;
  fromStatus: MemoryStatus;
  toStatus: MemoryStatus;
  error?: string;
}

export interface MemoryQualityMetadata {
  provenanceCompleteness: number; // 0.0 - 1.0
  sourceAuthority: 'HIGH' | 'MEDIUM' | 'LOW';
  recurrenceCount: number;
  temporalValidity: 'CURRENT' | 'HISTORICAL' | 'OBSOLETE';
  isGoverned: boolean;
}

export type ContradictionClassification = 'COEXISTING' | 'SUPERSEDED' | 'CONTRADICTORY_UNRESOLVED';

export interface ContradictionAnalysis {
  classification: ContradictionClassification;
  rationale: string;
  canAutoSupersede: boolean;
}

export interface UntrustedClaimInput {
  text: string;
  claimedType: MemoryType;
  actorId: string;
  source?: string;
}

export class MemoryGovernanceEngine {
  /**
   * Validates state machine transitions:
   * Allowed: ACTIVE -> SUPERSEDED, ACTIVE -> BLOCKED
   * Disallowed: SUPERSEDED -> ACTIVE, BLOCKED -> ACTIVE (without explicit admin override)
   * Disallowed: SUPERSEDED -> SUPERSEDED, BLOCKED -> BLOCKED
   */
  validateStatusTransition(
    currentStatus: MemoryStatus,
    targetStatus: MemoryStatus,
    context?: TransitionContext
  ): TransitionResult {
    if (currentStatus === targetStatus) {
      return {
        valid: false,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        error: `INVALID_TRANSITION: Memory is already in status '${currentStatus}'.`,
      };
    }

    if (currentStatus === 'ACTIVE') {
      if (targetStatus === 'SUPERSEDED') {
        if (!context?.supersededBy) {
          return {
            valid: false,
            fromStatus: currentStatus,
            toStatus: targetStatus,
            error: 'INVALID_SUPERSEDING: Transition to SUPERSEDED requires explicit supersededBy ID.',
          };
        }
        return { valid: true, fromStatus: currentStatus, toStatus: targetStatus };
      }

      if (targetStatus === 'BLOCKED') {
        return { valid: true, fromStatus: currentStatus, toStatus: targetStatus };
      }
    }

    if (currentStatus === 'SUPERSEDED') {
      if (context?.forceAdminOverride) {
        return { valid: true, fromStatus: currentStatus, toStatus: targetStatus };
      }
      return {
        valid: false,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        error: 'INVALID_TRANSITION: SUPERSEDED memories cannot silently reactivate.',
      };
    }

    if (currentStatus === 'BLOCKED') {
      if (context?.forceAdminOverride) {
        return { valid: true, fromStatus: currentStatus, toStatus: targetStatus };
      }
      return {
        valid: false,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        error: 'INVALID_TRANSITION: BLOCKED memories cannot silently reactivate without explicit unblocking.',
      };
    }

    return {
      valid: false,
      fromStatus: currentStatus,
      toStatus: targetStatus,
      error: `INVALID_TRANSITION: Unsupported status transition from '${currentStatus}' to '${targetStatus}'.`,
    };
  }

  /**
   * Validates supersession relations between two memories:
   * Rejects cross-tenant, cross-project (unless GLOBAL scope), self-supersession, or inactive memories.
   */
  validateSupersession(
    oldMemory: OrganizationalMemory,
    newMemoryOrId: OrganizationalMemory | string,
    tenantId: string
  ): { valid: boolean; error?: string } {
    if (!oldMemory) {
      return { valid: false, error: 'INVALID_ARGUMENTS: Target memory must exist.' };
    }

    if (oldMemory.tenantId !== tenantId) {
      return { valid: false, error: 'TENANT_MISMATCH: Cross-tenant supersession is strictly forbidden.' };
    }

    const newId = typeof newMemoryOrId === 'string' ? newMemoryOrId : newMemoryOrId.id;

    if (oldMemory.id === newId) {
      return { valid: false, error: 'SELF_SUPERSEDING: A memory cannot supersede itself.' };
    }

    if (typeof newMemoryOrId !== 'string') {
      const newMemory = newMemoryOrId;
      if (newMemory.tenantId !== tenantId) {
        return { valid: false, error: 'TENANT_MISMATCH: Cross-tenant supersession is strictly forbidden.' };
      }
      if (oldMemory.scope === 'PROJECT' && newMemory.scope === 'PROJECT' && oldMemory.projectId !== newMemory.projectId) {
        return { valid: false, error: 'PROJECT_MISMATCH: Cross-project supersession is strictly forbidden.' };
      }
      if (newMemory.status !== 'ACTIVE') {
        return {
          valid: false,
          error: `INVALID_STATE: New replacement memory '${newMemory.id}' must be ACTIVE (current: ${newMemory.status}).`,
        };
      }
    }

    if (oldMemory.status !== 'ACTIVE') {
      return {
        valid: false,
        error: `INVALID_STATE: Target memory '${oldMemory.id}' is not ACTIVE (current: ${oldMemory.status}).`,
      };
    }

    return { valid: true };
  }

  /**
   * Computes objective, decomposable quality metadata.
   * Separates Authority (provenance source) from Factual Quality (completeness/recency).
   */
  computeQualityMetadata(memory: OrganizationalMemory): MemoryQualityMetadata {
    const p = memory.provenance;
    let completeness = 0.0;
    if (p && p.projectId && p.actorId && p.source && p.verifiedAt) {
      completeness += 0.8;
      if (p.eventId || p.taskId || p.planId || p.ruleId) {
        completeness += 0.2;
      }
    }

    let sourceAuthority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
    if (p.source === 'CEO_DECISION' || p.source === 'REVIEW_INSPECTION') {
      sourceAuthority = 'HIGH';
    } else if (p.source === 'RUNTIME_EXECUTION' || p.source === 'ORGANIZATIONAL_PLAN') {
      sourceAuthority = 'MEDIUM';
    }

    let temporalValidity: 'CURRENT' | 'HISTORICAL' | 'OBSOLETE' = 'CURRENT';
    if (memory.status === 'SUPERSEDED' || memory.status === 'BLOCKED') {
      temporalValidity = 'OBSOLETE';
    } else {
      const createdTime = new Date(memory.createdAt).getTime();
      const ageMs = Date.now() - (isNaN(createdTime) ? Date.now() : createdTime);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (ageMs > sevenDaysMs) {
        temporalValidity = 'HISTORICAL';
      }
    }

    return {
      provenanceCompleteness: Math.min(1.0, completeness),
      sourceAuthority,
      recurrenceCount: memory.recurrenceCount || 1,
      temporalValidity,
      isGoverned: true,
    };
  }

  /**
   * Analyzes potential contradictions between two memories.
   * Unresolved contradictions are marked CONTRADICTORY_UNRESOLVED and NEVER auto-supersede.
   */
  analyzeContradiction(
    memoryA: OrganizationalMemory,
    memoryB: OrganizationalMemory
  ): ContradictionAnalysis {
    if (memoryA.tenantId !== memoryB.tenantId || memoryA.projectId !== memoryB.projectId) {
      return {
        classification: 'COEXISTING',
        rationale: 'Memories belong to different tenants or projects and naturally coexist.',
        canAutoSupersede: false,
      };
    }

    if (
      memoryA.metadata?.supersededBy === memoryB.id ||
      memoryB.metadata?.supersededBy === memoryA.id
    ) {
      return {
        classification: 'SUPERSEDED',
        rationale: 'Explicit supersession link is recorded between these memories.',
        canAutoSupersede: false,
      };
    }

    // If both are ACTIVE in the same project and type, but with differing content/titles
    if (memoryA.status === 'ACTIVE' && memoryB.status === 'ACTIVE' && memoryA.type === memoryB.type) {
      if (memoryA.title !== memoryB.title || memoryA.content !== memoryB.content) {
        return {
          classification: 'CONTRADICTORY_UNRESOLVED',
          rationale: 'Memories share domain and type but differ in content without an explicit supersession link.',
          canAutoSupersede: false,
        };
      }
    }

    return {
      classification: 'COEXISTING',
      rationale: 'Memories represent distinct observations or compatible guidelines.',
      canAutoSupersede: false,
    };
  }

  /**
   * Memory Poisoning Guard:
   * Protects against agent conversational text attempting to create DECISION or DECIDED facts without trusted events.
   */
  validateUntrustedClaim(claim: UntrustedClaimInput): { allowed: boolean; error?: string } {
    const textLower = claim.text.toLowerCase();

    // Check if untrusted agent text claims CEO decision or policy authority
    if (
      (claim.claimedType === 'DECISION' || claim.claimedType === 'LESSON') &&
      claim.source !== 'CEO_DECISION' &&
      claim.actorId !== 'ceo'
    ) {
      return {
        allowed: false,
        error: `MEMORY_POISONING_REJECTED: Actor '${claim.actorId}' cannot formulate DECISION or LESSON without trusted backend event.`,
      };
    }

    if (textLower.includes('ceo approved') && claim.source !== 'CEO_DECISION') {
      return {
        allowed: false,
        error: 'MEMORY_POISONING_REJECTED: Conversational claims of CEO approval cannot create authoritative DECISION memories.',
      };
    }

    return { allowed: true };
  }
}

export const defaultMemoryGovernanceEngine = new MemoryGovernanceEngine();
