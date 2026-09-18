import { describe, expect, it } from 'vitest';
import {
  PDL_AGENT_RUNTIME_CONTRACT_VERSION,
  type AgentRuntime,
  type RuntimeContext,
  type RuntimeResult,
} from '../../src/pdl/runtime/runtime-contract.js';

describe('PDL Agent Runtime Contract V1', () => {
  it('defines a stable contract version', () => {
    expect(PDL_AGENT_RUNTIME_CONTRACT_VERSION).toBe('pdl-agent-runtime-v1');
  });

  it('allows a minimal runtime implementation to produce terminal evidence', async () => {
    const context: RuntimeContext = {
      contractVersion: PDL_AGENT_RUNTIME_CONTRACT_VERSION,
      runId: 'run-test-001',
      taskId: 'TASK-TEST-001',
      repository: 'https://github.com/pubcoreagencia/pub-dev-loop',
      branch: 'main',
    };

    const runtime: AgentRuntime = {
      async execute(input): Promise<RuntimeResult> {
        return {
          status: 'COMPLETED',
          context: input,
          evidence: [{
            phase: 'COMPLETED',
            timestamp: new Date(0).toISOString(),
            event: 'runtime.completed',
            summary: 'contract proof',
          }],
        };
      },
    };

    const result = await runtime.execute(context);

    expect(result.status).toBe('COMPLETED');
    expect(result.context.runId).toBe('run-test-001');
    expect(result.context.taskId).toBe('TASK-TEST-001');
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0].phase).toBe('COMPLETED');
  });
});
