import * as fs from 'fs';
import * as path from 'path';
import { SECURITY_TASK_SUITE, SecurityTaskDef } from './tasks/security-task-suite.js';
import { callRealLLM } from '../poc-fresh-context-review-real/real-llm-client.js';
import { extractStructuredReview, StructuredFinding } from '../poc-fresh-context-review-real/review-evaluator.js';
import { SECURITY_SEMANTIC_ORACLES } from './security-semantic-oracles.js';

const OUT_DIR = import.meta.dirname;
const RAW_RUNS_PATH = path.join(OUT_DIR, 'raw-security-runs.jsonl');
const REVIEW_RESULTS_PATH = path.join(OUT_DIR, 'security-results.jsonl');
const BLIND_EVAL_PATH = path.join(OUT_DIR, 'blind-security-evaluation-results.jsonl');

interface SecuritySubmission {
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

interface BlindSecurityEvaluation {
  submissionId: string;
  taskId: string;
  vulnerabilityClass: string;
  findingIndex: number;
  findingSeverity: string;
  findingText: string;
  findingRationale: string;
  findingRecommendation: string;
  isTruePositive: boolean;
  isFalsePositive: boolean;
  evaluationNote: string;
}

const SECURITY_CHECKLIST_TEXT = `SECURITY REVIEW CHECKLIST:
1. Input validation: Verify all input parameters are strictly validated and type-constrained.
2. Path/file boundaries: Check for path traversal (../), directory escape, and unauthorized file access.
3. Command/shell safety: Ensure no unsanitized inputs are passed to shell executors or process spawners.
4. Authorization boundaries: Verify multi-tenant checks and ensure user permissions match target resources.
5. Secrets/environment handling: Check for exposed API keys, plaintext credentials, or leaking process.env.
6. Injection resistance: Check for SQL, command, code (eval), or template injection vulnerabilities.
7. Least privilege: Verify sandbox contexts restrict process, network, and host system access.
8. Sandbox escape risk: Check that code executed in virtual machines cannot compromise host process.`;

const OUTPUT_SCHEMA_INSTRUCTION = `Respond ONLY with valid JSON conforming strictly to this structure:
{
  "findings": [
    {
      "severity": "CRITICAL" | "MAJOR" | "MINOR" | "SUGGESTION",
      "location": "file:line",
      "finding": "concise description of security issue",
      "rationale": "why this is a vulnerability or security risk",
      "recommendation": "how to mitigate or fix"
    }
  ],
  "overall_verdict": "PASS" | "CHANGES_REQUESTED"
}`;

const AUTHOR_CONTEXT_TEXT = `AUTHOR CONTEXT (PRIOR SESSION LOG):
Task intake processed at session start. Author reviewed security and operational requirements, drafted initial implementation against specifications, and completed first code pass. No syntax or basic test errors recorded.`;

async function executeSecurityReview(
  task: SecurityTaskDef,
  group: 'CONTROL' | 'EXPERIMENT',
  runId: string,
  pass: number
): Promise<SecuritySubmission> {
  const isControl = group === 'CONTROL';

  const userContent = [
    `TASK SPECIFICATION:\n${task.specification}`,
    `STARTING REPOSITORY CONTEXT:\n${task.startingCode}`,
    `PROPOSED PATCH / GIT DIFF:\n${task.vulnerablePatch}`,
    ...(isControl ? [AUTHOR_CONTEXT_TEXT] : []),
    SECURITY_CHECKLIST_TEXT,
    'Review the implementation against the security requirements and identify vulnerabilities.',
    OUTPUT_SCHEMA_INSTRUCTION,
  ].join('\n\n');

  const messages = [
    {
      role: 'system' as const,
      content: 'You are a software engineer performing a security code review before submission.',
    },
    {
      role: 'user' as const,
      content: userContent,
    },
  ];

  const submissionId = `sec-${group.toLowerCase()}-${task.taskId}-p${pass}-${Date.now()}`;
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

  // Attempt repair if findings exist
  let repairAttempted = false;
  let repairSuccess = false;
  let oraclePass = false;

  const hasCritOrMajor = parsed.findings.some(
    (f: StructuredFinding) => f.severity === 'CRITICAL' || f.severity === 'MAJOR'
  );

  if (hasCritOrMajor && parsed.findings.length > 0) {
    repairAttempted = true;
    try {
      const repairMessages = [
        {
          role: 'system' as const,
          content: 'You are an engineer fixing security vulnerabilities identified in code review.',
        },
        {
          role: 'user' as const,
          content: `SPECIFICATION:\n${task.specification}\n\nVULNERABLE PATCH:\n${task.vulnerablePatch}\n\nSECURITY FINDINGS:\n${JSON.stringify(parsed.findings, null, 2)}\n\nPlease fix the reported vulnerabilities and output ONLY the complete secure TypeScript code for the file.`,
        },
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
    timestamp,
  };
}

export function performBlindSecurityEvaluation(submissions: SecuritySubmission[]): BlindSecurityEvaluation[] {
  const evals: BlindSecurityEvaluation[] = [];

  for (const sub of submissions) {
    const oracle = SECURITY_SEMANTIC_ORACLES[sub.taskId];
    if (!oracle) continue;

    for (let idx = 0; idx < sub.findings.length; idx++) {
      const f = sub.findings[idx];
      const isTP = oracle.matchesVulnerability(f.finding, f.rationale, f.recommendation);
      const isFP = !isTP && (f.severity === 'CRITICAL' || f.severity === 'MAJOR');

      evals.push({
        submissionId: sub.submissionId,
        taskId: sub.taskId,
        vulnerabilityClass: oracle.vulnerabilityClass,
        findingIndex: idx,
        findingSeverity: f.severity,
        findingText: f.finding,
        findingRationale: f.rationale,
        findingRecommendation: f.recommendation,
        isTruePositive: isTP,
        isFalsePositive: isFP,
        evaluationNote: isTP
          ? `Identified vulnerability causal mechanism for ${oracle.vulnerabilityClass}`
          : isFP
          ? 'Finding did not describe the actual seeded vulnerability'
          : 'Non-critical observation',
      });
    }
  }

  return evals;
}

export async function runSecurityBenchmark(passes = 3) {
  console.log(`=== STARTING PHASE 3: SPECIALIZED SECURITY REVIEW BENCHMARK (${passes} PASSES, 10 TASKS) ===`);
  const allSubmissions: SecuritySubmission[] = [];

  if (fs.existsSync(RAW_RUNS_PATH)) fs.unlinkSync(RAW_RUNS_PATH);
  if (fs.existsSync(REVIEW_RESULTS_PATH)) fs.unlinkSync(REVIEW_RESULTS_PATH);
  if (fs.existsSync(BLIND_EVAL_PATH)) fs.unlinkSync(BLIND_EVAL_PATH);

  for (let p = 1; p <= passes; p++) {
    console.log(`\n--- PASS ${p}/${passes} ---`);
    const taskOrder = [...SECURITY_TASK_SUITE].sort(() => Math.random() - 0.5);

    for (const task of taskOrder) {
      const runId = `sec-p${p}-${task.taskId}-${Date.now()}`;
      const runControlFirst = Math.random() > 0.5;

      const firstGroup = runControlFirst ? 'CONTROL' : 'EXPERIMENT';
      const secondGroup = runControlFirst ? 'EXPERIMENT' : 'CONTROL';

      console.log(`[Pass ${p}] [${task.taskId}] Running ${firstGroup}...`);
      const sub1 = await executeSecurityReview(task, firstGroup, runId, p);
      allSubmissions.push(sub1);
      fs.appendFileSync(RAW_RUNS_PATH, JSON.stringify(sub1) + '\n');
      console.log(`  -> ${firstGroup} verdict=${sub1.parsedVerdict} findings=${sub1.findings.length}`);

      await new Promise((r) => setTimeout(r, 1200));

      console.log(`[Pass ${p}] [${task.taskId}] Running ${secondGroup}...`);
      const sub2 = await executeSecurityReview(task, secondGroup, runId, p);
      allSubmissions.push(sub2);
      fs.appendFileSync(RAW_RUNS_PATH, JSON.stringify(sub2) + '\n');
      console.log(`  -> ${secondGroup} verdict=${sub2.parsedVerdict} findings=${sub2.findings.length}`);

      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  console.log('\n--- EXECUTING BLIND SECURITY EVALUATION ---');
  const blindEvaluations = performBlindSecurityEvaluation(allSubmissions);
  for (const b of blindEvaluations) {
    fs.appendFileSync(BLIND_EVAL_PATH, JSON.stringify(b) + '\n');
  }

  const controlSubs = allSubmissions.filter((s) => s.group === 'CONTROL');
  const expSubs = allSubmissions.filter((s) => s.group === 'EXPERIMENT');

  const calcMetrics = (subs: SecuritySubmission[]) => {
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

  const controlStats = calcMetrics(controlSubs);
  const expStats = calcMetrics(expSubs);

  const reportData = {
    control: controlStats,
    experiment: expStats,
    allSubmissions,
    blindEvaluations,
  };

  fs.writeFileSync(REVIEW_RESULTS_PATH, JSON.stringify(reportData, null, 2));

  console.log('\n=============================================');
  console.log('SPECIALIZED SECURITY REVIEW BENCHMARK COMPLETE:');
  console.log('CONTROL METRICS:   ', controlStats);
  console.log('EXPERIMENT METRICS:', expStats);
  console.log('=============================================\n');

  return reportData;
}

// Direct execution (3 passes = 30 Control + 30 Experiment = 60 complete security review cycles)
const res = await runSecurityBenchmark(3);
console.log('SECURITY_BENCHMARK_COMPLETE_SIGNAL');
