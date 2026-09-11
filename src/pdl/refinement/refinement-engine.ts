import type { TaskIntake } from '../../task/intake.js';
import type { ContextBundle } from '../../task/context-discovery.js';
import type { PreflightResult } from '../../task/preflight.js';
import {
  StructuredPromptRefinement,
  type RefinementProvider,
} from '../../task/refinement.js';
import type { ExecutionSpec } from '../../task/execution-spec.js';
import { PdlRefinementProvider, type PdlRefinementProviderOptions } from './refinement-provider.js';

export interface PdlRefinementEngineOptions extends PdlRefinementProviderOptions {
  customProvider?: RefinementProvider;
}

/**
 * PdlRefinementEngine — Coordinates StructuredPromptRefinement using PdlRefinementProvider.
 * Converts TaskIntake, ContextBundle, and PreflightResult into a validated ExecutionSpec.
 */
export class PdlRefinementEngine {
  private readonly promptRefinement: StructuredPromptRefinement;

  constructor(options: PdlRefinementEngineOptions = {}) {
    const provider = options.customProvider ?? new PdlRefinementProvider(options);
    this.promptRefinement = new StructuredPromptRefinement(provider);
  }

  async refine(
    intake: TaskIntake,
    context: ContextBundle,
    preflight: PreflightResult,
  ): Promise<ExecutionSpec> {
    return this.promptRefinement.refine(intake, context, preflight);
  }
}
