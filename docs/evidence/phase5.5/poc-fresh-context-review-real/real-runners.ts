import { TASK_SUITE, BenchmarkTaskDef } from '../poc-fresh-context-review/tasks/task-suite.js';
import { callRealLLM } from './real-llm-client.js';
import { extractStructuredReview, evaluateFindingsAgainstOracle, RealRunRecord } from './review-evaluator.js';

export async function runControlSelfReview(task: BenchmarkTaskDef, runId: string): Promise<RealRunRecord> {
  // CONTROL: Simulated author context containing specification, author rationale, implementation, and prompt
  const messages = [
    {
      role: 'system' as const,
      content: 'You are an AI software engineer. You just implemented a function and must self-review your code before submitting.'
    },
    {
      role: 'user' as const,
      content: `TASK SPECIFICATION:
${task.specification}

STARTING CONTEXT:
${task.contextCode}

YOUR IMPLEMENTATION DIFF:
${task.implementationPatch}

AUTHOR THOUGHT PROCESS:
"I have implemented the code cleanly to meet the requirements described in the specification. All basic constraints and syntax checks pass."

INSTRUCTIONS:
Perform a thorough self-review of your implementation against the requirements.
Report any bugs, regressions, security flaws, or edge cases.
Respond ONLY with valid JSON conforming to this schema:
{
  "findings": [
    {
      "severity": "CRITICAL" | "MAJOR" | "MINOR" | "SUGGESTION",
      "location": "file:line",
      "finding": "description of issue",
      "rationale": "why this is an issue",
      "recommendation": "how to fix"
    }
  ],
  "overall_verdict": "PASS" | "CHANGES_REQUESTED"
}`
    }
  ];

  const llmRes = await callRealLLM({ messages, temperature: 0.1 });
  const parsed = extractStructuredReview(llmRes.content);
  const scoring = evaluateFindingsAgainstOracle(task, parsed);

  // Correction attempt if defects were identified
  let repairAttempted = false;
  let repairSuccess = false;
  let oraclePass = false;

  if (scoring.tp > 0) {
    repairAttempted = true;
    // Ask model to apply the fix
    try {
      const fixMessages = [
        ...messages,
        { role: 'assistant' as const, content: llmRes.content },
        {
          role: 'user' as const,
          content: 'Apply your recommended fix and output ONLY the complete corrected TypeScript code for the file.'
        }
      ];
      const fixRes = await callRealLLM({ messages: fixMessages, temperature: 0.0 });
      oraclePass = task.oracle(fixRes.content);
      repairSuccess = oraclePass;
    } catch {
      repairSuccess = false;
      oraclePass = false;
    }
  }

  return {
    runId,
    taskId: task.taskId,
    defectClass: task.defectClass,
    group: 'CONTROL_SELF_REVIEW',
    modelUsed: llmRes.model,
    provider: llmRes.provider,
    inputTokens: llmRes.usage.promptTokens,
    outputTokens: llmRes.usage.completionTokens,
    latencyMs: llmRes.latencyMs,
    financialCost: llmRes.usage.cost,
    verdict: parsed.overall_verdict,
    findingsCount: parsed.findings.length,
    truePositives: scoring.tp,
    falsePositives: scoring.fp,
    falseNegatives: scoring.fn,
    parserFailure: parsed.parserFailure,
    rawFindings: parsed.findings,
    repairAttempted,
    repairSuccess,
    oraclePass,
  };
}

export async function runExperimentFreshReview(task: BenchmarkTaskDef, runId: string): Promise<RealRunRecord> {
  // EXPERIMENT: 100% clean context. Zero author memory. Zero author justification.
  const messages = [
    {
      role: 'system' as const,
      content: 'You are an independent Code Reviewer. You examine git diffs against exact task specifications without seeing the author chat history.'
    },
    {
      role: 'user' as const,
      content: `TASK SPECIFICATION:
${task.specification}

EXISTING REPOSITORY CONTEXT:
${task.contextCode}

PROPOSED PATCH / GIT DIFF:
${task.implementationPatch}

REVIEW CHECKLIST:
1. Verify contract adherence and return types.
2. Check boundary conditions and 0/1 indexing.
3. Check null/undefined/error handling.
4. Check for regressions of existing behavior.
5. Check security and input boundaries.

Respond ONLY with valid JSON conforming to this schema:
{
  "findings": [
    {
      "severity": "CRITICAL" | "MAJOR" | "MINOR" | "SUGGESTION",
      "location": "file:line",
      "finding": "description of issue",
      "rationale": "why this is an issue",
      "recommendation": "how to fix"
    }
  ],
  "overall_verdict": "PASS" | "CHANGES_REQUESTED"
}`
    }
  ];

  const llmRes = await callRealLLM({ messages, temperature: 0.1 });
  const parsed = extractStructuredReview(llmRes.content);
  const scoring = evaluateFindingsAgainstOracle(task, parsed);

  // Correction attempt if defects were identified
  let repairAttempted = false;
  let repairSuccess = false;
  let oraclePass = false;

  if (scoring.tp > 0) {
    repairAttempted = true;
    // Send reviewer findings back to a clean generator instance for repair
    try {
      const repairMessages = [
        {
          role: 'system' as const,
          content: 'You are an AI engineer fixing defects found by an independent code reviewer.'
        },
        {
          role: 'user' as const,
          content: `SPECIFICATION:
${task.specification}

CURRENT CODE:
${task.implementationPatch}

REVIEWER FEEDBACK:
${JSON.stringify(parsed.findings, null, 2)}

Please fix the identified issues and output ONLY the complete corrected TypeScript code for the file.`
        }
      ];
      const repairRes = await callRealLLM({ messages: repairMessages, temperature: 0.0 });
      oraclePass = task.oracle(repairRes.content);
      repairSuccess = oraclePass;
    } catch {
      repairSuccess = false;
      oraclePass = false;
    }
  }

  return {
    runId,
    taskId: task.taskId,
    defectClass: task.defectClass,
    group: 'EXPERIMENT_FRESH_REVIEW',
    modelUsed: llmRes.model,
    provider: llmRes.provider,
    inputTokens: llmRes.usage.promptTokens,
    outputTokens: llmRes.usage.completionTokens,
    latencyMs: llmRes.latencyMs,
    financialCost: llmRes.usage.cost,
    verdict: parsed.overall_verdict,
    findingsCount: parsed.findings.length,
    truePositives: scoring.tp,
    falsePositives: scoring.fp,
    falseNegatives: scoring.fn,
    parserFailure: parsed.parserFailure,
    rawFindings: parsed.findings,
    repairAttempted,
    repairSuccess,
    oraclePass,
  };
}
