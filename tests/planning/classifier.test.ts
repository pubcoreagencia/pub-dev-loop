import { describe, it, expect } from 'vitest';
import { TaskComplexityClassifier } from '../../src/pdl/planning/classifier.js';
import type { Task } from '../../src/domain.js';
import type { ExecutionSpec } from '../../src/task/execution-spec.js';

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task-1',
    project: 'pub-dev-loop-template',
    repository: 'https://github.com/pubcoreagencia/pub-dev-loop-template.git',
    objective: 'Implement simple feature',
    prompt: 'Short prompt',
    status: 'QUEUED',
    priority: 1,
    worker: null,
    result: null,
    error: null,
    branch: 'main',
    commitSha: null,
    gitStatus: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    leaseOwner: null,
    leaseDeadline: null,
    heartbeatAt: null,
    workspacePath: null,
    ...overrides,
  };
}

function createMockSpec(overrides: Partial<ExecutionSpec> = {}): ExecutionSpec {
  return {
    specVersion: '1.0.0',
    objective: 'Implement simple feature',
    context: { kind: 'UNKNOWN', reason: 'mock' },
    constraints: [],
    acceptanceCriteria: ['Feature works as expected'],
    validationPlan: ['npm test'],
    executionInstructions: ['Edit file and test'],
    executionSteps: [],
    risks: [],
    escalationConditions: [],
    lineage: {
      intakeVersion: '1.0.0',
      intakeHash: 'mock-hash',
      source: 'test',
      createdAt: new Date().toISOString(),
    },
    metadata: {
      generatedAt: new Date().toISOString(),
      specHash: 'mock-spec-hash',
    },
    repositoryTarget: {
      remote: 'https://github.com/pubcoreagencia/pub-dev-loop-template.git',
      branch: 'main',
    },
    ...overrides,
  };
}

describe('TaskComplexityClassifier — Unit Tests', () => {
  const classifier = new TaskComplexityClassifier();

  describe('Simple Tasks (Baseline)', () => {
    it('classifies a 1-file, short, simple task as SIMPLE with planningRequired=false', () => {
      const task = createMockTask();
      const spec = createMockSpec({
        executionInstructions: ['Update README.md with usage notes'],
      });

      const decision = classifier.evaluate(task, spec);
      expect(decision.tier).toBe('SIMPLE');
      expect(decision.planningRequired).toBe(false);
      expect(decision.hardSignalsTriggered).toHaveLength(0);
      expect(decision.softSignalScore).toBeLessThan(3);
    });
  });

  describe('Hard Signals (Unconditional Planning)', () => {
    it('HARD_01_LIFECYCLE_CORE: triggers on core engine path', () => {
      const task = createMockTask();
      const spec = createMockSpec({
        executionInstructions: ['Modify src/pdl/scheduler/types.ts to update transitions'],
      });

      const decision = classifier.evaluate(task, spec);
      expect(decision.tier).toBe('COMPLEX');
      expect(decision.planningRequired).toBe(true);
      expect(decision.hardSignalsTriggered).toContain('HARD_01_LIFECYCLE_CORE');
    });

    it('HARD_02_PERSISTENCE_SCHEMA: triggers on db migrations or sql schema', () => {
      const task = createMockTask();
      const spec = createMockSpec({
        executionInstructions: ['Add migration db/migrations/024_add_plans.sql'],
      });

      const decision = classifier.evaluate(task, spec);
      expect(decision.tier).toBe('COMPLEX');
      expect(decision.planningRequired).toBe(true);
      expect(decision.hardSignalsTriggered).toContain('HARD_02_PERSISTENCE_SCHEMA');
    });

    it('HARD_03_BREAKING_CONTRACT: triggers on public contract / types files', () => {
      const task = createMockTask();
      const spec = createMockSpec({
        executionInstructions: ['Change interface in src/types.ts to export new fields'],
      });

      const decision = classifier.evaluate(task, spec);
      expect(decision.tier).toBe('COMPLEX');
      expect(decision.planningRequired).toBe(true);
      expect(decision.hardSignalsTriggered).toContain('HARD_03_BREAKING_CONTRACT');
    });

    it('HARD_04_CIRCULAR_DEP_REFACTOR: triggers on refactor / circular dependency keywords', () => {
      const task = createMockTask();
      const spec = createMockSpec({
        objective: 'Resolve circular dependency by extracting common utilities module and refactor imports',
      });

      const decision = classifier.evaluate(task, spec);
      expect(decision.tier).toBe('COMPLEX');
      expect(decision.planningRequired).toBe(true);
      expect(decision.hardSignalsTriggered).toContain('HARD_04_CIRCULAR_DEP_REFACTOR');
    });

    it('HARD_05_SECURITY_AUTH: triggers on security / governance path', () => {
      const task = createMockTask();
      const spec = createMockSpec({
        executionInstructions: ['Update src/pdl/security/repo-authorization.ts rules'],
      });

      const decision = classifier.evaluate(task, spec);
      expect(decision.tier).toBe('COMPLEX');
      expect(decision.planningRequired).toBe(true);
      expect(decision.hardSignalsTriggered).toContain('HARD_05_SECURITY_AUTH');
    });
  });

  describe('Soft Signals & Threshold (Score >= 3)', () => {
    it('SOFT_01_MULTI_FILE alone (weight 2) scores 2 and remains SIMPLE', () => {
      const task = createMockTask();
      const spec = createMockSpec({
        executionInstructions: [
          'Modify fileA.ts to add export',
          'Modify fileB.ts to consume export',
        ],
      });

      const decision = classifier.evaluate(task, spec);
      expect(decision.softSignalsTriggered.some(s => s.signal === 'SOFT_01_MULTI_FILE')).toBe(true);
      expect(decision.softSignalScore).toBe(2);
      expect(decision.tier).toBe('SIMPLE');
      expect(decision.planningRequired).toBe(false);
    });

    it('SOFT_01 (2 pts) + SOFT_02 (>1200 chars, 1 pt) reaches threshold 3 and triggers COMPLEX', () => {
      const task = createMockTask();
      const longPrompt = 'A'.repeat(1250);
      const spec = createMockSpec({
        objective: 'Two file edit with extensive requirements description',
        executionInstructions: [
          'Update fileA.ts',
          'Update fileB.ts',
          longPrompt,
        ],
      });

      const decision = classifier.evaluate(task, spec);
      expect(decision.softSignalsTriggered.some(s => s.signal === 'SOFT_01_MULTI_FILE')).toBe(true);
      expect(decision.softSignalsTriggered.some(s => s.signal === 'SOFT_02_PROMPT_LENGTH')).toBe(true);
      expect(decision.softSignalScore).toBeGreaterThanOrEqual(3);
      expect(decision.tier).toBe('COMPLEX');
      expect(decision.planningRequired).toBe(true);
    });

    it('SOFT_03 (>=4 acceptance criteria, 2 pts) + SOFT_05 (error handling keyword, 1 pt) reaches 3', () => {
      const task = createMockTask();
      const spec = createMockSpec({
        acceptanceCriteria: [
          'Criteria 1: Validate payload',
          'Criteria 2: Fail-closed on error',
          'Criteria 3: Return proper status',
          'Criteria 4: Write audit log',
        ],
      });

      const decision = classifier.evaluate(task, spec);
      expect(decision.softSignalsTriggered.some(s => s.signal === 'SOFT_03_MULTIPLE_ACCEPTANCE')).toBe(true);
      expect(decision.softSignalsTriggered.some(s => s.signal === 'SOFT_05_ERROR_HANDLING_DEPTH')).toBe(true);
      expect(decision.softSignalScore).toBeGreaterThanOrEqual(3);
      expect(decision.tier).toBe('COMPLEX');
      expect(decision.planningRequired).toBe(true);
    });

    it('SOFT_04 (concurrency keyword, 2 pts) + SOFT_06 (retryCount > 0, 2 pts) triggers COMPLEX', () => {
      const task = createMockTask({ retryCount: 1 } as any);
      const spec = createMockSpec({
        objective: 'Fix race condition and acquire mutex lock properly',
      });

      const decision = classifier.evaluate(task, spec);
      expect(decision.softSignalsTriggered.some(s => s.signal === 'SOFT_04_ASYNC_CONCURRENCY')).toBe(true);
      expect(decision.softSignalsTriggered.some(s => s.signal === 'SOFT_06_PREVIOUS_FAILURE')).toBe(true);
      expect(decision.softSignalScore).toBeGreaterThanOrEqual(4);
      expect(decision.tier).toBe('COMPLEX');
      expect(decision.planningRequired).toBe(true);
    });
  });

  describe('Fail-Closed Safety', () => {
    it('catches internal evaluation exceptions and defaults to COMPLEX with planningRequired=true', () => {
      const badSpec: any = null; // Forces error if not handled
      const decision = classifier.evaluate(createMockTask(), badSpec);
      expect(decision.tier).toBe('COMPLEX');
      expect(decision.planningRequired).toBe(true);
      expect(decision.decisionRationale).toContain('Safety fail-closed triggered');
    });
  });
});
