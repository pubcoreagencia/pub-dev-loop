/**
 * Phase 7: Deterministic Plan Validator (Candidate A).
 *
 * Implements 4-Stage deterministic plan validation:
 * 1. Stage 1: Structural Validation (Strict JSON, required keys, non-empty arrays, min goal length >= 20)
 * 2. Stage 2: Scope & Path Containment (Prevent path traversal .., enforce relative path, check boundaries)
 * 3. Stage 3: Governance Policy Validation (ProductManifest.allowedPaths / protectedPaths, Autonomy)
 * 4. Stage 4: Executable Test Strategy (Ensure testStrategy contains actionable test steps or command matching product testCommand)
 *
 * Revision Budget:
 * - 1 revision allowed if Stage 1 or Stage 4 fails.
 * - Stage 2 or Stage 3 failure is FATAL (fail-closed immediately; no revision permitted).
 */

import { posix } from 'node:path';
import type { ProductManifest } from '../products/catalog.js';
import { defaultRepositoryAuthorizationPolicy } from '../security/repo-authorization.js';
import type {
  StructuredExecutionPlan,
  PlanValidationResult,
  PlanValidationError,
} from './types.js';

export interface PlanValidationContext {
  taskId: string;
  attempt: number;
  product?: ProductManifest;
  authorizedScope?: string[];
  testCommand?: string | null;
}

export class PlanValidator {
  /**
   * Validates a StructuredExecutionPlan across all 4 stages.
   */
  public static validate(
    rawPlan: unknown,
    context: PlanValidationContext
  ): PlanValidationResult {
    const errors: PlanValidationError[] = [];

    // ─── STAGE 1: STRUCTURAL VALIDATION ─────────────────────────────────
    if (!rawPlan || typeof rawPlan !== 'object' || Array.isArray(rawPlan)) {
      return {
        valid: false,
        errors: [{
          stage: 1,
          stageName: 'STRUCTURAL',
          message: 'Plan is not a valid JSON object',
          fatal: false,
        }],
        revisionAllowed: true,
      };
    }

    const p = rawPlan as Record<string, unknown>;

    // Required fields: planVersion, taskId, goal, filesToChange, dependencies, implementationSteps, testStrategy, riskPoints, rollbackConsiderations
    if (p.planVersion !== '1.0.0') {
      errors.push({
        stage: 1,
        stageName: 'STRUCTURAL',
        message: `planVersion must be '1.0.0' (received '${p.planVersion}')`,
        fatal: false,
      });
    }

    if (typeof p.taskId !== 'string' || p.taskId.trim() === '') {
      errors.push({
        stage: 1,
        stageName: 'STRUCTURAL',
        message: 'taskId is required and must be a non-empty string',
        fatal: false,
      });
    }

    if (typeof p.goal !== 'string' || p.goal.trim().length < 20) {
      errors.push({
        stage: 1,
        stageName: 'STRUCTURAL',
        message: 'Goal is missing or shorter than 20 characters',
        fatal: false,
      });
    }

    if (!Array.isArray(p.filesToChange) || p.filesToChange.length === 0) {
      errors.push({
        stage: 1,
        stageName: 'STRUCTURAL',
        message: 'filesToChange must be a non-empty array of file paths',
        fatal: false,
      });
    }

    if (!Array.isArray(p.dependencies)) {
      errors.push({
        stage: 1,
        stageName: 'STRUCTURAL',
        message: 'dependencies must be an array',
        fatal: false,
      });
    }

    if (!Array.isArray(p.implementationSteps) || p.implementationSteps.length === 0) {
      errors.push({
        stage: 1,
        stageName: 'STRUCTURAL',
        message: 'implementationSteps must be a non-empty array',
        fatal: false,
      });
    } else {
      // Validate implementationSteps shape
      for (const [idx, step] of (p.implementationSteps as any[]).entries()) {
        if (!step || typeof step !== 'object') {
          errors.push({
            stage: 1,
            stageName: 'STRUCTURAL',
            message: `implementationSteps[${idx}] must be an object with stepNumber, description, targetFile`,
            fatal: false,
          });
        } else if (typeof step.description !== 'string' || step.description.trim().length < 5) {
          errors.push({
            stage: 1,
            stageName: 'STRUCTURAL',
            message: `implementationSteps[${idx}].description is missing or too short`,
            fatal: false,
          });
        }
      }
    }

    if (!Array.isArray(p.testStrategy) || p.testStrategy.length === 0) {
      errors.push({
        stage: 1,
        stageName: 'STRUCTURAL',
        message: 'testStrategy must be a non-empty array of verification steps',
        fatal: false,
      });
    }

    if (!Array.isArray(p.riskPoints) || p.riskPoints.length === 0) {
      errors.push({
        stage: 1,
        stageName: 'STRUCTURAL',
        message: 'riskPoints must be a non-empty array of failure/risk points',
        fatal: false,
      });
    }

    if (!Array.isArray(p.rollbackConsiderations) || p.rollbackConsiderations.length === 0) {
      errors.push({
        stage: 1,
        stageName: 'STRUCTURAL',
        message: 'rollbackConsiderations must be a non-empty array',
        fatal: false,
      });
    }

    // If Stage 1 has structural errors, check if we can inspect paths or if we should stop
    const filesToChange = Array.isArray(p.filesToChange) ? (p.filesToChange as string[]) : [];

    // ─── STAGE 2: SCOPE & PATH CONTAINMENT ──────────────────────────────
    // Path traversal / relative check
    for (const file of filesToChange) {
      if (typeof file !== 'string' || file.trim() === '') {
        errors.push({
          stage: 2,
          stageName: 'SCOPE_CONTAINMENT',
          message: 'Invalid empty file path in filesToChange',
          fatal: true,
        });
        continue;
      }

      const normalized = posix.normalize(file.trim().replace(/\\/g, '/'));
      if (normalized.startsWith('../') || normalized === '..' || posix.isAbsolute(normalized)) {
        errors.push({
          stage: 2,
          stageName: 'SCOPE_CONTAINMENT',
          message: `Path traversal or absolute path detected: '${file}'. Paths must be repository-relative.`,
          fatal: true,
        });
      }

      // If authorizedScope is explicitly provided, file must be contained within it
      if (context.authorizedScope && context.authorizedScope.length > 0) {
        const inScope = context.authorizedScope.some(scopePattern => {
          const normPattern = posix.normalize(scopePattern.trim().replace(/\\/g, '/'));
          if (normPattern === normalized) return true;
          if (normPattern.endsWith('/**')) {
            const prefix = normPattern.slice(0, -3);
            return normalized === prefix || normalized.startsWith(prefix + '/');
          }
          if (normPattern.endsWith('/*')) {
            const prefix = normPattern.slice(0, -2);
            return normalized.startsWith(prefix + '/') && !normalized.slice(prefix.length + 1).includes('/');
          }
          return normalized.startsWith(normPattern.replace(/\/?$/, '/'));
        });
        if (!inScope) {
          errors.push({
            stage: 2,
            stageName: 'SCOPE_CONTAINMENT',
            message: `Scope violation: File '${file}' is not within authorized execution scope [${context.authorizedScope.join(', ')}]`,
            fatal: true,
          });
        }
      }
    }

    // Also check step targetFiles
    if (Array.isArray(p.implementationSteps)) {
      for (const step of p.implementationSteps as any[]) {
        if (typeof step?.targetFile === 'string' && step.targetFile.trim()) {
          const normStepFile = posix.normalize(step.targetFile.trim().replace(/\\/g, '/'));
          if (normStepFile.startsWith('../') || normStepFile === '..' || posix.isAbsolute(normStepFile)) {
            errors.push({
              stage: 2,
              stageName: 'SCOPE_CONTAINMENT',
              message: `Path traversal or absolute path detected in step targetFile: '${step.targetFile}'`,
              fatal: true,
            });
          }
        }
      }
    }

    // ─── STAGE 3: GOVERNANCE POLICY VALIDATION ──────────────────────────
    if (filesToChange.length > 0) {
      const allowedPaths = context.product?.allowedPaths;
      const protectedPaths = context.product?.protectedPaths;

      // Re-use RepositoryAuthorizationPolicy.validateModifiedPaths
      const pathAuth = defaultRepositoryAuthorizationPolicy.validateModifiedPaths(
        filesToChange,
        { allowedPaths, protectedPaths }
      );

      if (!pathAuth.authorized) {
        errors.push({
          stage: 3,
          stageName: 'GOVERNANCE',
          message: pathAuth.reason || 'Modification of protected or forbidden paths in plan',
          fatal: true,
        });
      }

      // If product specifies allowedPaths, check that files match at least one allowed path
      if (allowedPaths && allowedPaths.length > 0) {
        for (const file of filesToChange) {
          const clean = file.replace(/^[\\/]+/, '').replace(/\\/g, '/');
          const isAllowed = allowedPaths.some(pattern => {
            const p = pattern.trim().replace(/\\/g, '/');
            if (p === clean) return true;
            if (p.endsWith('/**')) {
              const prefix = p.slice(0, -3);
              return clean === prefix || clean.startsWith(prefix + '/');
            }
            if (p.endsWith('*')) {
              const prefix = p.slice(0, -1);
              return clean.startsWith(prefix);
            }
            return false;
          });

          if (!isAllowed) {
            errors.push({
              stage: 3,
              stageName: 'GOVERNANCE',
              message: `File '${file}' is outside allowed paths for product: [${allowedPaths.join(', ')}]`,
              fatal: true,
            });
          }
        }
      }
    }

    // ─── STAGE 4: EXECUTABLE TEST STRATEGY ──────────────────────────────
    if (Array.isArray(p.testStrategy) && p.testStrategy.length > 0) {
      const testStrategyText = (p.testStrategy as string[]).join('\n').toLowerCase();
      // Must contain actionable verification words (e.g. test, verify, assert, vitest, npm test, etc.)
      const hasActionableVerbiage = testStrategyText.includes('test') ||
        testStrategyText.includes('verify') ||
        testStrategyText.includes('assert') ||
        testStrategyText.includes('check') ||
        testStrategyText.includes('validate');

      if (!hasActionableVerbiage) {
        errors.push({
          stage: 4,
          stageName: 'TEST_STRATEGY',
          message: 'testStrategy does not specify actionable verification or testing steps',
          fatal: false,
        });
      }

      // If product has a specific testCommand, check if test strategy or step references command or equivalent test runner
      if (context.testCommand) {
        const cmdTerms = context.testCommand.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        const matchesAnyCommandTerm = cmdTerms.some(term => testStrategyText.includes(term));
        if (!matchesAnyCommandTerm && !testStrategyText.includes('test') && !testStrategyText.includes('run')) {
          errors.push({
            stage: 4,
            stageName: 'TEST_STRATEGY',
            message: `testStrategy does not reference project test execution (expected command: '${context.testCommand}')`,
            fatal: false,
          });
        }
      }
    }

    const hasFatalError = errors.some(e => e.fatal);
    const valid = errors.length === 0;

    return {
      valid,
      errors,
      revisionAllowed: !hasFatalError,
      validatedPlan: valid ? (rawPlan as StructuredExecutionPlan) : undefined,
    };
  }
}
