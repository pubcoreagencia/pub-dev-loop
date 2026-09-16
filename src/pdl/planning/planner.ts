/**
 * Phase 7: Pre-Execution Structured Planner (Candidate A).
 *
 * Generates StructuredExecutionPlan when planningRequired === true.
 *
 * Security & Engine Invariants:
 * - Read-only: never edits files, never runs scripts, never commits code.
 * - Single responsibility: produces only a validated StructuredExecutionPlan.
 * - Revision budget: at most 1 automated revision attempt if Stage 1 or Stage 4 fails.
 * - Fail closed: if generation fails or validation fails after revision, fails closed.
 */

import type { AgentProvider, ProviderTaskInput } from '../../providers/types.js';
import type { Task } from '../../domain.js';
import type { ExecutionSpec } from '../../task/execution-spec.js';
import { isExplicitUnknown } from '../../task/execution-spec.js';
import type { ProductManifest } from '../products/catalog.js';
import type { StructuredExecutionPlan, PlanValidationResult } from './types.js';
import { PlanValidator, type PlanValidationContext } from './validator.js';

export interface PlanGenerationOptions {
  provider: AgentProvider;
  task: Task;
  spec: ExecutionSpec;
  attempt: number;
  product?: ProductManifest;
  authorizedScope?: string[];
  signal?: AbortSignal;
  onPlanningStarted?: () => void;
  onPlanGenerated?: (tokensUsed?: number, durationMs?: number) => void;
  onPlanValidated?: (plan: StructuredExecutionPlan) => void;
  onPlanRejected?: (reasons: string[], fatal: boolean) => void;
}

export interface PlanGenerationResult {
  status: 'SUCCESS' | 'FAILED';
  plan?: StructuredExecutionPlan;
  validation?: PlanValidationResult;
  revisionsAttempted: number;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
}

export class TaskPlanner {
  /**
   * Generates and validates a StructuredExecutionPlan with at most 1 revision.
   */
  public static async generatePlan(options: PlanGenerationOptions): Promise<PlanGenerationResult> {
    const startTime = Date.now();
    let revisionsAttempted = 0;

    if (options.onPlanningStarted) {
      options.onPlanningStarted();
    }

    const validationContext: PlanValidationContext = {
      taskId: options.task.id,
      attempt: options.attempt,
      product: options.product,
      authorizedScope: options.authorizedScope,
      testCommand: options.product?.testCommand,
    };

    try {
      // 1. First generation attempt
      const planPrompt = this.buildInitialPlanPrompt(options.task, options.spec, options.attempt);
      const planInput: ProviderTaskInput = {
        id: `${options.task.id}:plan:${options.attempt}`,
        objective: `Generate structured execution plan for: ${options.spec.objective || options.task.objective}`,
        prompt: planPrompt,
        project: options.task.project,
        repository: options.task.repository,
        branch: options.task.branch,
        systemInstructions: [
          'You are the PDL Pre-Execution Architectural Planner.',
          'Your output must be STRICTLY valid JSON conforming to StructuredExecutionPlan.',
          'Do NOT wrap output in markdown code blocks like ```json ... ```, or if you do, ensure it contains only the pure JSON.',
          'Never attempt to execute tools or edit files during planning.',
        ],
      };

      // In planning phase, workspace is empty or repo root for context only (read-only)
      const initialGenStart = Date.now();
      const firstResult = await options.provider.execute(planInput, options.task.workspacePath || process.cwd());
      const genDuration = Date.now() - initialGenStart;

      if (options.onPlanGenerated) {
        options.onPlanGenerated(firstResult.totalTokens, genDuration);
      }

      if (firstResult.status !== 'COMPLETED') {
        const errorMsg = firstResult.errorMessage || firstResult.stderr || 'Planner provider failed';
        if (options.onPlanRejected) {
          options.onPlanRejected([errorMsg], true);
        }
        return {
          status: 'FAILED',
          revisionsAttempted: 0,
          errorCode: firstResult.errorCode || 'PLANNER_PROVIDER_FAILED',
          errorMessage: errorMsg,
          durationMs: Date.now() - startTime,
        };
      }

      const parsedPlan1 = this.parsePlanJson(firstResult.stdout);
      const validation1 = PlanValidator.validate(parsedPlan1, validationContext);

      if (validation1.valid && validation1.validatedPlan) {
        if (options.onPlanValidated) {
          options.onPlanValidated(validation1.validatedPlan);
        }
        return {
          status: 'SUCCESS',
          plan: validation1.validatedPlan,
          validation: validation1,
          revisionsAttempted: 0,
          durationMs: Date.now() - startTime,
        };
      }

      // Check if fatal (Stage 2 or 3) -> fail closed immediately
      const isFatal = validation1.errors.some(e => e.fatal) || !validation1.revisionAllowed;
      if (isFatal) {
        const reasons = validation1.errors.map(e => `[${e.stageName}] ${e.message}`);
        if (options.onPlanRejected) {
          options.onPlanRejected(reasons, true);
        }
        return {
          status: 'FAILED',
          validation: validation1,
          revisionsAttempted: 0,
          errorCode: 'PLAN_VALIDATION_FATAL',
          errorMessage: `Plan failed fatal validation: ${reasons.join('; ')}`,
          durationMs: Date.now() - startTime,
        };
      }

      // ─── 2. REVISION BUDGET (MAX 1 ATTEMPT) ──────────────────────────
      revisionsAttempted = 1;
      const revisionPrompt = this.buildRevisionPrompt(
        options.task,
        options.spec,
        parsedPlan1,
        validation1.errors.map(e => e.message)
      );

      const revisionInput: ProviderTaskInput = {
        id: `${options.task.id}:plan:${options.attempt}:rev:1`,
        objective: `Revise execution plan to fix validation errors`,
        prompt: revisionPrompt,
        project: options.task.project,
        repository: options.task.repository,
        branch: options.task.branch,
        systemInstructions: [
          'You are the PDL Pre-Execution Architectural Planner.',
          'Your output must be STRICTLY valid JSON conforming to StructuredExecutionPlan.',
          'Correct all structural and validation errors described in the feedback.',
        ],
      };

      const revGenStart = Date.now();
      const revResult = await options.provider.execute(revisionInput, options.task.workspacePath || process.cwd());
      const revDuration = Date.now() - revGenStart;

      if (options.onPlanGenerated) {
        options.onPlanGenerated(revResult.totalTokens, revDuration);
      }

      if (revResult.status !== 'COMPLETED') {
        const errorMsg = revResult.errorMessage || revResult.stderr || 'Planner revision failed';
        if (options.onPlanRejected) {
          options.onPlanRejected([errorMsg], true);
        }
        return {
          status: 'FAILED',
          revisionsAttempted: 1,
          errorCode: revResult.errorCode || 'PLANNER_REVISION_FAILED',
          errorMessage: errorMsg,
          durationMs: Date.now() - startTime,
        };
      }

      const parsedPlan2 = this.parsePlanJson(revResult.stdout);
      const validation2 = PlanValidator.validate(parsedPlan2, validationContext);

      if (validation2.valid && validation2.validatedPlan) {
        if (options.onPlanValidated) {
          options.onPlanValidated(validation2.validatedPlan);
        }
        return {
          status: 'SUCCESS',
          plan: validation2.validatedPlan,
          validation: validation2,
          revisionsAttempted: 1,
          durationMs: Date.now() - startTime,
        };
      }

      // Exhausted revision budget -> fail closed
      const finalReasons = validation2.errors.map(e => `[${e.stageName}] ${e.message}`);
      if (options.onPlanRejected) {
        options.onPlanRejected(finalReasons, true);
      }
      return {
        status: 'FAILED',
        validation: validation2,
        revisionsAttempted: 1,
        errorCode: 'PLAN_VALIDATION_FAILED',
        errorMessage: `Plan revision failed validation: ${finalReasons.join('; ')}`,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (options.onPlanRejected) {
        options.onPlanRejected([errorMsg], true);
      }
      return {
        status: 'FAILED',
        revisionsAttempted,
        errorCode: 'PLANNER_EXCEPTION',
        errorMessage: `Unexpected exception during planning: ${errorMsg}`,
        durationMs: Date.now() - startTime,
      };
    }
  }

  private static parsePlanJson(rawOutput: string): unknown {
    let clean = (rawOutput || '').trim();
    // Strip markdown json fences
    if (clean.startsWith('```json')) {
      clean = clean.slice(7);
    } else if (clean.startsWith('```')) {
      clean = clean.slice(3);
    }
    if (clean.endsWith('```')) {
      clean = clean.slice(0, -3);
    }
    clean = clean.trim();

    // Try finding outer JSON object {...}
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }

    try {
      return JSON.parse(clean);
    } catch {
      return null;
    }
  }

  private static buildInitialPlanPrompt(task: Task, spec: ExecutionSpec, attempt: number): string {
    const objective = spec.objective || task.objective;
    const prompt = task.prompt || '';
    const acceptance = spec.acceptanceCriteria && !isExplicitUnknown(spec.acceptanceCriteria) && Array.isArray(spec.acceptanceCriteria)
      ? spec.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')
      : 'None';

    return `You must create a StructuredExecutionPlan for the following task.

TASK ID: ${task.id}
ATTEMPT: ${attempt}
GOAL / OBJECTIVE:
${objective}

PROMPT / DETAILS:
${prompt}

ACCEPTANCE CRITERIA:
${acceptance}

CONTRACT SCHEMA TO EMIT (Valid JSON only):
{
  "planVersion": "1.0.0",
  "taskId": "${task.id}",
  "attempt": ${attempt},
  "goal": "<Comprehensive goal description >= 20 chars>",
  "filesToChange": ["<relative file paths only>"],
  "dependencies": ["<interfaces, types, or modules involved>"],
  "implementationSteps": [
    {
      "stepNumber": 1,
      "description": "<Detailed step description >= 5 chars>",
      "targetFile": "<relative file path>"
    }
  ],
  "testStrategy": ["<Specific executable verification steps including test commands>"],
  "riskPoints": ["<Risk points or failure conditions to watch out for>"],
  "rollbackConsiderations": ["<Steps to rollback or isolate if implementation fails>"],
  "complexityAssessment": "<Summary of why task requires planned sequencing>"
}

INVARIANTS:
1. All file paths must be relative (never ../ or absolute).
2. Do not expand beyond the files authorized by the task.
3. testStrategy must explicitly include verification or testing commands.
4. Output ONLY valid JSON.`;
  }

  private static buildRevisionPrompt(
    task: Task,
    spec: ExecutionSpec,
    previousPlan: unknown,
    errors: string[]
  ): string {
    return `Your previous StructuredExecutionPlan failed validation.

ERRORS DETECTED:
${errors.map(e => `- ${e}`).join('\n')}

PREVIOUS PLAN ATTEMPT:
${JSON.stringify(previousPlan, null, 2)}

TASK OBJECTIVE:
${spec.objective || task.objective}

Please revise the plan to correct all errors.
Ensure all required fields are present, filesToChange and implementationSteps are non-empty, all paths are relative, and testStrategy contains actionable test steps.
Output ONLY the revised JSON object.`;
  }
}
