import { describe, it, expect } from 'vitest';
import { PlanValidator } from '../../src/pdl/planning/validator.js';
import type { StructuredExecutionPlan } from '../../src/pdl/planning/types.js';
import type { ProductManifest } from '../../src/pdl/products/catalog.js';

function createValidPlan(overrides: Partial<StructuredExecutionPlan> = {}): StructuredExecutionPlan {
  return {
    planVersion: '1.0.0',
    taskId: 'task-100',
    attempt: 0,
    goal: 'Refactor auth service cleanly and add tests with full verification',
    filesToChange: ['src/auth/service.ts', 'test/auth/service.test.ts'],
    dependencies: ['jsonwebtoken'],
    implementationSteps: [
      {
        stepNumber: 1,
        description: 'Update token verification logic in auth service',
        targetFile: 'src/auth/service.ts',
      },
      {
        stepNumber: 2,
        description: 'Add comprehensive test coverage for invalid tokens',
        targetFile: 'test/auth/service.test.ts',
      },
    ],
    testStrategy: ['npm test', 'Verify all unit tests pass with node test runner'],
    riskPoints: ['Token expiration edge case handling'],
    rollbackConsiderations: ['Git revert commit if tests fail'],
    complexityAssessment: 'COMPLEX: Multi-file refactor requiring sequencing',
    ...overrides,
  };
}

const mockProduct: ProductManifest = {
  productId: 'pub-dev-loop-template',
  repository: 'https://github.com/pubcoreagencia/pub-dev-loop-template.git',
  organization: 'pubcoreagencia',
  defaultBranch: 'main',
  developmentBranchPolicy: ['feat/*', 'fix/*'],
  testCommand: 'npm test',
  allowedPaths: ['src/**', 'test/**', 'docs/**'],
  protectedPaths: ['.github/**', '.env*', 'package.json'],
  maxAutonomyLevel: 5,
};

describe('PlanValidator — Unit Tests', () => {
  it('passes a fully conforming plan across all 4 stages', () => {
    const plan = createValidPlan();
    const result = PlanValidator.validate(plan, {
      taskId: 'task-100',
      attempt: 0,
      product: mockProduct,
      testCommand: mockProduct.testCommand,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validatedPlan).toBeDefined();
    expect(result.validatedPlan?.taskId).toBe('task-100');
  });

  describe('Stage 1: Structural Validation', () => {
    it('fails on non-object / array input (revision allowed)', () => {
      const result = PlanValidator.validate('not a json object', {
        taskId: 'task-100',
        attempt: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.revisionAllowed).toBe(true);
      expect(result.errors[0].stageName).toBe('STRUCTURAL');
    });

    it('fails when goal is too short (< 20 chars)', () => {
      const plan = createValidPlan({ goal: 'Short' });
      const result = PlanValidator.validate(plan, {
        taskId: 'task-100',
        attempt: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.revisionAllowed).toBe(true);
      expect(result.errors.some(e => e.message.includes('shorter than 20 characters'))).toBe(true);
    });

    it('fails when implementationSteps or filesToChange is empty', () => {
      const plan = createValidPlan({ filesToChange: [], implementationSteps: [] });
      const result = PlanValidator.validate(plan, {
        taskId: 'task-100',
        attempt: 0,
      });

      expect(result.valid).toBe(false);
      expect(result.revisionAllowed).toBe(true);
      expect(result.errors.some(e => e.stageName === 'STRUCTURAL')).toBe(true);
    });
  });

  describe('Stage 2: Scope & Path Containment (FATAL)', () => {
    it('fails FATAL when path traversal (..) is detected in filesToChange', () => {
      const plan = createValidPlan({
        filesToChange: ['src/service.ts', '../outside.ts'],
      });
      const result = PlanValidator.validate(plan, {
        taskId: 'task-100',
        attempt: 0,
        product: mockProduct,
      });

      expect(result.valid).toBe(false);
      expect(result.revisionAllowed).toBe(false);
      const err = result.errors.find(e => e.stageName === 'SCOPE_CONTAINMENT');
      expect(err).toBeDefined();
      expect(err?.fatal).toBe(true);
    });

    it('fails FATAL when absolute path is used in implementationSteps', () => {
      const plan = createValidPlan({
        implementationSteps: [
          { stepNumber: 1, description: 'Touch root file', targetFile: '/etc/passwd' },
        ],
      });
      const result = PlanValidator.validate(plan, {
        taskId: 'task-100',
        attempt: 0,
        product: mockProduct,
      });

      expect(result.valid).toBe(false);
      expect(result.revisionAllowed).toBe(false);
      expect(result.errors.some(e => e.fatal && e.stageName === 'SCOPE_CONTAINMENT')).toBe(true);
    });
  });

  describe('Stage 3: Governance Policy Validation (FATAL)', () => {
    it('fails FATAL when target file touches protectedPaths (.github/** or .env)', () => {
      const plan = createValidPlan({
        filesToChange: ['src/service.ts', '.github/workflows/ci.yml'],
      });
      const result = PlanValidator.validate(plan, {
        taskId: 'task-100',
        attempt: 0,
        product: mockProduct,
      });

      expect(result.valid).toBe(false);
      expect(result.revisionAllowed).toBe(false);
      const govErr = result.errors.find(e => e.stageName === 'GOVERNANCE');
      expect(govErr).toBeDefined();
      expect(govErr?.fatal).toBe(true);
    });

    it('fails FATAL when target file is not within allowedPaths', () => {
      const plan = createValidPlan({
        filesToChange: ['src/service.ts', 'unauthorized_folder/script.sh'],
      });
      const result = PlanValidator.validate(plan, {
        taskId: 'task-100',
        attempt: 0,
        product: mockProduct,
      });

      expect(result.valid).toBe(false);
      expect(result.revisionAllowed).toBe(false);
      expect(result.errors.some(e => e.stageName === 'GOVERNANCE' && e.fatal)).toBe(true);
    });
  });

  describe('Stage 4: Executable Test Strategy', () => {
    it('fails (revision allowed) when testStrategy lacks actionable execution steps', () => {
      const plan = createValidPlan({
        testStrategy: ['I will manually check it later'],
      });
      const result = PlanValidator.validate(plan, {
        taskId: 'task-100',
        attempt: 0,
        product: mockProduct,
        testCommand: 'npm test',
      });

      expect(result.valid).toBe(false);
      expect(result.revisionAllowed).toBe(true);
      const testErr = result.errors.find(e => e.stageName === 'TEST_STRATEGY');
      expect(testErr).toBeDefined();
      expect(testErr?.fatal).toBe(false);
    });
  });
});
