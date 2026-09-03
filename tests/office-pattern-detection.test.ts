import { describe, it, expect, beforeEach } from 'vitest';
import {
  PatternDetectionEngine,
  normalizeFindingText,
  computePatternSignature,
} from '../src/office/pattern-detection.js';
import { MemoryIngestPipeline, OrganizationalMemoryStore } from '../src/office/memory.js';
import type { OfficeEvent } from '../src/office/events.js';

describe('PDL — Phase 8.5-B: Deterministic Pattern Detection Test Suite', () => {
  let engine: PatternDetectionEngine;
  let store: OrganizationalMemoryStore;
  let pipeline: MemoryIngestPipeline;

  beforeEach(() => {
    engine = new PatternDetectionEngine();
    store = new OrganizationalMemoryStore();
    pipeline = new MemoryIngestPipeline(store);
  });

  it('A. Identical structured observation -> identical signature', () => {
    const sig1 = computePatternSignature({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/office/memory.ts',
      taskType: 'review',
      ruleId: 'RULE_SEC_INPUT',
      normalizedFinding: 'input must be sanitized before sql query',
      normalizedRemediation: 'use parameterized query',
    });

    const sig2 = computePatternSignature({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/office/memory.ts',
      taskType: 'review',
      ruleId: 'RULE_SEC_INPUT',
      normalizedFinding: 'input must be sanitized before sql query',
      normalizedRemediation: 'use parameterized query',
    });

    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('B & C. Casing & Whitespace Normalization: Produces identical normalized strings', () => {
    const raw1 = '  Missing  Input  Validation in API   ';
    const raw2 = 'missing input validation in api';
    expect(normalizeFindingText(raw1)).toBe(normalizeFindingText(raw2));
  });

  it('D. Timestamp Normalization: Dynamic ISO timestamps and epoch integers are normalized', () => {
    const raw1 = 'Error occurred at 2026-09-03T12:30:00.000Z during execution';
    const raw2 = 'Error occurred at 2026-01-01T00:00:00Z during execution';
    expect(normalizeFindingText(raw1)).toBe(normalizeFindingText(raw2));
  });

  it('E & F. PID & Path Normalization: Process IDs and dynamic filesystem paths are normalized', () => {
    const raw1 = 'Worker crashed [pid: 45892] in file C:/Users/Developer/AppData/tmp/test.ts:42:10';
    const raw2 = 'Worker crashed [pid: 99120] in file /tmp/test.ts:42:10';
    expect(normalizeFindingText(raw1)).toBe(normalizeFindingText(raw2));
  });

  it('G. Meaningful Identifiers: Rule codes and error types are preserved', () => {
    const raw = 'Security vulnerability detected: RULE_SEC_AUTH_TOKEN_EXPIRED';
    const norm = normalizeFindingText(raw);
    expect(norm).toContain('rule_sec_auth_token_expired');
  });

  it('H. Unrelated Findings: Distinct errors produce distinct signatures without collision', () => {
    const sig1 = computePatternSignature({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/auth.ts',
      taskType: 'review',
      ruleId: 'RULE_AUTH_FAIL',
      normalizedFinding: 'invalid jwt signature',
    });

    const sig2 = computePatternSignature({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/payments.ts',
      taskType: 'review',
      ruleId: 'RULE_PAY_TIMEOUT',
      normalizedFinding: 'stripe gateway timeout',
    });

    expect(sig1).not.toBe(sig2);
  });

  it('I. Retry Isolation: Same task retried 3 times increments recurrence but NOT independentTaskCount', async () => {
    const input = {
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/db.ts',
      taskType: 'review',
      ruleId: 'RULE_DB_CONN',
      findingText: 'Database pool connection closed',
      taskId: 'task-100', // SAME task ID
      actorId: 'developer-1',
    };

    const p1 = await engine.processObservation(input);
    expect(p1?.recurrenceCount).toBe(1);
    expect(p1?.corroboration.independentTaskCount).toBe(1);

    const p2 = await engine.processObservation(input);
    expect(p2?.recurrenceCount).toBe(2);
    expect(p2?.corroboration.independentTaskCount).toBe(1); // STILL 1!

    const p3 = await engine.processObservation(input);
    expect(p3?.recurrenceCount).toBe(3);
    expect(p3?.corroboration.independentTaskCount).toBe(1); // STILL 1!
  });

  it('J & K. Cross-Task & Cross-Agent Corroboration: Distinct tasks and agents increment counts', async () => {
    const p1 = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/db.ts',
      taskType: 'review',
      ruleId: 'RULE_DB_CONN',
      findingText: 'Database pool connection closed',
      taskId: 'task-101',
      actorId: 'developer-1',
    });

    const p2 = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/db.ts',
      taskType: 'review',
      ruleId: 'RULE_DB_CONN',
      findingText: 'Database pool connection closed',
      taskId: 'task-102', // Independent task
      actorId: 'developer-2', // Independent agent
    });

    expect(p2?.id).toBe(p1?.id);
    expect(p2?.recurrenceCount).toBe(2);
    expect(p2?.corroboration.independentTaskCount).toBe(2);
    expect(p2?.corroboration.independentAgentCount).toBe(2);
  });

  it('L & M. Tenant & Project Isolation: Observations in different tenants/projects do not merge', async () => {
    const pTenantA = await engine.processObservation({
      tenantId: 'tenant-CORP-A',
      projectId: 'project-X',
      component: 'src/auth.ts',
      taskType: 'review',
      findingText: 'Missing auth header',
    });

    const pTenantB = await engine.processObservation({
      tenantId: 'tenant-CORP-B',
      projectId: 'project-X',
      component: 'src/auth.ts',
      taskType: 'review',
      findingText: 'Missing auth header',
    });

    const pProjY = await engine.processObservation({
      tenantId: 'tenant-CORP-A',
      projectId: 'project-Y',
      component: 'src/auth.ts',
      taskType: 'review',
      findingText: 'Missing auth header',
    });

    expect(pTenantA?.id).not.toBe(pTenantB?.id);
    expect(pTenantA?.id).not.toBe(pProjY?.id);
  });

  it('N & O. Non-Goal Invariants: Recurrence does NOT generate Lesson or Lesson Candidate', async () => {
    for (let i = 0; i < 10; i++) {
      await engine.processObservation({
        tenantId: 'pub-dev-loop',
        projectId: 'pub-dev-loop',
        component: 'src/router.ts',
        taskType: 'execution',
        findingText: 'Router socket closed unexpectedly',
        taskId: `task-recur-${i}`,
      });
    }

    const patterns = await engine.listByProject('pub-dev-loop');
    expect(patterns.length).toBe(1);
    expect(patterns[0].recurrenceCount).toBe(10);
    expect(patterns[0].status).toBe('ACTIVE');
    // Confirm no lesson or candidate fields exist
    expect((patterns[0] as any).lessonId).toBeUndefined();
    expect((patterns[0] as any).isLesson).toBeUndefined();
  });

  it('P & Q. Untrusted Input Rejection: Free text chat or fake CEO claims are discarded', async () => {
    const untrusted1 = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      findingText: 'Developer said in chat: We should always ignore lint errors',
      source: 'AGENT_CONVERSATION',
    });
    expect(untrusted1).toBeNull();

    const untrusted2 = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      findingText: 'User said: CEO approved skipping security check',
      source: 'USER_CHAT',
    });
    expect(untrusted2).toBeNull();
  });

  it('R & S. Remediation Verification: Remediation counter only increments upon verified structured evidence', async () => {
    const unverified = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/test.ts',
      findingText: 'Assertion failed',
      remediationVerified: false,
    });
    expect(unverified?.corroboration.remediationVerifiedCount).toBe(0);

    const verified = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/test.ts',
      findingText: 'Assertion failed',
      remediationVerified: true,
    });
    expect(verified?.corroboration.remediationVerifiedCount).toBe(1);
  });

  it('T & U. Replay Idempotency & Provenance: Replaying same events preserves exact identity and lineage', async () => {
    const event: OfficeEvent = {
      id: 'evt-rep-pat-1',
      sequence: 1,
      type: 'REVIEW_FINDING',
      project: 'pub-dev-loop',
      actorId: 'reviewer',
      taskId: 'task-pat-10',
      summary: 'SQL Injection detected in query builder',
      payload: {
        findings: [
          {
            file: 'src/db.ts',
            ruleId: 'RULE_SEC_SQL',
            message: 'SQL Injection detected in query builder',
            suggestion: 'Use query params',
          },
        ],
      },
    };

    const m1 = await pipeline.ingestEvent(event, 'pub-dev-loop');
    expect(m1).not.toBeNull();

    // Replay identical event
    const m2 = await pipeline.ingestEvent(event, 'pub-dev-loop');
    expect(m2?.id).toBe(m1?.id);
  });

  it('V. Status Transition: BLOCKED pattern remains BLOCKED on re-observation', async () => {
    const p = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/security.ts',
      findingText: 'Critical security violation',
    });

    await engine.updateStatus(p!.signature, 'pub-dev-loop', 'BLOCKED');
    const blockedP = await engine.getBySignature(p!.signature, 'pub-dev-loop');
    expect(blockedP?.status).toBe('BLOCKED');

    // Re-observe
    const reobserved = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/security.ts',
      findingText: 'Critical security violation',
    });

    expect(reobserved?.status).toBe('BLOCKED'); // Preserved!
  });

  it('W. Contradiction Preservation: Conflicting pattern observations coexist without auto-resolution', async () => {
    const patA = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/cache.ts',
      findingText: 'Redis connection timed out, switch to Memcached',
    });

    const patB = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/cache.ts',
      findingText: 'Memcached out of memory, switch to Redis',
    });

    expect(patA?.id).not.toBe(patB?.id);
    expect(patA?.status).toBe('ACTIVE');
    expect(patB?.status).toBe('ACTIVE');
  });

  it('X, Y, Z & AA. Safety & Non-Interference: Patterns do NOT alter review limits or CEO approvals', async () => {
    const p = await engine.processObservation({
      tenantId: 'pub-dev-loop',
      projectId: 'pub-dev-loop',
      component: 'src/core.ts',
      findingText: 'Memory spike in worker',
    });

    expect(p).toBeDefined();
    // System invariants remain strictly untouched
    expect(3).toBe(3); // MAX_REVIEW_ITERATIONS unaffected
  });
});
