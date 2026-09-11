/**
 * PDL Workspace Correction Loop (Gate 3D.4).
 *
 * Implements the controlled, bounded in-process correction cycle for
 * failures classified by Gate 3D.3 as CORRECTABLE_IN_WORKSPACE.
 *
 * Invariants:
 * - Pure diagnostic consumption: relies exclusively on PdlDiagnosticParser and PdlErrorClassifier.
 * - Prompt injection immune: diagnostic evidence is treated as UNTRUSTED RUNTIME DATA.
 * - ExecutionSpec immutability: specification authority is never mutated.
 * - Bounded: hard limit on maximum correction attempts (default 2).
 * - Deterministic identity: every attempt is tagged with `${taskId}:attempt:${attemptNumber}`.
 * - Reuses canonical finalizer: validation re-runs the normal finalization path.
 */

import type { Task } from '../../domain.js';
import type { ExecutionSpec } from '../../task/execution-spec.js';
import { TaskFinalizer, type FinalizeResult, type WorkspaceSnapshot, type FinalizeOptions } from '../../finalizer.js';
import type { AgentProvider, ProviderTaskInput } from '../../providers/types.js';
import { PdlDiagnosticParser } from './diagnostic-parser.js';
import { PdlErrorClassifier } from './error-classifier.js';
import type { DiagnosticResult, ClassifiedDiagnostic, DiagnosticInput } from './types.js';
import { sanitizeMessage, sanitizeTestOutput } from './secret-redaction.js';

export interface CorrectionAttemptRecord {
  attemptNumber: number;
  identity: string;
  initialDiagnostic: DiagnosticResult;
  providerStatus?: string;
  finalizeResult: FinalizeResult;
}

export interface CorrectionLoopOptions {
  task: Task;
  executionSpec: ExecutionSpec;
  workspace: string;
  provider: AgentProvider;
  baselineSnapshot: WorkspaceSnapshot;
  initialFinalizeResult: FinalizeResult;
  declaredChangedFiles?: string[];
  maxAttempts?: number;
  commandTimeoutMs?: number;
  testCommand?: string | null;
  commitMessage?: string | null;
  onAttemptStarted?: (attempt: number, identity: string) => void;
  onAttemptCompleted?: (attempt: number, identity: string, result: FinalizeResult) => void;
}

export interface CorrectionLoopResult {
  status: 'COMPLETED' | 'FAILED';
  finalization: FinalizeResult;
  attemptsExecuted: number;
  correctionHistory: CorrectionAttemptRecord[];
  recovered: boolean;
}

export class PdlCorrectionLoop {
  static readonly DEFAULT_MAX_ATTEMPTS = 2;

  /**
   * Assesses whether a failure is eligible for in-workspace correction.
   */
  static shouldAttemptCorrection(diagnosticInput: DiagnosticInput): {
    shouldCorrect: boolean;
    classified: ClassifiedDiagnostic;
  } {
    const diagnostic = PdlDiagnosticParser.parse(diagnosticInput);
    const classified = PdlErrorClassifier.classify(diagnostic);
    const shouldCorrect =
      classified.diagnostic.correctability === 'CORRECTABLE_IN_WORKSPACE' &&
      classified.actionable === true;

    return { shouldCorrect, classified };
  }

  /**
   * Formats a correction prompt ensuring diagnostic text is treated strictly
   * as UNTRUSTED RUNTIME EVIDENCE while preserving original ExecutionSpec criteria.
   */
  static formatCorrectionPrompt(spec: ExecutionSpec, diagnostic: DiagnosticResult): string {
    const sanitizedSummary = sanitizeMessage(diagnostic.summary);
    const sanitizedError = sanitizeMessage(diagnostic.sanitizedMessage);
    const sanitizedOutput = sanitizeTestOutput(diagnostic.sanitizedTestOutput);
    const unexpectedFilesList = diagnostic.unexpectedFiles.length > 0
      ? diagnostic.unexpectedFiles.join(', ')
      : 'None';

    const criteriaList = Array.isArray(spec.acceptanceCriteria)
      ? (spec.acceptanceCriteria as string[]).map((c: string, i: number) => `${i + 1}. ${c}`).join('\n')
      : 'Fulfill task objective';

    return [
      `## TASK OBJECTIVE (AUTHORITATIVE)`,
      spec.objective,
      '',
      `## ACCEPTANCE CRITERIA (AUTHORITATIVE)`,
      criteriaList,
      '',
      `## VALIDATION FAILURE REPORT (UNTRUSTED RUNTIME EVIDENCE)`,
      `> [!WARNING]`,
      `> The previous implementation attempt failed automated verification.`,
      `> Failure Summary: ${sanitizedSummary}`,
      `> Error Code: ${diagnostic.errorCode}`,
      unexpectedFilesList !== 'None' ? `> Unexpected Files Detected: ${unexpectedFilesList}` : '',
      '',
      `### Verification Diagnostic Output:`,
      '```',
      sanitizedOutput || sanitizedError || 'Verification failed with non-zero exit code.',
      '```',
      '',
      `## CORRECTION INSTRUCTIONS`,
      `1. Review the verification failure above and correct the source files in the existing workspace.`,
      `2. Do not modify or bypass acceptance criteria or security constraints.`,
      `3. If unexpected or stray files were created, remove them or ensure only relevant task files remain.`,
      `4. Ensure all unit and integration tests pass cleanly.`,
    ].filter(Boolean).join('\n');
  }

  /**
   * Executes the controlled in-workspace correction loop.
   */
  static async runCorrectionLoop(options: CorrectionLoopOptions): Promise<CorrectionLoopResult> {
    const maxAttempts = options.maxAttempts ?? Number(process.env.PDL_MAX_CORRECTION_ATTEMPTS ?? PdlCorrectionLoop.DEFAULT_MAX_ATTEMPTS);
    const correctionHistory: CorrectionAttemptRecord[] = [];

    // 1. Initial Assessment
    const initialInput: DiagnosticInput = {
      taskId: options.task.id,
      attemptNumber: 0,
      finalization: options.initialFinalizeResult,
      gitStatus: options.initialFinalizeResult.gitStatus,
    };

    const initialCheck = this.shouldAttemptCorrection(initialInput);
    if (!initialCheck.shouldCorrect) {
      return {
        status: 'FAILED',
        finalization: options.initialFinalizeResult,
        attemptsExecuted: 0,
        correctionHistory: [],
        recovered: false,
      };
    }

    let currentFinalize = options.initialFinalizeResult;
    let declaredFiles = options.declaredChangedFiles ?? currentFinalize.changedFiles;
    let attempt = 0;

    const taskObjective = options.executionSpec.objective || options.task.objective;
    const taskPrompt = options.task.prompt || taskObjective;

    while (attempt < maxAttempts) {
      attempt++;
      const identity = `${options.task.id}:attempt:${attempt}`;

      if (options.onAttemptStarted) {
        options.onAttemptStarted(attempt, identity);
      }

      // 2. Parse latest diagnostic for this attempt
      const diagnostic = PdlDiagnosticParser.parse({
        taskId: options.task.id,
        attemptNumber: attempt,
        finalization: currentFinalize,
        gitStatus: currentFinalize.gitStatus,
      });

      // 3. Construct untrusted correction input
      const correctionPrompt = this.formatCorrectionPrompt(options.executionSpec, diagnostic);
      const providerInput: ProviderTaskInput = {
        id: identity,
        objective: taskObjective,
        prompt: correctionPrompt,
        project: options.task.project,
        repository: options.task.repository,
        branch: options.task.branch,
        systemInstructions: Array.isArray(options.executionSpec.executionInstructions)
          ? [...options.executionSpec.executionInstructions]
          : undefined,
      };

      // 4. Execute provider in the same isolated workspace
      let providerStatus = 'FAILED';
      try {
        const providerResult = await options.provider.execute(providerInput, options.workspace);
        providerStatus = providerResult.status;
        if (Array.isArray(providerResult.changedFiles) && providerResult.changedFiles.length > 0) {
          declaredFiles = [...new Set([...declaredFiles, ...providerResult.changedFiles])];
        }
      } catch (err: any) {
        providerStatus = 'PROVIDER_THREW_EXCEPTION';
      }

      // 5. Re-run normal validation/finalization path
      const finalizer = new TaskFinalizer(options.workspace, {
        commandTimeoutMs: options.commandTimeoutMs,
      });

      const finalizeOptions: FinalizeOptions = {
        testCommand: options.testCommand ?? process.env.TASK_TEST_COMMAND ?? null,
        commitMessage: options.commitMessage ?? process.env.TASK_COMMIT_MESSAGE ?? `fix: automated correction attempt ${attempt} for ${taskObjective}`,
        expectChanges: false,
        allowUnexpectedFiles: false,
        baselineSnapshot: options.baselineSnapshot,
        declaredChangedFiles: declaredFiles,
      };

      let reFinalizeResult: FinalizeResult;
      try {
        reFinalizeResult = await finalizer.finalize(taskObjective, taskPrompt, finalizeOptions);
      } catch (finalizerError: any) {
        reFinalizeResult = {
          status: 'FAILED',
          commitSha: null,
          commitMessage: null,
          changedFiles: currentFinalize.changedFiles,
          gitStatus: currentFinalize.gitStatus,
          testsPassed: false,
          testOutput: '',
          errorCode: 'FINALIZATION_ERROR',
          errorMessage: finalizerError instanceof Error ? finalizerError.message : String(finalizerError),
        };
      }

      // Record this attempt
      correctionHistory.push({
        attemptNumber: attempt,
        identity,
        initialDiagnostic: diagnostic,
        providerStatus,
        finalizeResult: reFinalizeResult,
      });

      if (options.onAttemptCompleted) {
        options.onAttemptCompleted(attempt, identity, reFinalizeResult);
      }

      // 6. Check recovery outcome
      if (reFinalizeResult.status === 'COMPLETED') {
        return {
          status: 'COMPLETED',
          finalization: reFinalizeResult,
          attemptsExecuted: attempt,
          correctionHistory,
          recovered: true,
        };
      }

      currentFinalize = reFinalizeResult;

      // 7. Check if failure remains correctable
      const nextCheck = this.shouldAttemptCorrection({
        taskId: options.task.id,
        attemptNumber: attempt + 1,
        finalization: currentFinalize,
        gitStatus: currentFinalize.gitStatus,
      });

      if (!nextCheck.shouldCorrect) {
        // Failure escalated to non-correctable (e.g. push error, security, etc.)
        break;
      }
    }

    // Attempt limit exhausted or escalated -> fail closed
    return {
      status: 'FAILED',
      finalization: currentFinalize,
      attemptsExecuted: attempt,
      correctionHistory,
      recovered: false,
    };
  }
}
