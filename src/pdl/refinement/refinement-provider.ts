import type {
  RefinementProvider,
  RefinementRequest,
  RefinementProviderResponse,
} from '../../task/refinement.js';
import type { ExecutionStep } from '../../task/execution-spec.js';

export interface PdlRefinementProviderOptions {
  defaultStepTimeoutSeconds?: number;
}

/**
 * PdlRefinementProvider — Canonical deterministic refinement provider for PDL.
 * Synthesizes TaskIntake, ContextBundle, and PreflightResult into verifiable acceptance criteria,
 * systematic validation plans, ordered execution steps, and separated risks.
 */
export class PdlRefinementProvider implements RefinementProvider {
  private readonly defaultStepTimeout: number;

  constructor(options: PdlRefinementProviderOptions = {}) {
    this.defaultStepTimeout = options.defaultStepTimeoutSeconds ?? 300;
  }

  async refine(request: RefinementRequest): Promise<RefinementProviderResponse> {
    const { intake, context, preflight } = request;

    // 1. Refine Objective (preserve raw intent, trimmed and bounded)
    const objective = intake.objective && intake.objective.trim().length > 0
      ? intake.objective.trim()
      : intake.rawRequest.slice(0, 500).trim();

    // 2. Discover Toolchain Facts from Preflight Context
    const testCommandFinding = preflight.findings.find(
      (f) => f.key === 'test:command' || (f.category === 'REPOSITORY_INSPECTION' && f.key.includes('test')),
    );
    const testCommand = testCommandFinding?.value;

    const hasTypeScript = preflight.findings.some(
      (f) => f.key === 'toolchain:typescript' && f.value === 'present',
    );

    const hasTsConfig = preflight.findings.some(
      (f) => f.key === 'config:tsconfig' && f.value === 'present',
    );

    // 3. Generate Concrete, Testable Acceptance Criteria
    const acceptanceCriteria: string[] = [];

    if (intake.requestedOutcome && intake.requestedOutcome.trim().length > 0) {
      acceptanceCriteria.push(intake.requestedOutcome.trim());
    } else {
      acceptanceCriteria.push(`Implement functionality fulfilling objective: "${objective}"`);
    }

    if (testCommand) {
      acceptanceCriteria.push(`Automated tests pass cleanly using configured test runner: "${testCommand}"`);
    } else {
      acceptanceCriteria.push('Automated tests and verification checks pass cleanly with zero errors');
    }

    if (hasTypeScript || hasTsConfig) {
      acceptanceCriteria.push('TypeScript compilation succeeds with zero type errors');
    }

    acceptanceCriteria.push('Workspace hygiene: all modified files are tracked; no unintended or extraneous files are created');

    // 4. Generate Systematic Validation Plan
    const validationPlan: string[] = [];

    if (hasTypeScript || hasTsConfig) {
      validationPlan.push('Execute TypeScript typecheck: tsc --noEmit');
    }

    if (testCommand) {
      validationPlan.push(`Run automated test suite: ${testCommand}`);
    } else {
      validationPlan.push('Run relevant unit and integration test suites');
    }

    validationPlan.push('Perform git status inspection to verify only declared task files were changed');
    validationPlan.push('Verify implementation satisfies each defined acceptance criterion');

    // 5. Generate Structured, Ordered Execution Steps
    const executionSteps: ExecutionStep[] = [
      {
        id: 'step-1-inspect',
        description: `Inspect repository workspace, existing architecture, and dependencies relevant to: ${objective}`,
        critical: true,
        timeoutSeconds: this.defaultStepTimeout,
      },
      {
        id: 'step-2-implement',
        description: `Implement code changes fulfilling: ${objective}`,
        critical: true,
        dependsOn: ['step-1-inspect'],
        timeoutSeconds: this.defaultStepTimeout,
      },
      {
        id: 'step-3-validate',
        description: `Run verification plan (typecheck, tests, and hygiene checks)`,
        critical: true,
        dependsOn: ['step-2-implement'],
        timeoutSeconds: this.defaultStepTimeout,
      },
      {
        id: 'step-4-review',
        description: 'Review git diff and final workspace state before finalization',
        critical: false,
        dependsOn: ['step-3-validate'],
        timeoutSeconds: this.defaultStepTimeout,
      },
    ];

    // 6. Preserve Explicit Constraints
    const constraints: string[] = [
      ...intake.constraints,
      'Confine all modifications strictly to the designated project workspace',
      'Preserve all frozen system invariants and backwards compatibility',
    ];

    // 7. Separate Risks from Constraints
    const risks: string[] = [];

    for (const flag of intake.ambiguityFlags) {
      if (flag === 'AMBIGUOUS_OBJECTIVE') {
        risks.push('Objective may contain ambiguous scope or unspecified edge cases');
      } else if (flag === 'MISSING_REQUESTED_OUTCOME') {
        risks.push('Request omitted explicit outcome definition; derived from objective');
      } else if (flag === 'MISSING_CONSTRAINTS') {
        risks.push('Request omitted explicit constraints; standard repository invariants applied');
      }
    }

    for (const warning of preflight.warnings) {
      risks.push(`Preflight warning: ${warning}`);
    }

    for (const failure of preflight.failures) {
      risks.push(`Preflight capability failure: ${failure.category} — ${failure.message}`);
    }

    // 8. Escalation Conditions
    const escalationConditions: string[] = [
      'Unrecoverable execution error or test failure after maximum attempts',
      'Attempted modification of protected files or forbidden git commands',
      'Workspace integrity failure or unexpected file changes outside task scope',
    ];

    // 9. Execution Instructions
    const executionInstructions: string[] = [
      intake.normalizedRequest,
      'Adhere strictly to authoritative constraints and acceptance criteria',
      'Verify all changes with tests before completing execution',
    ];

    return {
      objective,
      context,
      constraints,
      acceptanceCriteria,
      validationPlan,
      executionInstructions,
      executionSteps,
      risks,
      escalationConditions,
    };
  }
}
