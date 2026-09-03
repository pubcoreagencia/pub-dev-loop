import type { Task } from '../domain.js';
import type { OrganizationalMemory } from './memory.js';
import type { InstitutionalLesson } from './lesson-validation.js';
import type { SkillRecord } from './skills.js';
import { formatInstitutionalLessonContext } from './lesson-retrieval.js';
import {
  formatDeveloperMemoryContext,
  formatArchitectMemoryContext,
  formatReviewerMemoryContext,
  formatQaMemoryContext,
  formatChiefOfStaffMemoryContext,
} from './memory.js';

export type ContextAuthority = 'CURRENT' | 'GOVERNED' | 'HISTORICAL';

export type ContextSource =
  | 'CEO_OBJECTIVE'
  | 'PROJECT_STATE'
  | 'CURRENT_TASK'
  | 'RUNTIME_EVIDENCE'
  | 'REVIEW_EVIDENCE'
  | 'QA_EVIDENCE'
  | 'SECURITY_EVIDENCE'
  | 'DEPENDENCY_CONTEXT'
  | 'INSTITUTIONAL_LESSON'
  | 'DAILY_SKILL'
  | 'ORGANIZATIONAL_MEMORY';

export type OfficeAgentRole =
  | 'chief-of-staff'
  | 'architect'
  | 'developer'
  | 'reviewer'
  | 'qa-engineer';

export interface ContextBlockProvenance {
  tenantId: string;
  projectId: string;
  taskId?: string;
  agentId?: string;
  eventId?: string;
  memoryId?: string;
  lessonId?: string;
  skillId?: string;
  reviewId?: string;
  approvalId?: string;
}

export interface ContextBlock {
  id: string;
  source: ContextSource;
  authority: ContextAuthority;
  priority: number;
  title: string;
  content: string;
  provenance: ContextBlockProvenance;
  metadata?: Record<string, any>;
}

export interface ContextBudget {
  currentContextMaxChars: number;
  governedContextMaxChars: number;
  historicalContextMaxChars: number;
  totalContextMaxChars: number;
}

export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  currentContextMaxChars: 10000,
  governedContextMaxChars: 2000,
  historicalContextMaxChars: 2000,
  totalContextMaxChars: 15000,
};

export interface AgentRoleProfile {
  role: OfficeAgentRole;
  allowedSources: ContextSource[];
  sourcePriorities: Record<ContextSource, number>;
}

export const ROLE_PROFILES: Record<OfficeAgentRole, AgentRoleProfile> = {
  'chief-of-staff': {
    role: 'chief-of-staff',
    allowedSources: [
      'CEO_OBJECTIVE',
      'PROJECT_STATE',
      'CURRENT_TASK',
      'RUNTIME_EVIDENCE',
      'SECURITY_EVIDENCE',
      'INSTITUTIONAL_LESSON',
      'DAILY_SKILL',
      'ORGANIZATIONAL_MEMORY',
    ],
    sourcePriorities: {
      CEO_OBJECTIVE: 100,
      PROJECT_STATE: 90,
      CURRENT_TASK: 80,
      RUNTIME_EVIDENCE: 70,
      SECURITY_EVIDENCE: 60,
      REVIEW_EVIDENCE: 50,
      QA_EVIDENCE: 45,
      DEPENDENCY_CONTEXT: 40,
      INSTITUTIONAL_LESSON: 30,
      DAILY_SKILL: 25,
      ORGANIZATIONAL_MEMORY: 10,
    },
  },
  architect: {
    role: 'architect',
    allowedSources: [
      'PROJECT_STATE',
      'CURRENT_TASK',
      'RUNTIME_EVIDENCE',
      'SECURITY_EVIDENCE',
      'REVIEW_EVIDENCE',
      'DEPENDENCY_CONTEXT',
      'INSTITUTIONAL_LESSON',
      'DAILY_SKILL',
      'ORGANIZATIONAL_MEMORY',
    ],
    sourcePriorities: {
      PROJECT_STATE: 95,
      CURRENT_TASK: 90,
      RUNTIME_EVIDENCE: 80,
      SECURITY_EVIDENCE: 75,
      REVIEW_EVIDENCE: 70,
      DEPENDENCY_CONTEXT: 65,
      CEO_OBJECTIVE: 60,
      QA_EVIDENCE: 50,
      INSTITUTIONAL_LESSON: 30,
      DAILY_SKILL: 25,
      ORGANIZATIONAL_MEMORY: 10,
    },
  },
  developer: {
    role: 'developer',
    allowedSources: [
      'CURRENT_TASK',
      'PROJECT_STATE',
      'RUNTIME_EVIDENCE',
      'REVIEW_EVIDENCE',
      'QA_EVIDENCE',
      'SECURITY_EVIDENCE',
      'DEPENDENCY_CONTEXT',
      'INSTITUTIONAL_LESSON',
      'DAILY_SKILL',
      'ORGANIZATIONAL_MEMORY',
    ],
    sourcePriorities: {
      CURRENT_TASK: 100,
      RUNTIME_EVIDENCE: 90,
      PROJECT_STATE: 80,
      REVIEW_EVIDENCE: 75,
      QA_EVIDENCE: 70,
      SECURITY_EVIDENCE: 65,
      DEPENDENCY_CONTEXT: 60,
      CEO_OBJECTIVE: 50,
      INSTITUTIONAL_LESSON: 30,
      DAILY_SKILL: 25,
      ORGANIZATIONAL_MEMORY: 10,
    },
  },
  reviewer: {
    role: 'reviewer',
    allowedSources: [
      'CURRENT_TASK',
      'RUNTIME_EVIDENCE',
      'REVIEW_EVIDENCE',
      'SECURITY_EVIDENCE',
      'QA_EVIDENCE',
      'PROJECT_STATE',
      'DEPENDENCY_CONTEXT',
      'INSTITUTIONAL_LESSON',
      'DAILY_SKILL',
      'ORGANIZATIONAL_MEMORY',
    ],
    sourcePriorities: {
      CURRENT_TASK: 100,
      REVIEW_EVIDENCE: 95,
      SECURITY_EVIDENCE: 90,
      RUNTIME_EVIDENCE: 85,
      QA_EVIDENCE: 75,
      PROJECT_STATE: 70,
      DEPENDENCY_CONTEXT: 60,
      CEO_OBJECTIVE: 50,
      INSTITUTIONAL_LESSON: 30,
      DAILY_SKILL: 25,
      ORGANIZATIONAL_MEMORY: 10,
    },
  },
  'qa-engineer': {
    role: 'qa-engineer',
    allowedSources: [
      'CURRENT_TASK',
      'RUNTIME_EVIDENCE',
      'QA_EVIDENCE',
      'REVIEW_EVIDENCE',
      'PROJECT_STATE',
      'DEPENDENCY_CONTEXT',
      'INSTITUTIONAL_LESSON',
      'DAILY_SKILL',
      'ORGANIZATIONAL_MEMORY',
    ],
    sourcePriorities: {
      CURRENT_TASK: 100,
      QA_EVIDENCE: 95,
      RUNTIME_EVIDENCE: 90,
      REVIEW_EVIDENCE: 80,
      PROJECT_STATE: 70,
      DEPENDENCY_CONTEXT: 60,
      SECURITY_EVIDENCE: 55,
      CEO_OBJECTIVE: 50,
      INSTITUTIONAL_LESSON: 30,
      DAILY_SKILL: 25,
      ORGANIZATIONAL_MEMORY: 10,
    },
  },
};

export interface ContextAssemblyDiagnostics {
  totalInputBlocks: number;
  totalIncludedBlocks: number;
  totalDroppedBlocks: number;
  totalTruncatedBlocks: number;
  authorityConflictsCount: number;
  untrustedClaimsCount: number;
  durationMs: number;
}

export interface ContextAssemblyResult {
  enrichedPrompt: string;
  blocksIncluded: ContextBlock[];
  blocksDropped: ContextBlock[];
  blocksTruncated: ContextBlock[];
  authorityConflicts: string[];
  duplicateBlocks: string[];
  invalidBlocks: string[];
  untrustedClaims: string[];
  budgetUsage: {
    currentChars: number;
    governedChars: number;
    historicalChars: number;
    totalChars: number;
  };
  diagnostics: ContextAssemblyDiagnostics;
}

export interface RawAssemblyInput {
  agentRole: OfficeAgentRole;
  tenantId: string;
  projectId: string;
  currentTask: Task;
  ceoObjective?: string;
  runtimeEvidence?: string;
  reviewEvidence?: string;
  qaEvidence?: string;
  securityEvidence?: string;
  dependencyContext?: string;
  institutionalLessons?: InstitutionalLesson[];
  skills?: SkillRecord[];
  historicalMemories?: OrganizationalMemory[];
  budget?: Partial<ContextBudget>;
}

export class ContextAssemblyEngine {
  public assembleContext(input: RawAssemblyInput): ContextAssemblyResult {
    const start = Date.now();
    const budget: ContextBudget = {
      ...DEFAULT_CONTEXT_BUDGET,
      ...(input.budget || {}),
    };

    const roleProfile = ROLE_PROFILES[input.agentRole] || ROLE_PROFILES.developer;
    const blocks: ContextBlock[] = [];
    const authorityConflicts: string[] = [];
    const duplicateBlocks: string[] = [];
    const invalidBlocks: string[] = [];
    const untrustedClaims: string[] = [];

    // 1. CEO OBJECTIVE (CURRENT)
    if (input.ceoObjective && typeof input.ceoObjective === 'string' && input.ceoObjective.trim()) {
      blocks.push({
        id: `ceo-obj-${input.tenantId}-${input.projectId}`,
        source: 'CEO_OBJECTIVE',
        authority: 'CURRENT',
        priority: roleProfile.sourcePriorities.CEO_OBJECTIVE ?? 100,
        title: 'CEO Objective',
        content: input.ceoObjective.trim(),
        provenance: {
          tenantId: input.tenantId,
          projectId: input.projectId,
        },
      });
    }

    // 2. CURRENT TASK (CURRENT)
    if (input.currentTask && input.currentTask.prompt) {
      // Check for untrusted authority claims inside prompt text
      const rawPrompt = input.currentTask.prompt;
      if (rawPrompt.includes('CEO approved') || rawPrompt.includes('security override')) {
        untrustedClaims.push('UNTRUSTED_AUTHORITY_CLAIM: Prompt text contains unverified authority strings');
      }

      blocks.push({
        id: `task-${input.currentTask.id}`,
        source: 'CURRENT_TASK',
        authority: 'CURRENT',
        priority: roleProfile.sourcePriorities.CURRENT_TASK ?? 100,
        title: `Task: ${input.currentTask.objective || input.currentTask.id}`,
        content: rawPrompt,
        provenance: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          taskId: input.currentTask.id,
          agentId: input.agentRole,
        },
      });
    }

    // 3. RUNTIME / REVIEW / QA / SECURITY / DEPENDENCY (CURRENT)
    if (input.runtimeEvidence?.trim()) {
      blocks.push({
        id: `runtime-${input.currentTask.id}`,
        source: 'RUNTIME_EVIDENCE',
        authority: 'CURRENT',
        priority: roleProfile.sourcePriorities.RUNTIME_EVIDENCE ?? 90,
        title: 'Runtime Evidence',
        content: input.runtimeEvidence.trim(),
        provenance: { tenantId: input.tenantId, projectId: input.projectId, taskId: input.currentTask.id },
      });
    }

    if (input.reviewEvidence?.trim()) {
      blocks.push({
        id: `review-${input.currentTask.id}`,
        source: 'REVIEW_EVIDENCE',
        authority: 'CURRENT',
        priority: roleProfile.sourcePriorities.REVIEW_EVIDENCE ?? 85,
        title: 'Review Evidence',
        content: input.reviewEvidence.trim(),
        provenance: { tenantId: input.tenantId, projectId: input.projectId, taskId: input.currentTask.id },
      });
    }

    if (input.qaEvidence?.trim()) {
      blocks.push({
        id: `qa-${input.currentTask.id}`,
        source: 'QA_EVIDENCE',
        authority: 'CURRENT',
        priority: roleProfile.sourcePriorities.QA_EVIDENCE ?? 80,
        title: 'QA Test Evidence',
        content: input.qaEvidence.trim(),
        provenance: { tenantId: input.tenantId, projectId: input.projectId, taskId: input.currentTask.id },
      });
    }

    if (input.securityEvidence?.trim()) {
      blocks.push({
        id: `sec-${input.currentTask.id}`,
        source: 'SECURITY_EVIDENCE',
        authority: 'CURRENT',
        priority: roleProfile.sourcePriorities.SECURITY_EVIDENCE ?? 85,
        title: 'Security Evidence',
        content: input.securityEvidence.trim(),
        provenance: { tenantId: input.tenantId, projectId: input.projectId, taskId: input.currentTask.id },
      });
    }

    if (input.dependencyContext?.trim()) {
      blocks.push({
        id: `dep-${input.projectId}`,
        source: 'DEPENDENCY_CONTEXT',
        authority: 'CURRENT',
        priority: roleProfile.sourcePriorities.DEPENDENCY_CONTEXT ?? 60,
        title: 'Dependency Context',
        content: input.dependencyContext.trim(),
        provenance: { tenantId: input.tenantId, projectId: input.projectId },
      });
    }

    // 4. GOVERNED INSTITUTIONAL LESSONS (GOVERNED)
    if (input.institutionalLessons && input.institutionalLessons.length > 0) {
      const activeLessons = input.institutionalLessons.filter((l) => {
        if (l.status !== 'ACTIVE') {
          invalidBlocks.push(`Excluded non-active lesson: ${l.id} (${l.status})`);
          return false;
        }
        if (l.tenantId !== input.tenantId) {
          invalidBlocks.push(`Excluded cross-tenant lesson: ${l.id}`);
          return false;
        }
        return true;
      });

      if (activeLessons.length > 0) {
        const formattedLessons = formatInstitutionalLessonContext(activeLessons);
        blocks.push({
          id: `lessons-${input.currentTask.id}`,
          source: 'INSTITUTIONAL_LESSON',
          authority: 'GOVERNED',
          priority: roleProfile.sourcePriorities.INSTITUTIONAL_LESSON ?? 30,
          title: 'Governed Institutional Lessons',
          content: formattedLessons,
          provenance: {
            tenantId: input.tenantId,
            projectId: input.projectId,
            taskId: input.currentTask.id,
          },
        });
      }
    }

    // 5. GOVERNED DAILY SKILLS (GOVERNED)
    if (input.skills && input.skills.length > 0) {
      const activeSkills = input.skills.filter((s) => {
        if (s.status !== 'ACTIVE') {
          invalidBlocks.push(`Excluded non-active skill: ${s.id} (${s.status})`);
          return false;
        }
        if (s.tenantId !== input.tenantId) {
          invalidBlocks.push(`Excluded cross-tenant skill: ${s.id}`);
          return false;
        }
        return true;
      });

      if (activeSkills.length > 0) {
        const formattedSkills = activeSkills
          .map(
            (s) =>
              `[Skill: ${s.name} (v${s.version})]\nCapability: ${s.capability}\nGuideline: ${s.executableGuideline}\nLimitations: ${s.limitations.join('; ')}`
          )
          .join('\n\n');

        blocks.push({
          id: `skills-${input.currentTask.id}`,
          source: 'DAILY_SKILL',
          authority: 'GOVERNED',
          priority: roleProfile.sourcePriorities.DAILY_SKILL ?? 25,
          title: 'Reusable Organizational Skills',
          content: formattedSkills,
          provenance: {
            tenantId: input.tenantId,
            projectId: input.projectId,
            taskId: input.currentTask.id,
          },
        });
      }
    }

    // 6. HISTORICAL ORGANIZATIONAL MEMORY (HISTORICAL)
    if (input.historicalMemories && input.historicalMemories.length > 0) {
      const validMemories = input.historicalMemories.filter((m) => {
        if (m.status !== 'ACTIVE') {
          invalidBlocks.push(`Excluded non-active memory: ${m.id} (${m.status})`);
          return false;
        }
        if (m.tenantId !== input.tenantId) {
          invalidBlocks.push(`Excluded cross-tenant memory: ${m.id}`);
          return false;
        }
        return true;
      });

      if (validMemories.length > 0) {
        let formattedMemory = '';
        switch (input.agentRole) {
          case 'chief-of-staff':
            formattedMemory = formatChiefOfStaffMemoryContext(validMemories);
            break;
          case 'architect':
            formattedMemory = formatArchitectMemoryContext(validMemories);
            break;
          case 'reviewer':
            formattedMemory = formatReviewerMemoryContext(validMemories);
            break;
          case 'qa-engineer':
            formattedMemory = formatQaMemoryContext(validMemories);
            break;
          case 'developer':
          default:
            formattedMemory = formatDeveloperMemoryContext(validMemories);
            break;
        }

        blocks.push({
          id: `memories-${input.currentTask.id}`,
          source: 'ORGANIZATIONAL_MEMORY',
          authority: 'HISTORICAL',
          priority: roleProfile.sourcePriorities.ORGANIZATIONAL_MEMORY ?? 10,
          title: 'Organizational Memory',
          content: formattedMemory,
          provenance: {
            tenantId: input.tenantId,
            projectId: input.projectId,
            taskId: input.currentTask.id,
          },
        });
      }
    }

    // 6. DEDUPLICATION (by Block ID)
    const seenIds = new Set<string>();
    const uniqueBlocks: ContextBlock[] = [];
    for (const b of blocks) {
      if (seenIds.has(b.id)) {
        duplicateBlocks.push(b.id);
      } else {
        seenIds.add(b.id);
        uniqueBlocks.push(b);
      }
    }

    // 7. DETERMINISTIC ORDERING:
    // Authority order: CURRENT (3) > GOVERNED (2) > HISTORICAL (1)
    // Then by Priority (descending)
    // Then by ID (lexicographic)
    const authorityRank = (a: ContextAuthority): number => {
      if (a === 'CURRENT') return 3;
      if (a === 'GOVERNED') return 2;
      return 1;
    };

    uniqueBlocks.sort((a, b) => {
      const aAuth = authorityRank(a.authority);
      const bAuth = authorityRank(b.authority);
      if (aAuth !== bAuth) {
        return bAuth - aAuth;
      }
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.id.localeCompare(b.id);
    });

    // 8. BUDGET ENFORCEMENT & TRUNCATION
    const blocksIncluded: ContextBlock[] = [];
    const blocksDropped: ContextBlock[] = [];
    const blocksTruncated: ContextBlock[] = [];

    let currentChars = 0;
    let governedChars = 0;
    let historicalChars = 0;

    for (const block of uniqueBlocks) {
      const blockLen = block.content.length;

      if (block.authority === 'CURRENT') {
        if (currentChars + blockLen <= budget.currentContextMaxChars) {
          currentChars += blockLen;
          blocksIncluded.push(block);
        } else {
          // Truncate current only if needed
          const remaining = budget.currentContextMaxChars - currentChars;
          if (remaining > 100) {
            const truncatedBlock = {
              ...block,
              content: block.content.slice(0, remaining) + '... [truncated for budget]',
            };
            currentChars += truncatedBlock.content.length;
            blocksIncluded.push(truncatedBlock);
            blocksTruncated.push(truncatedBlock);
          } else {
            blocksDropped.push(block);
          }
        }
      } else if (block.authority === 'GOVERNED') {
        if (governedChars + blockLen <= budget.governedContextMaxChars) {
          governedChars += blockLen;
          blocksIncluded.push(block);
        } else {
          const remaining = budget.governedContextMaxChars - governedChars;
          if (remaining > 100) {
            const truncatedBlock = {
              ...block,
              content: block.content.slice(0, remaining) + '... [truncated for budget]',
            };
            governedChars += truncatedBlock.content.length;
            blocksIncluded.push(truncatedBlock);
            blocksTruncated.push(truncatedBlock);
          } else {
            blocksDropped.push(block);
          }
        }
      } else {
        // HISTORICAL
        if (historicalChars + blockLen <= budget.historicalContextMaxChars) {
          historicalChars += blockLen;
          blocksIncluded.push(block);
        } else {
          const remaining = budget.historicalContextMaxChars - historicalChars;
          if (remaining > 100) {
            const truncatedBlock = {
              ...block,
              content: block.content.slice(0, remaining) + '... [truncated for budget]',
            };
            historicalChars += truncatedBlock.content.length;
            blocksIncluded.push(truncatedBlock);
            blocksTruncated.push(truncatedBlock);
          } else {
            blocksDropped.push(block);
          }
        }
      }
    }

    // 9. FINAL PROMPT RENDERING
    const promptParts = blocksIncluded.map((b) => b.content.trim()).filter(Boolean);
    const enrichedPrompt = promptParts.join('\n\n');

    const totalChars = currentChars + governedChars + historicalChars;
    const durationMs = Date.now() - start;

    return {
      enrichedPrompt,
      blocksIncluded,
      blocksDropped,
      blocksTruncated,
      authorityConflicts,
      duplicateBlocks,
      invalidBlocks,
      untrustedClaims,
      budgetUsage: {
        currentChars,
        governedChars,
        historicalChars,
        totalChars,
      },
      diagnostics: {
        totalInputBlocks: blocks.length,
        totalIncludedBlocks: blocksIncluded.length,
        totalDroppedBlocks: blocksDropped.length,
        totalTruncatedBlocks: blocksTruncated.length,
        authorityConflictsCount: authorityConflicts.length,
        untrustedClaimsCount: untrustedClaims.length,
        durationMs,
      },
    };
  }
}

export const defaultContextAssemblyEngine = new ContextAssemblyEngine();
