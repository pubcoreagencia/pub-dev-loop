import * as fs from 'fs';
import * as path from 'path';
import { PLANNING_TASK_SUITE, PlanningTaskDef, TaskTier } from './tasks/planning-task-suite.js';
import { callRealLLM, LLMResponse } from '../poc-fresh-context-review-real/real-llm-client.js';
import { validatePlan, StructuredPlan, PlanValidationResult } from './plan-validator.js';

const OUT_DIR = import.meta.dirname;
const RAW_RUNS_PATH = path.join(OUT_DIR, 'raw-runs.jsonl');
const PLANS_PATH = path.join(OUT_DIR, 'plans.jsonl');

export interface ExecutionRecord {
  run_id: string;
  task_id: string;
  tier: TaskTier;
  group: 'CONTROL' | 'EXPERIMENT';
  pass_number: number;
  model: string;
  provider: string;
  gateway: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  model_calls: number;
  plan_generated: boolean;
  plan_valid: boolean;
  plan_revision_count: number;
  files_changed: number;
  edit_iterations: number;
  correction_cycles: number;
  revert_count: number;
  test_failures: number;
  oracle_pass: boolean;
  final_regressions: number;
  financial_cost: number;
  reasons: string[];
  timestamp: string;
}

function extractJsonBlock(text: string): any {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch {}
  }
  try {
    return JSON.parse(text);
  } catch {}
  // Attempt substring from first '{' to last '}'
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.substring(start, end + 1));
    } catch {}
  }
  return null;
}

function extractCodeBlocks(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  const regex = /```(?:typescript|ts|javascript|js)?\s*filepath:\s*([^\r\n]+)\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const filePath = m[1].trim();
    const content = m[2];
    files[filePath] = content;
  }
  if (Object.keys(files).length === 0) {
    // Check fallback pattern: // filepath: ... or comment before code block
    const blockRegex = /```(?:typescript|ts|javascript|js)?\s*\r?\n([\s\S]*?)```/g;
    let b;
    while ((b = blockRegex.exec(text)) !== null) {
      const blockContent = b[1];
      const headerMatch = blockContent.match(/(?:\/\/|\/\*)\s*(?:file|path|filepath):\s*([^\r\n*]+)/i);
      if (headerMatch) {
        const fp = headerMatch[1].trim();
        files[fp] = blockContent;
      }
    }
  }
  return files;
}

function checkRegressions(modifiedFiles: Record<string, string>, task: PlanningTaskDef): number {
  let regressions = 0;
  for (const forbidden of task.forbiddenRegressions) {
    // If a forbidden keyword that was in initialContent is completely removed
    const wasInInitial = task.files.some(f => f.initialContent.includes(forbidden));
    if (wasInInitial) {
      const isStillPresent = Object.values(modifiedFiles).some(c => c.includes(forbidden));
      if (!isStillPresent) {
        regressions++;
      }
    }
  }
  return regressions;
}

async function runTaskExecution(
  task: PlanningTaskDef,
  group: 'CONTROL' | 'EXPERIMENT',
  pass: number,
  runIndex: number,
  totalRuns: number
): Promise<ExecutionRecord> {
  const run_id = `RUN-${group}-${task.taskId}-P${pass}-${Date.now().toString(36)}`;
  console.log(`[${runIndex}/${totalRuns}] Running ${task.tier} Task ${task.taskId} (Pass ${pass}) [Group: ${group}]...`);

  let input_tokens = 0;
  let output_tokens = 0;
  let latency_ms = 0;
  let model_calls = 0;
  let plan_generated = false;
  let plan_valid = false;
  let plan_revision_count = 0;
  let edit_iterations = 1;
  let correction_cycles = 0;
  let revert_count = 0;
  let test_failures = 0;

  const initialFilesMap: Record<string, string> = {};
  for (const f of task.files) {
    initialFilesMap[f.path] = f.initialContent;
  }

  const initialFilesListing = task.files
    .map(f => `FILE: ${f.path}\n\`\`\`typescript\n${f.initialContent}\n\`\`\``)
    .join('\n\n');

  let activePlanText = '';
  let modelName = 'nvidia/nemotron-3-super-120b-a12b:free';
  let providerName = 'nvidia';

  // PHASE 1: PLANNING (Only for EXPERIMENT)
  if (group === 'EXPERIMENT') {
    model_calls++;
    const planPrompt = `You are a software architect preparing a task execution plan.
TASK TITLE: ${task.title}
TIER: ${task.tier}
SPECIFICATION:
${task.specification}

CURRENT REPOSITORY FILES:
${initialFilesListing}

INSTRUCTIONS:
Produce a structured JSON plan before any code implementation.
Conform strictly to this JSON format:
{
  "goal": "<concise description of what will be achieved>",
  "files_to_change": ["<path of file to modify or create>"],
  "dependencies": ["<dependencies or imports involved>"],
  "implementation_steps": ["<step 1>", "<step 2>"],
  "test_strategy": ["<test criteria or validation check>"],
  "risk_points": ["<potential failure or regression risk>"],
  "rollback_considerations": ["<rollback actions if broken>"]
}

Respond ONLY with valid JSON.`;

    try {
      const planRes = await callRealLLM({
        messages: [{ role: 'user', content: planPrompt }],
        temperature: 0.1
      });
      input_tokens += planRes.usage.promptTokens;
      output_tokens += planRes.usage.completionTokens;
      latency_ms += planRes.latencyMs;
      modelName = planRes.model;
      providerName = planRes.provider;

      const parsedPlan = extractJsonBlock(planRes.content);
      plan_generated = parsedPlan !== null;
      const valResult = validatePlan(parsedPlan);
      plan_valid = valResult.valid;
      activePlanText = JSON.stringify(parsedPlan, null, 2);

      // Save plan artifact
      fs.appendFileSync(PLANS_PATH, JSON.stringify({
        run_id,
        task_id: task.taskId,
        pass,
        plan: parsedPlan,
        valid: plan_valid,
        reasons: valResult.reasons
      }) + '\n');

      if (!plan_valid) {
        // One revision attempt if plan failed structural validation
        plan_revision_count++;
        model_calls++;
        const revisePrompt = `Your previous plan had validation errors: ${valResult.reasons.join(', ')}.
Please provide a valid JSON plan with non-empty goal, files_to_change, test_strategy, and risk_points.`;
        const reviseRes = await callRealLLM({
          messages: [
            { role: 'user', content: planPrompt },
            { role: 'assistant', content: planRes.content },
            { role: 'user', content: revisePrompt }
          ],
          temperature: 0.1
        });
        input_tokens += reviseRes.usage.promptTokens;
        output_tokens += reviseRes.usage.completionTokens;
        latency_ms += reviseRes.latencyMs;
        const revisedPlan = extractJsonBlock(reviseRes.content);
        if (revisedPlan) {
          const revVal = validatePlan(revisedPlan);
          plan_valid = revVal.valid;
          activePlanText = JSON.stringify(revisedPlan, null, 2);
        }
      }
    } catch (err: any) {
      console.error(`Planning error for ${task.taskId}:`, err.message);
    }
  }

  // PHASE 2: IMPLEMENTATION
  let currentModifiedFiles: Record<string, string> = { ...initialFilesMap };
  model_calls++;

  const implSystemPrompt = group === 'EXPERIMENT'
    ? `You are an expert engineer. Implement the solution strictly following the validated plan below.
For EVERY modified or created file, output a markdown code block formatted EXACTLY as:
\`\`\`typescript filepath: <file-path>
<complete file content>
\`\`\`

VALIDATED PLAN:
${activePlanText}`
    : `You are an expert engineer. Implement the requested changes directly.
For EVERY modified or created file, output a markdown code block formatted EXACTLY as:
\`\`\`typescript filepath: <file-path>
<complete file content>
\`\`\``;

  const implUserPrompt = `TASK: ${task.title}
SPECIFICATION:
${task.specification}

REPOSITORY FILES:
${initialFilesListing}

Implement all necessary changes now.`;

  try {
    const implRes = await callRealLLM({
      messages: [
        { role: 'system', content: implSystemPrompt },
        { role: 'user', content: implUserPrompt }
      ],
      temperature: 0.1
    });
    input_tokens += implRes.usage.promptTokens;
    output_tokens += implRes.usage.completionTokens;
    latency_ms += implRes.latencyMs;
    modelName = implRes.model;
    providerName = implRes.provider;

    const extractedFiles = extractCodeBlocks(implRes.content);
    for (const [p, content] of Object.entries(extractedFiles)) {
      currentModifiedFiles[p] = content;
    }
  } catch (err: any) {
    console.error(`Implementation error for ${task.taskId}:`, err.message);
  }

  // PHASE 3: EVALUATION & RETEST
  let oracleRes = task.oracle(currentModifiedFiles);
  let finalRegressions = checkRegressions(currentModifiedFiles, task);

  // If failed oracle, perform 1 correction cycle (rework cycle)
  if (!oracleRes.pass && model_calls < 4) {
    correction_cycles++;
    edit_iterations++;
    test_failures++;
    model_calls++;

    const correctionPrompt = `Your implementation failed acceptance testing with the following errors:
${oracleRes.reasons.join('\n')}

Please fix these defects and provide the updated complete files in:
\`\`\`typescript filepath: <file-path>
<complete file content>
\`\`\``;

    try {
      const fixRes = await callRealLLM({
        messages: [
          { role: 'system', content: implSystemPrompt },
          { role: 'user', content: implUserPrompt },
          { role: 'user', content: correctionPrompt }
        ],
        temperature: 0.1
      });
      input_tokens += fixRes.usage.promptTokens;
      output_tokens += fixRes.usage.completionTokens;
      latency_ms += fixRes.latencyMs;

      const correctedFiles = extractCodeBlocks(fixRes.content);
      for (const [p, content] of Object.entries(correctedFiles)) {
        currentModifiedFiles[p] = content;
      }

      oracleRes = task.oracle(currentModifiedFiles);
      finalRegressions = checkRegressions(currentModifiedFiles, task);
      if (!oracleRes.pass) {
        test_failures++;
      }
    } catch (err: any) {
      console.error(`Correction error for ${task.taskId}:`, err.message);
    }
  }

  // Count files touched
  let files_changed = 0;
  for (const [p, content] of Object.entries(currentModifiedFiles)) {
    if (initialFilesMap[p] !== content) {
      files_changed++;
    }
  }

  const record: ExecutionRecord = {
    run_id,
    task_id: task.taskId,
    tier: task.tier,
    group,
    pass_number: pass,
    model: modelName,
    provider: providerName,
    gateway: 'openrouter',
    input_tokens,
    output_tokens,
    latency_ms,
    model_calls,
    plan_generated,
    plan_valid,
    plan_revision_count,
    files_changed,
    edit_iterations,
    correction_cycles,
    revert_count,
    test_failures,
    oracle_pass: oracleRes.pass,
    final_regressions: finalRegressions,
    financial_cost: 0.0,
    reasons: oracleRes.reasons,
    timestamp: new Date().toISOString(),
  };

  fs.appendFileSync(RAW_RUNS_PATH, JSON.stringify(record) + '\n');
  return record;
}

async function main() {
  console.log('=== STARTING PHASE 4: PLANNING GATE CONTROLLED BENCHMARK ===');
  const tasks = PLANNING_TASK_SUITE;
  const passes = 3;
  const groups: Array<'CONTROL' | 'EXPERIMENT'> = ['CONTROL', 'EXPERIMENT'];

  // Clear previous output files
  if (fs.existsSync(RAW_RUNS_PATH)) fs.unlinkSync(RAW_RUNS_PATH);
  if (fs.existsSync(PLANS_PATH)) fs.unlinkSync(PLANS_PATH);

  // Generate randomized schedule: 15 tasks x 3 passes x 2 groups = 90 runs
  interface ScheduledItem {
    task: PlanningTaskDef;
    group: 'CONTROL' | 'EXPERIMENT';
    pass: number;
  }

  const schedule: ScheduledItem[] = [];
  for (let p = 1; p <= passes; p++) {
    for (const task of tasks) {
      for (const group of groups) {
        schedule.push({ task, group, pass: p });
      }
    }
  }

  // Deterministic Fisher-Yates shuffle with seed to avoid execution order bias
  let seed = 42;
  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  for (let i = schedule.length - 1; i > 0; i--) {
    const j = Math.floor(pseudoRandom() * (i + 1));
    [schedule[i], schedule[j]] = [schedule[j], schedule[i]];
  }

  console.log(`Total planned benchmark runs: ${schedule.length} (30 Simple, 60 Complex)`);

  const results: ExecutionRecord[] = [];
  for (let i = 0; i < schedule.length; i++) {
    const item = schedule[i];
    const rec = await runTaskExecution(item.task, item.group, item.pass, i + 1, schedule.length);
    results.push(rec);
    // 500ms pacing delay between API calls to avoid rate limits
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('=== BENCHMARK EXECUTION COMPLETE ===');
}

main().catch(err => {
  console.error('Fatal benchmark execution failure:', err);
  process.exit(1);
});
