/**
 * PDL Validation Diagnostic Parser (Gate 3D.3).
 *
 * Deterministically parses execution and finalization artifacts into
 * structured, sanitized, and bounded diagnostic evidence.
 *
 * Invariants:
 * - Pure and side-effect free: never invokes commands or filesystem.
 * - Deterministic: byte-identical output for identical input.
 * - Prompt injection immune: marks data as untrusted, scrubs instructions.
 * - Bounded: truncates and scrubs all evidence.
 */

import type {
  DiagnosticInput,
  DiagnosticResult,
  DiagnosticSource,
  ErrorClass,
  Correctability,
  FailureKind,
  ParsedFailureDetails,
} from './types.js';
import {
  sanitizeMessage,
  sanitizeTestOutput,
  sanitizeDiff,
} from './secret-redaction.js';

// Patterns for test failure recognition
const TEST_FAIL_HEADER_REGEX = /(?:FAIL|✕|●)\s+([^\r\n]+)/g;
const TEST_FAILED_COUNT_REGEX = /(?:Tests?:\s*)?(\d+)\s+failed/i;
const ASSERTION_ERROR_REGEX = /(AssertionError(?::[^\r\n]+)?|Expected\s+:[^\r\n]+\s+Received\s+:[^\r\n]+)/i;

// Patterns for security error recognition
const PATH_TRAVERSAL_REGEX = /(Path traversal blocked|resolves outside workspace)/i;
const SENSITIVE_PATTERN_REGEX = /(Access denied:\s*path contains sensitive pattern)/i;
const BLOCKED_GIT_REGEX = /(Blocked git command|git subcommand.*blocked)/i;

export class PdlDiagnosticParser {
  /**
   * Parse a DiagnosticInput into a standardized DiagnosticResult.
   */
  static parse(input: DiagnosticInput): DiagnosticResult {
    const taskId = input.taskId || 'unknown-task';
    const attemptNumber = typeof input.attemptNumber === 'number' ? input.attemptNumber : 0;
    const attemptId = `${taskId}:attempt:${attemptNumber}`;

    // 1. Resolve Authoritative Error Code, Source, Message, and Exit Code
    const { source, errorCode, rawMessage, exitCode } = this.resolveAuthoritativeFault(input);

    // 2. Extract and sanitize raw evidence
    const sanitizedMessage = sanitizeMessage(rawMessage);
    const rawTestOutput = input.finalization?.testOutput || input.rawOutput?.stdout || input.rawOutput?.stderr || '';
    const sanitizedTestOutput = sanitizeTestOutput(rawTestOutput);
    const sanitizedDiff = sanitizeDiff(input.gitDiff || '');

    // 3. Changed & unexpected files
    const changedFiles = Array.isArray(input.finalization?.changedFiles)
      ? [...input.finalization.changedFiles]
      : Array.isArray(input.execution?.changedFiles)
      ? [...input.execution.changedFiles]
      : [];

    const unexpectedFiles = this.extractUnexpectedFiles(input, rawMessage);

    // 4. Parse deep failure details (compiler, test, lint, git hygiene)
    const combinedText = `${rawMessage}\n${rawTestOutput}\n${input.rawOutput?.stderr || ''}`;
    const failureDetails = this.parseFailureDetails(combinedText, unexpectedFiles, errorCode);

    // 5. Derive base taxonomy and correctability
    const { errorClass, correctability, isCorrectableInWorkspace, summary } =
      this.evaluateTaxonomy(errorCode, failureDetails, sanitizedMessage);

    return {
      identity: {
        taskId,
        attemptNumber,
        id: attemptId,
      },
      source,
      errorCode,
      errorClass,
      correctability,
      isCorrectableInWorkspace,
      summary,
      sanitizedMessage,
      sanitizedTestOutput,
      sanitizedDiff,
      changedFiles,
      unexpectedFiles,
      exitCode,
      failureDetails,
      untrusted: true,
    };
  }

  /**
   * Resolves the primary fault following strict authority hierarchy:
   * 1. Finalizer outcome (if status === 'FAILED')
   * 2. Execution outcome (if status === 'FAILED')
   * 3. Thrown error / exception
   * 4. Raw process output / exit code
   * 5. Unknown fallback
   */
  private static resolveAuthoritativeFault(input: DiagnosticInput): {
    source: DiagnosticSource;
    errorCode: string;
    rawMessage: string;
    exitCode: number | null;
  } {
    // 1. Finalizer failure takes absolute precedence
    if (input.finalization && input.finalization.status === 'FAILED') {
      const code = input.finalization.errorCode || 'FINALIZATION_FAILED';
      const msg = input.finalization.errorMessage || input.finalization.testOutput || 'Finalization failed';
      const exitCode = input.finalization.testsPassed === false ? 1 : null;
      return {
        source: 'finalizer',
        errorCode: code,
        rawMessage: msg,
        exitCode,
      };
    }

    // 2. Execution failure
    if (input.execution && input.execution.status === 'FAILED') {
      const code = input.execution.errorCode || 'EXECUTION_FAILED';
      const msg = input.execution.errorMessage || 'Execution failed';
      return {
        source: 'execution',
        errorCode: code,
        rawMessage: msg,
        exitCode: null,
      };
    }

    // 3. Thrown error
    if (input.error) {
      const errorMsg = input.error instanceof Error ? input.error.message : String(input.error);
      const isSecurity =
        PATH_TRAVERSAL_REGEX.test(errorMsg) ||
        SENSITIVE_PATTERN_REGEX.test(errorMsg) ||
        BLOCKED_GIT_REGEX.test(errorMsg);

      return {
        source: isSecurity ? 'security' : 'process',
        errorCode: isSecurity ? 'SECURITY_VIOLATION' : 'RUNTIME_EXCEPTION',
        rawMessage: errorMsg,
        exitCode: null,
      };
    }

    // 4. Raw process exit code
    if (input.rawOutput && typeof input.rawOutput.exitCode === 'number' && input.rawOutput.exitCode !== 0) {
      const msg = input.rawOutput.stderr || input.rawOutput.stdout || `Process exited with code ${input.rawOutput.exitCode}`;
      return {
        source: 'process',
        errorCode: 'PROCESS_EXIT_ERROR',
        rawMessage: msg,
        exitCode: input.rawOutput.exitCode,
      };
    }

    // 5. Unknown / Clean fallback
    return {
      source: 'runtime-diagnostic',
      errorCode: 'UNKNOWN_FAILURE',
      rawMessage: 'No failure details or error code provided',
      exitCode: null,
    };
  }

  /**
   * Extracts unexpected files list from finalizer message or git status.
   */
  private static extractUnexpectedFiles(input: DiagnosticInput, message: string): string[] {
    const unexpectedMatch = message.match(/Unexpected changes detected:\s*(.*?)(?:\.\s*Agent declared|\.\s*Commit aborted|\.$|$)/i);
    if (unexpectedMatch && unexpectedMatch[1]) {
      return unexpectedMatch[1]
        .split(',')
        .map(f => f.trim())
        .filter(Boolean);
    }

    if (input.finalization?.errorCode === 'FAILED_UNEXPECTED_CHANGES' && input.finalization.gitStatus) {
      return input.finalization.gitStatus
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length >= 3)
        .map(line => line.replace(/^[\s\w?]+/, '').trim())
        .filter(Boolean);
    }

    return [];
  }

  /**
   * Parses compiler, test, lint, and security failure details.
   */
  private static parseFailureDetails(
    text: string,
    unexpectedFiles: string[],
    errorCode: string
  ): ParsedFailureDetails {
    // 1. Security violations
    if (
      errorCode === 'SECURITY_VIOLATION' ||
      PATH_TRAVERSAL_REGEX.test(text) ||
      SENSITIVE_PATTERN_REGEX.test(text) ||
      BLOCKED_GIT_REGEX.test(text)
    ) {
      return { failureKind: 'security_violation' };
    }

    // 2. Git Hygiene
    if (errorCode === 'FAILED_UNEXPECTED_CHANGES' || unexpectedFiles.length > 0) {
      return {
        failureKind: 'git_hygiene',
        unexpectedFiles,
      };
    }

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // 3. Compiler Errors
    const compilerMatches: string[] = [];
    for (const line of lines) {
      if (
        /(?:TS\d+:|SyntaxError:|[^\s:]+:\d+:\d+\s*-\s*error\s+TS\d+:)/i.test(line)
      ) {
        compilerMatches.push(line);
        if (compilerMatches.length >= 10) break;
      }
    }

    if (compilerMatches.length > 0 || errorCode === 'COMPILATION_ERROR') {
      return {
        failureKind: 'compilation_error',
        compilerErrors: compilerMatches,
      };
    }

    // 4. Linter Errors
    const lintMatches: string[] = [];
    for (const line of lines) {
      if (
        /(?::\d+:\d+:\s*(?:error|warning)\b|\b\d+:\d+\s+(?:error|warning)\b|\[@typescript-eslint|eslint|prettier)/i.test(line)
      ) {
        lintMatches.push(line);
        if (lintMatches.length >= 10) break;
      }
    }

    if (lintMatches.length > 0 || errorCode === 'LINT_ERROR') {
      return {
        failureKind: 'lint_error',
        lintErrors: lintMatches,
      };
    }

    // 5. Test Failures
    const failedTests: string[] = [];
    const testHeaderRegex = new RegExp(TEST_FAIL_HEADER_REGEX);
    let match: RegExpExecArray | null;
    while ((match = testHeaderRegex.exec(text)) !== null) {
      failedTests.push(match[1].trim());
      if (failedTests.length >= 10) break;
    }

    let failedTestCount: number | undefined = undefined;
    const countMatch = text.match(TEST_FAILED_COUNT_REGEX);
    if (countMatch && countMatch[1]) {
      failedTestCount = parseInt(countMatch[1], 10);
    } else if (failedTests.length > 0) {
      failedTestCount = failedTests.length;
    }

    if (
      errorCode === 'TASK_TESTS_FAILED' ||
      failedTests.length > 0 ||
      failedTestCount !== undefined ||
      ASSERTION_ERROR_REGEX.test(text)
    ) {
      return {
        failureKind: 'test_failure',
        failedTestCount: failedTestCount ?? 1,
        failedTests: failedTests.length > 0 ? failedTests : undefined,
      };
    }

    // 6. Timeouts
    if (errorCode.includes('TIMEOUT') || errorCode === 'TIMED_OUT') {
      return { failureKind: 'timeout' };
    }

    // 7. Push / Commit
    if (errorCode.includes('PUSH')) {
      return { failureKind: 'push_error' };
    }
    if (errorCode.includes('COMMIT')) {
      return { failureKind: 'commit_error' };
    }

    // 8. Infrastructure
    if (
      errorCode === 'START_ERROR' ||
      errorCode === 'ALL_PROVIDERS_FAILED' ||
      errorCode === 'GATEWAY_EXHAUSTED' ||
      errorCode === 'ROUTER_CONNECTION_ERROR' ||
      errorCode === 'TOOL_LOOP_LIMIT'
    ) {
      return { failureKind: 'infrastructure_error' };
    }

    return { failureKind: 'unknown' };
  }

  /**
   * Deterministic mapping from error code and failure details to taxonomy and correctability.
   */
  private static evaluateTaxonomy(
    errorCode: string,
    details: ParsedFailureDetails,
    message: string
  ): {
    errorClass: ErrorClass;
    correctability: Correctability;
    isCorrectableInWorkspace: boolean;
    summary: string;
  } {
    // 1. Security boundary violations — strictly terminal
    if (
      errorCode === 'SECURITY_VIOLATION' ||
      details.failureKind === 'security_violation' ||
      PATH_TRAVERSAL_REGEX.test(message) ||
      SENSITIVE_PATTERN_REGEX.test(message) ||
      BLOCKED_GIT_REGEX.test(message)
    ) {
      return {
        errorClass: 'SECURITY',
        correctability: 'SECURITY_ABORT',
        isCorrectableInWorkspace: false,
        summary: 'Security violation detected: access denied or command blocked',
      };
    }

    // 2. Correctable failures (agent in workspace can plausibly fix)
    if (
      errorCode === 'TASK_TESTS_FAILED' ||
      details.failureKind === 'test_failure'
    ) {
      const countStr = details.failedTestCount ? ` (${details.failedTestCount} tests failed)` : '';
      return {
        errorClass: 'CORRECTABLE',
        correctability: 'CORRECTABLE_IN_WORKSPACE',
        isCorrectableInWorkspace: true,
        summary: `Task validation tests failed${countStr}`,
      };
    }

    if (
      errorCode === 'FAILED_UNEXPECTED_CHANGES' ||
      details.failureKind === 'git_hygiene'
    ) {
      const fileCount = details.unexpectedFiles ? ` (${details.unexpectedFiles.length} unexpected files)` : '';
      return {
        errorClass: 'CORRECTABLE',
        correctability: 'CORRECTABLE_IN_WORKSPACE',
        isCorrectableInWorkspace: true,
        summary: `Unexpected workspace modifications detected${fileCount}`,
      };
    }

    if (
      errorCode === 'COMPILATION_ERROR' ||
      details.failureKind === 'compilation_error'
    ) {
      return {
        errorClass: 'CORRECTABLE',
        correctability: 'CORRECTABLE_IN_WORKSPACE',
        isCorrectableInWorkspace: true,
        summary: 'Source code compilation or syntax error detected',
      };
    }

    if (
      errorCode === 'LINT_ERROR' ||
      details.failureKind === 'lint_error'
    ) {
      return {
        errorClass: 'CORRECTABLE',
        correctability: 'CORRECTABLE_IN_WORKSPACE',
        isCorrectableInWorkspace: true,
        summary: 'Linter validation failed',
      };
    }

    // 3. Retryable transient failures
    if (
      errorCode === 'COMMIT_FAILED' ||
      details.failureKind === 'commit_error' ||
      errorCode === 'ROUTER_CONNECTION_ERROR' ||
      errorCode === 'EMPTY_RESPONSE'
    ) {
      return {
        errorClass: 'RETRYABLE',
        correctability: 'RETRYABLE_TRANSIENT',
        isCorrectableInWorkspace: false,
        summary: `Transient operation failed (${errorCode}), eligible for retry`,
      };
    }

    if (errorCode === 'ROUTER_HTTP_ERROR') {
      return {
        errorClass: 'RETRYABLE',
        correctability: 'RETRYABLE_TRANSIENT',
        isCorrectableInWorkspace: false,
        summary: 'Provider gateway returned transient HTTP error',
      };
    }

    // 4. Infrastructure failures (timeout, host setup, exhaustion)
    if (
      errorCode.includes('TIMEOUT') ||
      errorCode === 'TIMED_OUT' ||
      details.failureKind === 'timeout' ||
      errorCode === 'START_ERROR' ||
      errorCode === 'ALL_PROVIDERS_FAILED' ||
      errorCode === 'GATEWAY_EXHAUSTED' ||
      errorCode === 'TOOL_LOOP_LIMIT' ||
      errorCode === 'NO_RESPONSE'
    ) {
      return {
        errorClass: 'INFRASTRUCTURE',
        correctability: 'INFRASTRUCTURE_FAILURE',
        isCorrectableInWorkspace: false,
        summary: `Infrastructure or execution timeout fault (${errorCode})`,
      };
    }

    // 5. Unrecoverable failures (remote push, finalization corruption, cancelled)
    if (
      errorCode === 'PUSH_FAILED' ||
      errorCode === 'GITHUB_PUSH_FAILED' ||
      details.failureKind === 'push_error' ||
      errorCode === 'FINALIZATION_ERROR' ||
      errorCode === 'FINALIZATION_MISSING' ||
      errorCode === 'WORKER_CANCELLED' ||
      errorCode === 'PARTIAL_EXECUTION_REQUIRES_REVIEW'
    ) {
      return {
        errorClass: 'UNRECOVERABLE',
        correctability: 'FATAL_UNRECOVERABLE',
        isCorrectableInWorkspace: false,
        summary: `Unrecoverable fatal execution failure (${errorCode})`,
      };
    }

    // 6. Unknown failure — Fail Closed Rule: UNKNOWN ≠ CORRECTABLE
    return {
      errorClass: 'UNKNOWN',
      correctability: 'UNKNOWN_FAIL_CLOSED',
      isCorrectableInWorkspace: false,
      summary: `Unknown or unclassified failure (${errorCode}): failing closed`,
    };
  }
}
