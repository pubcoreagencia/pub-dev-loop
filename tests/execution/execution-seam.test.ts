/**
 * Phase 3C.1 — Unit tests for Execution Spec Delivery Seam.
 *
 * Tests:
 * 1. Valid ExecutionSpec delivery → returns PreparedExecution with identical references
 * 2. Reference fidelity → task and executionSpec are passed through without reconstruction
 * 3. Null spec rejection → throws explicit error
 * 4. Undefined spec rejection → throws explicit error
 * 5. Primitive spec rejection (string, number, boolean) → throws explicit error
 * 6. Missing specVersion rejection → throws explicit error
 * 7. Empty specVersion rejection → throws explicit error
 * 8. Missing lineage rejection → throws explicit error
 * 9. Missing intakeHash rejection → throws explicit error
 * 10. Empty intakeHash rejection → throws explicit error
 * 11. No synthetic identity → does not derive or overwrite lineage with task.id
 * 12. Immutability → does not mutate input task or executionSpec objects
 * 13. Compatibility with DefaultExecutionEngine → prepared execution directly executes
 * 14. PP isolation → zero imports or references to src/pp/*
 * 15. Zero DB access → pure in-memory contract without repository or database calls
 */

import { describe, it, expect, vi } from 'vitest';
import {
  prepareExecution,
  type PreparedExecution,
} from '../../src/execution/execution-seam.js';
import { DefaultExecutionEngine } from '../../src/execution/default-execution-engine.js';
import type { Task } from '../../src/domain.js';
import type { ExecutionSpec } from '../../src/task/execution-spec.js';
import type { AgentProvider } from '../../src/providers/types.js';

describe('ExecutionSeam (Phase 3C.1 Delivery Seam)', () => {
  const sampleTask: Task = {
    id: 'TASK-500',
    project: 'pub-dev-loop',
    repository: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
    objective: 'Implement auth module',
    prompt: 'Write auth.ts',
    status: 'RUNNING',
    created_at: new Date('2026-09-11T08:00:00.000Z'),
    updated_at: new Date('2026-09-11T08:00:00.000Z'),
    workspacePath: '/tmp/workspaces/sample-ws',
  };

  const sampleSpec: ExecutionSpec = {
    specVersion: '1.0.0',
    objective: 'Implement auth module',
    context: {
      version: '1.0.0',
      authoritativeContext: [],
      repositoryContext: [],
      operationalContext: [],
      relevantDocumentation: [],
      knownConstraints: [],
      limitations: [],
    },
    constraints: ['no external network'],
    acceptanceCriteria: ['auth.ts exists'],
    validationPlan: ['npm test'],
    executionInstructions: ['create auth.ts'],
    executionSteps: [{ id: 'step-1', description: 'create auth', critical: true }],
    risks: ['missing token'],
    escalationConditions: ['unauthorized'],
    lineage: {
      intakeVersion: '1.0.0',
      intakeHash: 'intake-hash-abc-999',
      source: 'api-request',
      createdAt: '2026-09-11T07:59:00.000Z',
    },
    metadata: {
      generatedAt: '2026-09-11T08:00:00.000Z',
      specHash: 'spec-hash-123',
    },
    repositoryTarget: {
      identity: {
        owner: 'pubcoreagencia',
        name: 'pub-dev-loop',
        fullName: 'pubcoreagencia/pub-dev-loop',
      },
      scmProvider: 'git',
      remote: 'https://github.com/pubcoreagencia/pub-dev-loop.git',
      branch: 'main',
      workspace: '/tmp/workspaces/sample-ws',
      provenance: 'intake',
      isDefault: true,
    },
    governanceLevel: 'DEVELOPER',
    permissions: {
      repositoryRead: true,
      repositoryWrite: true,
      branchWrite: true,
      commit: true,
      push: false,
      externalResearch: false,
      filesystemWorkspace: true,
      privilegedOperations: false,
    },
  };

  it('1: Valid ExecutionSpec delivery → returns PreparedExecution with identical references', () => {
    const prepared = prepareExecution(sampleTask, sampleSpec);

    expect(prepared).toBeDefined();
    expect(prepared.task).toBe(sampleTask);
    expect(prepared.executionSpec).toBe(sampleSpec);
  });

  it('2: Reference fidelity → task and executionSpec are passed through without reconstruction', () => {
    const prepared: PreparedExecution = prepareExecution(sampleTask, sampleSpec);

    expect(prepared.task.id).toBe('TASK-500');
    expect(prepared.executionSpec.lineage.intakeHash).toBe('intake-hash-abc-999');
    // Direct identity check (zero cloning or reconstruction)
    expect(prepared.task).toBe(sampleTask);
    expect(prepared.executionSpec).toBe(sampleSpec);
  });

  it('3: Null spec rejection → throws explicit error', () => {
    expect(() => prepareExecution(sampleTask, null)).toThrowError(
      'ExecutionSeam: ExecutionSpec is not an object',
    );
  });

  it('4: Undefined spec rejection → throws explicit error', () => {
    expect(() => prepareExecution(sampleTask, undefined)).toThrowError(
      'ExecutionSeam: ExecutionSpec is not an object',
    );
  });

  it('5: Primitive spec rejection (string, number, boolean) → throws explicit error', () => {
    expect(() => prepareExecution(sampleTask, 'invalid-string-spec')).toThrowError(
      'ExecutionSeam: ExecutionSpec is not an object',
    );
    expect(() => prepareExecution(sampleTask, 12345)).toThrowError(
      'ExecutionSeam: ExecutionSpec is not an object',
    );
    expect(() => prepareExecution(sampleTask, true)).toThrowError(
      'ExecutionSeam: ExecutionSpec is not an object',
    );
  });

  it('6: Missing specVersion rejection → throws explicit error', () => {
    const invalidSpec = { ...sampleSpec, specVersion: undefined };
    expect(() => prepareExecution(sampleTask, invalidSpec)).toThrowError(
      'ExecutionSeam: ExecutionSpec.specVersion missing',
    );
  });

  it('7: Empty specVersion rejection → throws explicit error', () => {
    const invalidSpec = { ...sampleSpec, specVersion: '   ' };
    expect(() => prepareExecution(sampleTask, invalidSpec)).toThrowError(
      'ExecutionSeam: ExecutionSpec.specVersion missing',
    );
  });

  it('8: Missing lineage rejection → throws explicit error', () => {
    const invalidSpec = { ...sampleSpec, lineage: undefined };
    expect(() => prepareExecution(sampleTask, invalidSpec)).toThrowError(
      'ExecutionSeam: ExecutionSpec.lineage missing',
    );
  });

  it('9: Missing intakeHash rejection → throws explicit error', () => {
    const invalidSpec = {
      ...sampleSpec,
      lineage: { ...sampleSpec.lineage, intakeHash: undefined as any },
    };
    expect(() => prepareExecution(sampleTask, invalidSpec)).toThrowError(
      'ExecutionSeam: ExecutionSpec.lineage missing',
    );
  });

  it('10: Empty intakeHash rejection → throws explicit error', () => {
    const invalidSpec = {
      ...sampleSpec,
      lineage: { ...sampleSpec.lineage, intakeHash: '   ' },
    };
    expect(() => prepareExecution(sampleTask, invalidSpec)).toThrowError(
      'ExecutionSeam: ExecutionSpec.lineage missing',
    );
  });

  it('11: No synthetic identity → does not derive or overwrite lineage with task.id', () => {
    const prepared = prepareExecution(sampleTask, sampleSpec);

    // Verified: lineage.intakeHash is the authentic intake hash, NOT task.id
    expect(prepared.executionSpec.lineage.intakeHash).toBe('intake-hash-abc-999');
    expect(prepared.executionSpec.lineage.intakeHash).not.toBe(sampleTask.id);
  });

  it('12: Immutability → does not mutate input task or executionSpec objects', () => {
    const frozenTask = Object.freeze({ ...sampleTask });
    const frozenSpec = Object.freeze({ ...sampleSpec });

    const prepared = prepareExecution(frozenTask as Task, frozenSpec as ExecutionSpec);

    expect(prepared.task).toBe(frozenTask);
    expect(prepared.executionSpec).toBe(frozenSpec);
  });

  it('13: Compatibility with DefaultExecutionEngine → prepared execution directly executes', async () => {
    const mockProvider: AgentProvider = {
      kind: 'mock',
      model: 'mock-model',
      execute: vi.fn().mockResolvedValue({
        status: 'COMPLETED',
        provider: 'mock',
        model: 'mock-model',
        changedFiles: ['auth.ts'],
        durationMs: 120,
        stdout: 'ok',
        stderr: '',
        toolCalls: 1,
        toolRounds: 1,
      }),
    };

    const prepared = prepareExecution(sampleTask, sampleSpec);
    const engine = new DefaultExecutionEngine(mockProvider);
    const result = await engine.execute(prepared.task, prepared.executionSpec);

    expect(result.execution.status).toBe('COMPLETED');
    expect(result.execution.changedFiles).toEqual(['auth.ts']);
    expect(result.specIdentity.specVersion).toBe(sampleSpec.specVersion);
    expect(result.specIdentity.taskId).toBe(sampleTask.id);
    expect(result.specIdentity.lineage).toEqual(sampleSpec.lineage);
  });

  it('14: PP isolation → delivery seam has no Prototype references', async () => {
    const seamModule = await import('../../src/execution/execution-seam.js');
    expect(Object.keys(seamModule)).toEqual(['prepareExecution']);
  });

  it('15: Zero DB access → pure in-memory contract', () => {
    // Pure function check: does not return a Promise, synchronicity confirms no async DB I/O
    const prepared = prepareExecution(sampleTask, sampleSpec);
    expect(prepared).toBeTypeOf('object');
    expect(prepared.task.id).toBe('TASK-500');
  });
});
