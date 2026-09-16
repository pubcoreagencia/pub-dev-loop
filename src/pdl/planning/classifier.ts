/**
 * Phase 7: Deterministic Task Complexity Classifier (Candidate A).
 *
 * Implements deterministic-first complexity evaluation based on
 * sealed ExecutionSpec, task instructions, and repo metadata.
 *
 * Hard Signals:
 * - HARD_01_LIFECYCLE_CORE: Target paths touch scheduler, reaper, dlq, retry, governance, persistence, router-worker
 * - HARD_02_PERSISTENCE_SCHEMA: Target paths touch db/migrations/ or SQL schemas
 * - HARD_03_BREAKING_CONTRACT: Target paths touch types/contracts (*types.ts, *contract*.ts) and modify existing types
 * - HARD_04_CIRCULAR_DEP_REFACTOR: Instructions declare "refactor", "extract module", or "circular dependency"
 * - HARD_05_SECURITY_AUTH: Target paths touch security, repo-authorization, governance
 *
 * Soft Signals (Weighted, Threshold = 3, PROVISIONAL):
 * - SOFT_01_MULTI_FILE (2 pts): Target files > 1
 * - SOFT_02_PROMPT_LENGTH (1 pt): Objective + instructions > 1,200 chars
 * - SOFT_03_MULTIPLE_ACCEPTANCE (2 pts): Acceptance criteria count >= 4
 * - SOFT_04_ASYNC_CONCURRENCY (2 pts): Text matches concurrency keywords
 * - SOFT_05_ERROR_HANDLING_DEPTH (1 pt): Text matches resilience/error handling keywords
 * - SOFT_06_PREVIOUS_FAILURE (2 pts): task.retryCount > 0
 * - SOFT_07_ESTIMATED_DIFF_LOC (2 pts): Spec indicates > 50 lines of modification
 */

import type { Task } from '../../domain.js';
import type { ExecutionSpec } from '../../task/execution-spec.js';
import { isExplicitUnknown } from '../../task/execution-spec.js';
import type {
  ComplexityClassificationDecision,
  HardComplexitySignal,
  SoftComplexitySignal,
  SoftSignalTrigger,
} from './types.js';

export const PROVISIONAL_SOFT_SIGNAL_THRESHOLD = 3;

// Concurrency & Timing keywords for SOFT_04
const CONCURRENCY_KEYWORDS = [
  'mutex',
  'lease',
  'concurrency',
  'race condition',
  'deadlock',
  'heartbeat',
  'jitter',
];

// Error Handling Depth keywords for SOFT_05
const ERROR_HANDLING_KEYWORDS = [
  'fail-closed',
  'fail closed',
  'exponential backoff',
  'poison',
  'quarantine',
  'rollback',
];

// Structural refactoring keywords for HARD_04
const REFACTOR_KEYWORDS = [
  'refactor',
  'extract module',
  'circular dependency',
];

export class TaskComplexityClassifier {
  private readonly softThreshold: number;

  constructor(softThreshold: number = PROVISIONAL_SOFT_SIGNAL_THRESHOLD) {
    this.softThreshold = softThreshold;
  }

  /**
   * Deterministically evaluates task complexity from Task and ExecutionSpec.
   * Fails closed: if any error occurs during evaluation, returns COMPLEX with planningRequired: true.
   */
  public evaluate(task: Task, spec: ExecutionSpec): ComplexityClassificationDecision {
    const startTime = Date.now();
    try {
      return this.doEvaluate(task, spec, startTime);
    } catch (err: any) {
      const durationMs = Math.max(1, Date.now() - startTime);
      return {
        classifierVersion: '1.0.0',
        taskId: task.id,
        tier: 'COMPLEX',
        planningRequired: true,
        hardSignalsTriggered: ['HARD_01_LIFECYCLE_CORE'],
        softSignalsTriggered: [],
        softSignalScore: 0,
        softSignalThreshold: this.softThreshold,
        decisionRationale: `Safety fail-closed triggered due to classifier exception: ${err?.message || String(err)}`,
        evaluationDurationMs: durationMs,
        evaluatedAt: new Date().toISOString(),
      };
    }
  }

  private doEvaluate(
    task: Task,
    spec: ExecutionSpec,
    startTime: number
  ): ComplexityClassificationDecision {
    const hardSignals: HardComplexitySignal[] = [];
    const softSignals: SoftSignalTrigger[] = [];

    const rawObjective = (spec.objective || task.objective || '').trim();
    const rawPrompt = (task.prompt || '').trim();
    const fullText = `${rawObjective}\n${rawPrompt}`.toLowerCase();

    // Extract execution instructions, acceptance criteria, and constraints
    const instructions: string[] = [];
    if (spec.executionInstructions && !isExplicitUnknown(spec.executionInstructions)) {
      instructions.push(...spec.executionInstructions);
    }
    if (spec.acceptanceCriteria && !isExplicitUnknown(spec.acceptanceCriteria) && Array.isArray(spec.acceptanceCriteria)) {
      instructions.push(...spec.acceptanceCriteria);
    }
    if (spec.constraints && !isExplicitUnknown(spec.constraints) && Array.isArray(spec.constraints)) {
      instructions.push(...spec.constraints);
    }
    const combinedInstructionsText = `${fullText}\n${instructions.join('\n')}`.toLowerCase();

    // Extract target files
    const targetFiles = this.extractTargetFiles(spec, combinedInstructionsText);

    // ─── 1. HARD SIGNALS ───────────────────────────────────────────────

    // HARD_01_LIFECYCLE_CORE: Target paths include src/pdl/{scheduler,reaper,dlq,retry,governance,persistence}/ or src/router-worker.ts
    const coreLifecyclePattern = /(?:^|\/)(?:src\/pdl\/(?:scheduler|reaper|dlq|retry|governance|persistence)\/|src\/router-worker\.ts)/i;
    const hasCoreLifecycleFile = targetFiles.some(f => coreLifecyclePattern.test(f.replace(/\\/g, '/')));
    const mentionsCoreInText = combinedInstructionsText.includes('src/pdl/scheduler') ||
      combinedInstructionsText.includes('src/pdl/reaper') ||
      combinedInstructionsText.includes('src/pdl/dlq') ||
      combinedInstructionsText.includes('src/pdl/retry') ||
      combinedInstructionsText.includes('src/pdl/governance') ||
      combinedInstructionsText.includes('src/pdl/persistence') ||
      combinedInstructionsText.includes('src/router-worker.ts');

    if (hasCoreLifecycleFile || mentionsCoreInText) {
      hardSignals.push('HARD_01_LIFECYCLE_CORE');
    }

    // HARD_02_PERSISTENCE_SCHEMA: Target paths touch db/migrations/ or SQL schema files
    const schemaPattern = /(?:^|\/)(?:db\/migrations\/|.*\.sql$)/i;
    const hasSchemaFile = targetFiles.some(f => schemaPattern.test(f.replace(/\\/g, '/')));
    const mentionsSchemaInText = combinedInstructionsText.includes('db/migrations/') ||
      combinedInstructionsText.includes('.sql');

    if (hasSchemaFile || mentionsSchemaInText) {
      hardSignals.push('HARD_02_PERSISTENCE_SCHEMA');
    }

    // HARD_03_BREAKING_CONTRACT: Target touches public interface definitions (src/types.ts, *contract*.ts, *types.ts)
    // and modifies existing types (not just standalone new enum/constant file)
    const contractPattern = /(?:^|\/)(?:.*contract.*\.ts$|.*types\.ts$)/i;
    const hasContractFile = targetFiles.some(f => contractPattern.test(f.replace(/\\/g, '/')));
    const mentionsContractInText = combinedInstructionsText.includes('contract') && combinedInstructionsText.includes('.ts');

    if (hasContractFile || mentionsContractInText) {
      // Check if it's modifying existing interfaces / types rather than just appending isolated constant
      const isBreakingOrModifying = combinedInstructionsText.includes('breaking') ||
        combinedInstructionsText.includes('refactor') ||
        combinedInstructionsText.includes('modify') ||
        combinedInstructionsText.includes('update interface') ||
        combinedInstructionsText.includes('union') ||
        combinedInstructionsText.includes('extend') ||
        combinedInstructionsText.includes('adapt') ||
        combinedInstructionsText.includes('backward compatibility');

      if (isBreakingOrModifying || hasContractFile) {
        hardSignals.push('HARD_03_BREAKING_CONTRACT');
      }
    }

    // HARD_04_CIRCULAR_DEP_REFACTOR: Task instructions explicitly declare "refactor", "extract module", or "circular dependency"
    const hasRefactorKeyword = REFACTOR_KEYWORDS.some(kw => combinedInstructionsText.includes(kw));
    if (hasRefactorKeyword) {
      hardSignals.push('HARD_04_CIRCULAR_DEP_REFACTOR');
    }

    // HARD_05_SECURITY_AUTH: Target paths touch src/pdl/security/, repo-authorization.ts, or src/pdl/governance/
    const securityPattern = /(?:^|\/)(?:src\/pdl\/security\/|.*repo-authorization\.ts|src\/pdl\/governance\/)/i;
    const hasSecurityFile = targetFiles.some(f => securityPattern.test(f.replace(/\\/g, '/')));
    const mentionsSecurityInText = combinedInstructionsText.includes('src/pdl/security') ||
      combinedInstructionsText.includes('repo-authorization') ||
      combinedInstructionsText.includes('governance');

    if (hasSecurityFile || mentionsSecurityInText) {
      hardSignals.push('HARD_05_SECURITY_AUTH');
    }

    // ─── 2. SOFT SIGNALS ───────────────────────────────────────────────

    // SOFT_01_MULTI_FILE (2 pts): Target files > 1
    if (targetFiles.length > 1) {
      softSignals.push({
        signal: 'SOFT_01_MULTI_FILE',
        weight: 2,
        evidence: `Target files count is ${targetFiles.length}: [${targetFiles.join(', ')}]`,
      });
    }

    // SOFT_02_PROMPT_LENGTH (1 pt): Raw task objective + instructions > 1,200 characters
    const totalPromptChars = rawObjective.length + rawPrompt.length + instructions.join('\n').length;
    if (totalPromptChars > 1200) {
      softSignals.push({
        signal: 'SOFT_02_PROMPT_LENGTH',
        weight: 1,
        evidence: `Task prompt length is ${totalPromptChars} characters (> 1,200)`,
      });
    }

    // SOFT_03_MULTIPLE_ACCEPTANCE (2 pts): Number of acceptance criteria items >= 4
    let acceptanceCount = 0;
    if (spec.acceptanceCriteria && !isExplicitUnknown(spec.acceptanceCriteria) && Array.isArray(spec.acceptanceCriteria)) {
      acceptanceCount = spec.acceptanceCriteria.length;
    }
    if (acceptanceCount >= 4) {
      softSignals.push({
        signal: 'SOFT_03_MULTIPLE_ACCEPTANCE',
        weight: 2,
        evidence: `Acceptance criteria count is ${acceptanceCount} (>= 4)`,
      });
    }

    // SOFT_04_ASYNC_CONCURRENCY (2 pts): Text matches concurrency terms
    const matchedConcurrency = CONCURRENCY_KEYWORDS.filter(kw => combinedInstructionsText.includes(kw));
    if (matchedConcurrency.length > 0) {
      softSignals.push({
        signal: 'SOFT_04_ASYNC_CONCURRENCY',
        weight: 2,
        evidence: `Matched concurrency keywords: [${matchedConcurrency.join(', ')}]`,
      });
    }

    // SOFT_05_ERROR_HANDLING_DEPTH (1 pt): Text matches resilience / error handling terms
    const matchedErrorHandling = ERROR_HANDLING_KEYWORDS.filter(kw => combinedInstructionsText.includes(kw));
    if (matchedErrorHandling.length > 0) {
      softSignals.push({
        signal: 'SOFT_05_ERROR_HANDLING_DEPTH',
        weight: 1,
        evidence: `Matched resilience/error keywords: [${matchedErrorHandling.join(', ')}]`,
      });
    }

    // SOFT_06_PREVIOUS_FAILURE (2 pts): task.retryCount > 0
    if ((task.retryCount ?? 0) > 0) {
      softSignals.push({
        signal: 'SOFT_06_PREVIOUS_FAILURE',
        weight: 2,
        evidence: `Task retry count is ${task.retryCount} (> 0)`,
      });
    }

    // SOFT_07_ESTIMATED_DIFF_LOC (2 pts): Spec indicates > 50 lines of new or modified logic
    const locMatch = combinedInstructionsText.match(/(?:lines?|loc)\s*(?:of\s*(?:code|diff))?\s*(?:>|>=|over|approx(?:imately)?|around|exceeding)?\s*(\d+)/i) ||
      combinedInstructionsText.match(/(\d+)\s*(?:lines?|loc)\s*(?:of\s*(?:code|diff))?/i);
    const estimatedLoc = locMatch ? parseInt(locMatch[1], 10) : 0;
    if (estimatedLoc > 50) {
      softSignals.push({
        signal: 'SOFT_07_ESTIMATED_DIFF_LOC',
        weight: 2,
        evidence: `Estimated LOC from spec is ${estimatedLoc} (> 50 LOC)`,
      });
    }

    // ─── 3. CLASSIFICATION & DECISION ──────────────────────────────────
    const softSignalScore = softSignals.reduce((sum, s) => sum + s.weight, 0);
    const hasHardSignal = hardSignals.length > 0;
    const meetsSoftThreshold = softSignalScore >= this.softThreshold;

    const planningRequired = hasHardSignal || meetsSoftThreshold;
    const tier = planningRequired ? 'COMPLEX' : 'SIMPLE';

    let decisionRationale = '';
    if (hasHardSignal) {
      decisionRationale = `Hard signal(s) triggered: [${hardSignals.join(', ')}]. Pre-execution planning is MANDATORY.`;
    } else if (meetsSoftThreshold) {
      decisionRationale = `Soft signal score ${softSignalScore} meets provisional threshold ${this.softThreshold}. Pre-execution planning triggered.`;
    } else {
      decisionRationale = `Soft signal score ${softSignalScore} below threshold ${this.softThreshold}; no hard signals. Direct execution selected.`;
    }

    const durationMs = Math.max(1, Date.now() - startTime);

    return {
      classifierVersion: '1.0.0',
      taskId: task.id,
      tier,
      planningRequired,
      hardSignalsTriggered: hardSignals,
      softSignalsTriggered: softSignals,
      softSignalScore,
      softSignalThreshold: this.softThreshold,
      decisionRationale,
      evaluationDurationMs: durationMs,
      evaluatedAt: new Date().toISOString(),
    };
  }

  private extractTargetFiles(spec: ExecutionSpec, text: string): string[] {
    const files = new Set<string>();

    // 1. From execution steps target files if present
    if (spec.executionSteps && !isExplicitUnknown(spec.executionSteps) && Array.isArray(spec.executionSteps)) {
      for (const step of spec.executionSteps) {
        if (typeof (step as any).targetFile === 'string') {
          files.add((step as any).targetFile.trim());
        }
      }
    }

    // 2. Scan text for file paths: with or without directory prefix
    const filePathRegex = /(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.(?:ts|js|mjs|sql|json|md)/gi;
    let match: RegExpExecArray | null;
    while ((match = filePathRegex.exec(text)) !== null) {
      files.add(match[0].toLowerCase());
    }

    return Array.from(files);
  }
}

export const defaultComplexityClassifier = new TaskComplexityClassifier();
