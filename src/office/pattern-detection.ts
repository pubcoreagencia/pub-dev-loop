import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { defaultLessonCandidateEngine } from './lesson-candidate.js';

export type PatternStatus = 'ACTIVE' | 'SUPERSEDED' | 'BLOCKED';

export interface CorroborationMetadata {
  observationCount: number;
  independentTaskCount: number;
  independentAgentCount: number;
  independentProjectCount: number;
  reviewerConfirmedCount: number;
  qaConfirmedCount: number;
  remediationVerifiedCount: number;
}

export interface OrganizationalPattern {
  id: string;
  tenantId: string;
  projectId: string;
  signature: string;
  status: PatternStatus;
  component: string;
  taskType: string;
  ruleId?: string;
  remediationSignature?: string;
  recurrenceCount: number;
  supportingMemoryIds: string[];
  supportingEventIds: string[];
  supportingTaskIds: string[];
  supportingAgentIds: string[];
  corroboration: CorroborationMetadata;
  firstObservedAt: string;
  lastObservedAt: string;
  metadata: Record<string, any>;
  provenance: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface PatternObservationInput {
  tenantId?: string;
  projectId: string;
  component?: string;
  taskType?: string;
  ruleId?: string;
  findingText: string;
  remediationText?: string;
  memoryId?: string;
  eventId?: string;
  taskId?: string;
  actorId?: string;
  reviewerConfirmed?: boolean;
  qaConfirmed?: boolean;
  remediationVerified?: boolean;
  source?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

/**
 * Normalizes error and finding strings deterministically.
 * Strips dynamic variables (timestamps, epochs, PIDs, filesystem paths, line numbers)
 * while preserving semantic identifiers and rule tags.
 */
export function normalizeFindingText(text: string): string {
  if (!text) return '';
  let s = text.trim();
  // Strip ISO timestamps
  s = s.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/gi, '<TIMESTAMP>');
  // Strip unix epochs / large millisecond numbers
  s = s.replace(/\b17\d{10,}\b/g, '<EPOCH>');
  // Strip process IDs
  s = s.replace(/(\[pid:\s*\d+\]|pid[:=\s]+\d+)/gi, '<PID>');
  // Strip absolute and temporary filesystem paths
  s = s.replace(/([a-zA-Z]:[\\/][^\s:'",]+|\/(?:tmp|var|private|Users)[^\s:'",]+)/g, '<PATH>');
  // Strip file:// URIs
  s = s.replace(/file:\/\/\/[^\s:'",]+/g, '<FILE_URL>');
  // Normalize line and column numbers (e.g. :123:45 -> :line)
  s = s.replace(/:\d+(:\d+)?/g, ':<LINE>');
  // Normalize whitespace
  s = s.replace(/\s+/g, ' ');
  return s.toLowerCase().trim();
}

/**
 * Computes canonical SHA-256 pattern signature deterministically.
 */
export function computePatternSignature(input: {
  tenantId: string;
  projectId: string;
  component: string;
  taskType: string;
  ruleId?: string;
  normalizedFinding: string;
  normalizedRemediation?: string;
}): string {
  const tenant = input.tenantId.trim().toLowerCase();
  const project = input.projectId.trim().toLowerCase();
  const component = (input.component || 'general').trim().toLowerCase();
  const taskType = (input.taskType || 'task').trim().toLowerCase();
  const ruleId = (input.ruleId || 'NONE').trim().toUpperCase();
  const finding = input.normalizedFinding.trim();
  const remediation = (input.normalizedRemediation || 'NONE').trim();

  const payload = `${tenant}::${project}::${component}::${taskType}::${ruleId}::${finding}::${remediation}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Deterministic Pattern Detection Engine.
 * Transforms verified observations into auditable organizational_pattern records.
 * STRICT NON-GOAL: Does NOT promote patterns to lessons or alter agent prompt context.
 */
export class PatternDetectionEngine {
  private patterns = new Map<string, OrganizationalPattern>();
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.pool = pool;
  }

  setPool(pool: Pool): void {
    this.pool = pool;
  }

  async processObservation(input: PatternObservationInput): Promise<OrganizationalPattern | null> {
    const tenantId = input.tenantId?.trim() || 'pub-dev-loop';
    const projectId = input.projectId?.trim();
    if (!projectId) {
      return null;
    }

    // Trusted inputs validation: reject untrusted or free text sources
    if (input.source === 'AGENT_CONVERSATION' || input.source === 'USER_CHAT') {
      return null;
    }

    const component = (input.component || 'general').trim();
    const taskType = (input.taskType || 'task').trim();
    const ruleId = input.ruleId?.trim() ? input.ruleId.trim().toUpperCase() : undefined;
    const normalizedFinding = normalizeFindingText(input.findingText);
    const normalizedRemediation = input.remediationText ? normalizeFindingText(input.remediationText) : undefined;

    if (!normalizedFinding) {
      return null;
    }

    const signature = computePatternSignature({
      tenantId,
      projectId,
      component,
      taskType,
      ruleId,
      normalizedFinding,
      normalizedRemediation,
    });

    const now = input.timestamp || new Date().toISOString();
    const patternKey = `${tenantId}:${projectId}:${signature}`;
    const existing = this.patterns.get(patternKey);

    if (existing) {
      existing.recurrenceCount += 1;
      existing.lastObservedAt = now;
      existing.updatedAt = now;

      // Append supporting identifiers without duplicates
      if (input.memoryId && !existing.supportingMemoryIds.includes(input.memoryId)) {
        existing.supportingMemoryIds.push(input.memoryId);
      }
      if (input.eventId && !existing.supportingEventIds.includes(input.eventId)) {
        existing.supportingEventIds.push(input.eventId);
      }
      if (input.taskId && !existing.supportingTaskIds.includes(input.taskId)) {
        existing.supportingTaskIds.push(input.taskId);
      }
      if (input.actorId && !existing.supportingAgentIds.includes(input.actorId)) {
        existing.supportingAgentIds.push(input.actorId);
      }

      // Update corroboration dimensions
      existing.corroboration.observationCount = existing.recurrenceCount;
      existing.corroboration.independentTaskCount = existing.supportingTaskIds.length;
      existing.corroboration.independentAgentCount = existing.supportingAgentIds.length;
      existing.corroboration.independentProjectCount = 1;
      if (input.reviewerConfirmed) {
        existing.corroboration.reviewerConfirmedCount += 1;
      }
      if (input.qaConfirmed) {
        existing.corroboration.qaConfirmedCount += 1;
      }
      if (input.remediationVerified) {
        existing.corroboration.remediationVerifiedCount += 1;
      }

      if (this.pool) {
        try {
          await this.pool.query(
            `UPDATE organizational_patterns SET
              recurrence_count = $1,
              supporting_memory_ids = $2,
              supporting_event_ids = $3,
              supporting_task_ids = $4,
              supporting_agent_ids = $5,
              corroboration = $6,
              last_observed_at = $7,
              updated_at = now()
            WHERE tenant_id = $8 AND project_id = $9 AND signature = $10`,
            [
              existing.recurrenceCount,
              JSON.stringify(existing.supportingMemoryIds),
              JSON.stringify(existing.supportingEventIds),
              JSON.stringify(existing.supportingTaskIds),
              JSON.stringify(existing.supportingAgentIds),
              JSON.stringify(existing.corroboration),
              existing.lastObservedAt,
              tenantId,
              projectId,
              signature,
            ]
          );
        } catch (err: any) {
          console.error('[PatternDetection] Notice: Failed to update DB pattern:', err.message);
        }
      }

      // Background candidate evaluation (failure isolated)
      try {
        await defaultLessonCandidateEngine.evaluateAndUpsertCandidate(existing);
      } catch {
        // Failure isolation
      }

      return existing;
    }

    const id = `pat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const supportingMemoryIds = input.memoryId ? [input.memoryId] : [];
    const supportingEventIds = input.eventId ? [input.eventId] : [];
    const supportingTaskIds = input.taskId ? [input.taskId] : [];
    const supportingAgentIds = input.actorId ? [input.actorId] : [];

    const corroboration: CorroborationMetadata = {
      observationCount: 1,
      independentTaskCount: supportingTaskIds.length,
      independentAgentCount: supportingAgentIds.length,
      independentProjectCount: 1,
      reviewerConfirmedCount: input.reviewerConfirmed ? 1 : 0,
      qaConfirmedCount: input.qaConfirmed ? 1 : 0,
      remediationVerifiedCount: input.remediationVerified ? 1 : 0,
    };

    const pattern: OrganizationalPattern = {
      id,
      tenantId,
      projectId,
      signature,
      status: 'ACTIVE',
      component,
      taskType,
      ruleId,
      remediationSignature: normalizedRemediation,
      recurrenceCount: 1,
      supportingMemoryIds,
      supportingEventIds,
      supportingTaskIds,
      supportingAgentIds,
      corroboration,
      firstObservedAt: now,
      lastObservedAt: now,
      metadata: input.metadata || {},
      provenance: {
        projectId,
        actorId: input.actorId || 'system',
        source: input.source || 'RUNTIME_EXECUTION',
        verifiedAt: now,
        epistemicStatus: 'DERIVED',
      },
      createdAt: now,
      updatedAt: now,
    };

    this.patterns.set(patternKey, pattern);

    if (this.pool) {
      try {
        await this.pool.query(
          `INSERT INTO organizational_patterns (
            id, tenant_id, project_id, signature, status, component, task_type,
            rule_id, remediation_signature, recurrence_count, supporting_memory_ids,
            supporting_event_ids, supporting_task_ids, supporting_agent_ids, corroboration,
            first_observed_at, last_observed_at, metadata, provenance, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (tenant_id, project_id, signature)
          DO UPDATE SET
            recurrence_count = organizational_patterns.recurrence_count + 1,
            last_observed_at = EXCLUDED.last_observed_at,
            updated_at = now()`,
          [
            pattern.id,
            pattern.tenantId,
            pattern.projectId,
            pattern.signature,
            pattern.status,
            pattern.component,
            pattern.taskType,
            pattern.ruleId || null,
            pattern.remediationSignature || null,
            pattern.recurrenceCount,
            JSON.stringify(pattern.supportingMemoryIds),
            JSON.stringify(pattern.supportingEventIds),
            JSON.stringify(pattern.supportingTaskIds),
            JSON.stringify(pattern.supportingAgentIds),
            JSON.stringify(pattern.corroboration),
            pattern.firstObservedAt,
            pattern.lastObservedAt,
            JSON.stringify(pattern.metadata),
            JSON.stringify(pattern.provenance),
            pattern.createdAt,
            pattern.updatedAt,
          ]
        );
      } catch (err: any) {
        console.error('[PatternDetection] Notice: Failed to insert DB pattern:', err.message);
      }
    }

    // Background candidate evaluation (failure isolated)
    try {
      await defaultLessonCandidateEngine.evaluateAndUpsertCandidate(pattern);
    } catch {
      // Failure isolation
    }

    return pattern;
  }

  async getBySignature(signature: string, projectId: string, tenantId = 'pub-dev-loop'): Promise<OrganizationalPattern | null> {
    const patternKey = `${tenantId}:${projectId}:${signature}`;
    return this.patterns.get(patternKey) || null;
  }

  async listByProject(projectId: string, tenantId = 'pub-dev-loop', limit = 20): Promise<OrganizationalPattern[]> {
    return Array.from(this.patterns.values())
      .filter((p) => p.tenantId === tenantId && p.projectId === projectId)
      .slice(0, limit);
  }

  async updateStatus(
    signature: string,
    projectId: string,
    targetStatus: PatternStatus,
    tenantId = 'pub-dev-loop'
  ): Promise<boolean> {
    const pattern = await this.getBySignature(signature, projectId, tenantId);
    if (!pattern) return false;

    pattern.status = targetStatus;
    pattern.updatedAt = new Date().toISOString();

    if (this.pool) {
      try {
        await this.pool.query(
          `UPDATE organizational_patterns SET status = $1, updated_at = now() WHERE tenant_id = $2 AND project_id = $3 AND signature = $4`,
          [targetStatus, tenantId, projectId, signature]
        );
      } catch (err: any) {
        console.error('[PatternDetection] Notice: Failed to update pattern status in DB:', err.message);
      }
    }
    return true;
  }
}

export const defaultPatternDetectionEngine = new PatternDetectionEngine();
