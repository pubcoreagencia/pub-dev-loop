import * as fs from 'fs';
import * as path from 'path';
import { TASK_SUITE, BenchmarkTaskDef } from '../poc-fresh-context-review/tasks/task-suite.js';
import { callRealLLM } from '../poc-fresh-context-review-real/real-llm-client.js';
import { extractStructuredReview, StructuredFinding } from '../poc-fresh-context-review-real/review-evaluator.js';
import { SEMANTIC_ORACLES } from './semantic-oracles.js';

const OUT_DIR = import.meta.dirname;
const RAW_RUNS_PATH = path.join(OUT_DIR, 'raw-runs.jsonl');
const REVIEW_RESULTS_PATH = path.join(OUT_DIR, 'review-results.jsonl');
const BLIND_EVAL_PATH = path.join(OUT_DIR, 'blind-evaluation-results.jsonl');

interface SubmissionRecord {
  submissionId: string;
  runId: string;
  passNumber: number;
  taskId: string;
  group: 'CONTROL' | 'EXPERIMENT';
  modelUsed: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  rawResponse: string;
  parsedVerdict: 'PASS' | 'CHANGES_REQUESTED';
  parserFailure: boolean;
  findings: StructuredFinding[];
  repairAttempted: boolean;
  repairSuccess: boolean;
  oraclePass: boolean;
  timestamp: string;
}

interface BlindEvaluationRecord {
  submissionId: string;
  taskId: string;
  defectClass: string;
  findingIndex: number;
  findingSeverity: string;
  findingText: string;
  findingRationale: string;
  findingRecommendation: string;
  isTruePositive: boolean;
  isFalsePositive: boolean;
  evaluationNote: string;
}

const REVIEW_CHECKLIST_TEXT = `REVIEW CHECKLIST:
1. Contract adherence: Verify return types, preserved interfaces, and field preservation.
2. Boundary conditions: Check 0-indexing vs 1-indexing, inclusive vs exclusive slice limits, and count thresholds.
3. Null/undefined/error handling: Verify safe handling of absent inputs and appropriate error propagation.
4. Existing behavior/regression: Ensure existing invariants and filters are not accidentally removed or weakened.
5. Security/input boundaries: Check for path traversal, unauthorized directory escapes, and unvalidated arguments.`;

const OUTPUT_SCHEMA_INSTRUCTION = `Respond ONLY with valid JSON conforming strictly to this structure:
{
  "findings": [
    {
      "severity": "CRITICAL" | "MAJOR" | "MINOR" | "SUGGESTION",
      "location": "file:line",
      "finding": "concise description of issue",
      "rationale": "why this is an issue",
      "recommendation": "how to fix"
    }
  ],
  "overall_verdict": "PASS" | "CHANGES_REQUESTED"
}`;

const AUTHOR_CONTEXT_TEXT = `AUTHOR CONTEXT (PRIOR SESSION LOG):
Task intake processed at session start. Author reviewed project architecture, inspected target file, drafted unit specifications, and completed initial implementation pass against constraints. No operational tool errors recorded.`;

async function executeReview(
  task: BenchmarkTaskDef,
  group: 'CONTROL' | 'EXPERIMENT',
  runId: string,
  pass: number
): Promise<SubmissionRecord> {
  const isControl = group === 'CONTROL';

  const userContent = [
    `TASK SPECIFICATION:\n${task.specification}`,
    `RELEVANT REPOSITORY CONTEXT:\n${task.contextCode}`,
    `IMPLEMENTATION DIFF:\n${task.implementationPatch}`,
    ...(isControl ? [AUTHOR_CONTEXT_TEXT] : []),
    REVIEW_CHECKLIST_TEXT,
    'Review the implementation against the specification and identify defects.',
    OUTPUT_SCHEMA_INSTRUCTION,
  ].join('\n\n');

  const messages = [
    {
      role: 'system' as const,
      content: 'You are a software engineer reviewing an implementation before submission.',
    },
    {
      role: 'user' as const,
      content: userContent,
    },
  ];

  const submissionId = `sub-${group.toLowerCase()}-${task.taskId}-p${pass}-${Date.now()}`;
  const timestamp = new Date().toISOString();

  let llmRes: any;
  let parsed: any;
  try {
    llmRes = await callRealLLM({ messages, temperature: 0.1 });
    parsed = extractStructuredReview(llmRes.content);
  } catch (err: any) {
    return {
      submissionId,
      runId,
      passNumber: pass,
      taskId: task.taskId,
      group,
      modelUsed: 'openrouter/free',
      provider: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      rawResponse: `ERROR: ${err.message}`,
      parsedVerdict: 'CHANGES_REQUESTED',
      parserFailure: true,
      findings: [],
      repairAttempted: false,
      repairSuccess: false,
      oraclePass: false,
      timestamp,
    };
  }

  // Check if findings warrant repair
  let repairAttempted = false;
  let repairSuccess = false;
  let oraclePass = false;

  const oracleDef = SEMANTIC_ORACLES[task.taskId];
  const hasPotentialFinding = parsed.findings.some(
    (f: StructuredFinding) => f.severity === 'CRITICAL' || f.severity === 'MAJOR'
  );

  if (hasPotentialFinding && parsed.findings.length > 0) {
    repairAttempted = true;
    try {
      const repairPrompt = [
        {
          role: 'system' as const,
          content: 'You are an engineer fixing code defects identified in review.',
        },
        {
          role: 'user' as const,
          content: `SPECIFICATION:\n${task.specification}\n\nORIGINAL DIFF:\n${task.implementationPatch}\n\nREVIEW FINDINGS:\n${JSON.stringify(parsed.findings, null, 2)}\n\nPlease fix the reported defects and output ONLY the complete corrected TypeScript code.`,
        },
      ];
      const repairRes = await callRealLLM({ messages: repairPrompt, temperature: 0.0 });
      oraclePass = task.oracle(repairRes.content);
      repairSuccess = oraclePass;
    } catch {
      repairSuccess = false;
      oraclePass = false;
    }
  }

  return {
    submissionId,
    runId,
    passNumber: pass,
    taskId: task.taskId,
    group,
    modelUsed: llmRes.model,
    provider: llmRes.provider,
    inputTokens: llmRes.usage.promptTokens,
    outputTokens: llmRes.usage.completionTokens,
    latencyMs: llmRes.latencyMs,
    rawResponse: llmRes.content,
    parsedVerdict: parsed.overall_verdict,
    parserFailure: parsed.parserFailure,
    findings: parsed.findings,
    repairAttempted,
    repairSuccess,
    oraclePass,
  };
}

/**
 * Blind Evaluation Phase:
 * Evaluator processes findings by submissionId and taskId WITHOUT referencing the group (CONTROL/EXPERIMENT).
 */
export function performBlindEvaluation(submissions: SubmissionRecord[]): BlindEvaluationRecord[] {
  const evalRecords: BlindEvaluationRecord[] = [];

  for (const sub of submissions) {
    const oracle = SEMANTIC_ORACLES[sub.taskId];
    if (!oracle) continue;

    for (let idx = 0; idx < sub.findings.length; idx++) {
      const f = sub.findings[idx];
      const isTP = oracle.matchesDefect(f.finding, f.rationale, f.recommendation);
      const isFP = !isTP && (f.severity === 'CRITICAL' || f.severity === 'MAJOR');

      evalRecords.push({
        submissionId: sub.submissionId,
        taskId: sub.taskId,
        defectClass: oracle.defectClass,
        findingIndex: idx,
        findingSeverity: f.severity,
        findingText: f.finding,
        findingRationale: f.rationale,
        findingRecommendation: f.recommendation,
        isTruePositive: isTP,
        isFalsePositive: isFP,
        evaluationNote: isTP
          ? `Matched semantic oracle for ${oracle.defectClass}: ${oracle.defectMechanismDescription}`
          : isFP
          ? 'Finding did not describe the seeded fault mechanism'
          : 'Minor or non-critical suggestion',
      });
    }
  }

  return evalRecords;
}

export async function runBenchmarkR2(passes = 5) {
  console.log(`=== STARTING PHASE 2B-R2: ${passes} PASSES ACROSS 10 TASKS ===`);
  const allSubmissions: SubmissionRecord[] = [];

  // Initialize/clean JSONL files
  if (fs.existsSync(RAW_RUNS_PATH)) fs.unlinkSync(RAW_RUNS_PATH);
  if (fs.existsSync(REVIEW_RESULTS_PATH)) fs.unlinkSync(REVIEW_RESULTS_PATH);
  if (fs.existsSync(BLIND_EVAL_PATH)) fs.unlinkSync(BLIND_EVAL_PATH);

  for (let p = 1; p <= passes; p++) {
    console.log(`\n--- PASS ${p}/${passes} ---`);
    // Randomize task execution order
    const taskOrder = [...TASK_SUITE].sort(() => Math.random() - 0.5);

    for (const task of taskOrder) {
      const runId = `r2-pass${p}-${task.taskId}-${Date.now()}`;
      // Randomize whether Control or Experiment runs first
      const runControlFirst = Math.random() > 0.5;

      const firstGroup = runControlFirst ? 'CONTROL' : 'EXPERIMENT';
      const secondGroup = runControlFirst ? 'EXPERIMENT' : 'CONTROL';

      console.log(`[Pass ${p}] [${task.taskId}] Running ${firstGroup}...`);
      const sub1 = await executeReview(task, firstGroup, runId, p);
      allSubmissions.push(sub1);
      fs.appendFileSync(RAW_RUNS_PATH, JSON.stringify(sub1) + '\n');
      console.log(`  -> ${firstGroup} verdict=${sub1.parsedVerdict} findings=${sub1.findings.length}`);

      await new Promise((r) => setTimeout(r, 1200));

      console.log(`[Pass ${p}] [${task.taskId}] Running ${secondGroup}...`);
      const sub2 = await executeReview(task, secondGroup, runId, p);
      allSubmissions.push(sub2);
      fs.appendFileSync(RAW_RUNS_PATH, JSON.stringify(sub2) + '\n');
      console.log(`  -> ${secondGroup} verdict=${sub2.parsedVerdict} findings=${sub2.findings.length}`);

      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Blind Evaluation
  console.log('\n--- EXECUTING BLIND EVALUATION PROTOCOL ---');
  const blindEvaluations = performBlindEvaluation(allSubmissions);
  for (const b of blindEvaluations) {
    fs.appendFileSync(BLIND_EVAL_PATH, JSON.stringify(b) + '\n');
  }

  // Aggregate results by group
  const controlSubs = allSubmissions.filter((s) => s.group === 'CONTROL');
  const expSubs = allSubmissions.filter((s) => s.group === 'EXPERIMENT');

  const calcGroupMetrics = (subs: SubmissionRecord[]) => {
    let tpCount = 0;
    let fpCount = 0;
    let fnCount = 0;
    let totalInTokens = 0;
    let totalOutTokens = 0;
    let totalLatency = 0;
    let repairAttempts = 0;
    let oraclePassCount = 0;

    for (const sub of subs) {
      totalInTokens += sub.inputTokens;
      totalOutTokens += sub.outputTokens;
      totalLatency += sub.latencyMs;
      if (sub.repairAttempted) repairAttempts++;
      if (sub.oraclePass) oraclePassCount++;

      const subEvals = blindEvaluations.filter((b) => b.submissionId === sub.submissionId);
      const hasTP = subEvals.some((b) => b.isTruePositive);
      const subFPs = subEvals.filter((b) => b.isFalsePositive).length;

      if (hasTP) {
        tpCount++;
      } else {
        fnCount++;
      }
      fpCount += subFPs;
    }

    const n = subs.length || 1;
    return {
      n,
      tpCount,
      fpCount,
      fnCount,
      detectionRate: Math.round((tpCount / n) * 1000) / 10,
      precision: tpCount + fpCount > 0 ? Math.round((tpCount / (tpCount + fpCount)) * 1000) / 10 : 100.0,
      avgInTokens: Math.round(totalInTokens / n),
      avgOutTokens: Math.round(totalOutTokens / n),
      avgLatencyMs: Math.round(totalLatency / n),
      repairAttempts,
      oraclePassCount,
      oraclePassRate: Math.round((oraclePassCount / n) * 1000) / 10,
    };
  };

  const controlStats = calcGroupMetrics(controlSubs);
  const expStats = calcGroupMetrics(expSubs);

  const reportData = {
    control: controlStats,
    experiment: expStats,
    allSubmissions,
    blindEvaluations,
  };

  fs.writeFileSync(REVIEW_RESULTS_PATH, JSON.stringify(reportData, null, 2));

  console.log('\n=============================================');
  console.log('PHASE 2B-R2 COMPREHENSIVE BENCHMARK COMPLETE:');
  console.log('CONTROL METRICS:   ', controlStats);
  console.log('EXPERIMENT METRICS:', expStats);
  console.log('=============================================\n');

  return reportData;
}

// Execution
const res = await runBenchmarkR2(3); // 3 full passes = 30 Control + 30 Experiment = 60 complete inferences
console.log('BENCHMARK_R2_FINISHED_SUCCESS');
