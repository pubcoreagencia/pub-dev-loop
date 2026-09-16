import { TASK_SUITE } from '../poc-fresh-context-review/tasks/task-suite.js';
import { runControlSelfReview, runExperimentFreshReview } from './real-runners.js';
import { RealRunRecord } from './review-evaluator.js';

export interface AggregateMetrics {
  totalTasks: number;
  totalRuns: number;
  modelIdentifier: string;
  provider: string;
  control: {
    runsCount: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    detectionRate: number;
    falsePositiveRate: number;
    avgInputTokens: number;
    avgOutputTokens: number;
    avgLatencyMs: number;
    repairAttempted: number;
    repairSuccess: number;
    oraclePassRate: number;
    parserFailures: number;
  };
  experiment: {
    runsCount: number;
    truePositives: number;
    falsePositives: number;
    falseNegatives: number;
    detectionRate: number;
    falsePositiveRate: number;
    avgInputTokens: number;
    avgOutputTokens: number;
    avgLatencyMs: number;
    repairAttempted: number;
    repairSuccess: number;
    oraclePassRate: number;
    parserFailures: number;
  };
  comparative: {
    relativeDetectionDelta: number;
    inputTokenReductionDelta: number;
    latencyDeltaMs: number;
    oraclePassDelta: number;
  };
}

async function main() {
  console.log('--- STARTING PHASE 2B-R REAL LLM BENCHMARK ---');
  const runs: RealRunRecord[] = [];
  const passes = 1; // 1 complete pass across all 10 tasks = 10 control runs + 10 experiment runs = 20 real LLM inferences

  for (let p = 1; p <= passes; p++) {
    console.log(`\nExecuting Pass ${p}/${passes}...`);
    // Randomize tasks order to prevent sequence bias
    const shuffled = [...TASK_SUITE].sort(() => Math.random() - 0.5);

    for (const task of shuffled) {
      const runId = `pass${p}-${task.taskId}-${Date.now()}`;
      // Randomize whether Control or Experiment runs first
      const runControlFirst = Math.random() > 0.5;

      if (runControlFirst) {
        console.log(`[${task.taskId}] Running Control (Self-Review)...`);
        try {
          const res = await runControlSelfReview(task, `${runId}-ctrl`);
          runs.push(res);
          console.log(`  -> Control result: TP=${res.truePositives}, FP=${res.falsePositives}, Verdict=${res.verdict}`);
        } catch (err: any) {
          console.error(`  -> Control failed: ${err.message}`);
        }

        // Slight rate-limit buffer
        await new Promise((r) => setTimeout(r, 1200));

        console.log(`[${task.taskId}] Running Experiment (Fresh-Context Review)...`);
        try {
          const res = await runExperimentFreshReview(task, `${runId}-exp`);
          runs.push(res);
          console.log(`  -> Experiment result: TP=${res.truePositives}, FP=${res.falsePositives}, Verdict=${res.verdict}`);
        } catch (err: any) {
          console.error(`  -> Experiment failed: ${err.message}`);
        }
      } else {
        console.log(`[${task.taskId}] Running Experiment (Fresh-Context Review)...`);
        try {
          const res = await runExperimentFreshReview(task, `${runId}-exp`);
          runs.push(res);
          console.log(`  -> Experiment result: TP=${res.truePositives}, FP=${res.falsePositives}, Verdict=${res.verdict}`);
        } catch (err: any) {
          console.error(`  -> Experiment failed: ${err.message}`);
        }

        await new Promise((r) => setTimeout(r, 1200));

        console.log(`[${task.taskId}] Running Control (Self-Review)...`);
        try {
          const res = await runControlSelfReview(task, `${runId}-ctrl`);
          runs.push(res);
          console.log(`  -> Control result: TP=${res.truePositives}, FP=${res.falsePositives}, Verdict=${res.verdict}`);
        } catch (err: any) {
          console.error(`  -> Control failed: ${err.message}`);
        }
      }

      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  // Compile Aggregates
  const controlRuns = runs.filter((r) => r.group === 'CONTROL_SELF_REVIEW');
  const expRuns = runs.filter((r) => r.group === 'EXPERIMENT_FRESH_REVIEW');

  const ctrlTP = controlRuns.reduce((sum, r) => sum + r.truePositives, 0);
  const ctrlFP = controlRuns.reduce((sum, r) => sum + r.falsePositives, 0);
  const ctrlFN = controlRuns.reduce((sum, r) => sum + r.falseNegatives, 0);
  const ctrlPass = controlRuns.reduce((sum, r) => sum + (r.oraclePass ? 1 : 0), 0);
  const ctrlRep = controlRuns.reduce((sum, r) => sum + (r.repairAttempted ? 1 : 0), 0);

  const expTP = expRuns.reduce((sum, r) => sum + r.truePositives, 0);
  const expFP = expRuns.reduce((sum, r) => sum + r.falsePositives, 0);
  const expFN = expRuns.reduce((sum, r) => sum + r.falseNegatives, 0);
  const expPass = expRuns.reduce((sum, r) => sum + (r.oraclePass ? 1 : 0), 0);
  const expRep = expRuns.reduce((sum, r) => sum + (r.repairAttempted ? 1 : 0), 0);

  const ctrlAvgIn = Math.round(controlRuns.reduce((sum, r) => sum + r.inputTokens, 0) / (controlRuns.length || 1));
  const ctrlAvgOut = Math.round(controlRuns.reduce((sum, r) => sum + r.outputTokens, 0) / (controlRuns.length || 1));
  const ctrlAvgLat = Math.round(controlRuns.reduce((sum, r) => sum + r.latencyMs, 0) / (controlRuns.length || 1));

  const expAvgIn = Math.round(expRuns.reduce((sum, r) => sum + r.inputTokens, 0) / (expRuns.length || 1));
  const expAvgOut = Math.round(expRuns.reduce((sum, r) => sum + r.outputTokens, 0) / (expRuns.length || 1));
  const expAvgLat = Math.round(expRuns.reduce((sum, r) => sum + r.latencyMs, 0) / (expRuns.length || 1));

  const ctrlDetRate = Math.round((ctrlTP / (controlRuns.length || 1)) * 1000) / 10;
  const expDetRate = Math.round((expTP / (expRuns.length || 1)) * 1000) / 10;

  const summary: AggregateMetrics = {
    totalTasks: TASK_SUITE.length,
    totalRuns: runs.length,
    modelIdentifier: runs[0]?.modelUsed || 'openrouter/free',
    provider: runs[0]?.provider || 'openrouter',
    control: {
      runsCount: controlRuns.length,
      truePositives: ctrlTP,
      falsePositives: ctrlFP,
      falseNegatives: ctrlFN,
      detectionRate: ctrlDetRate,
      falsePositiveRate: Math.round((ctrlFP / ((ctrlTP + ctrlFP) || 1)) * 1000) / 10,
      avgInputTokens: ctrlAvgIn,
      avgOutputTokens: ctrlAvgOut,
      avgLatencyMs: ctrlAvgLat,
      repairAttempted: ctrlRep,
      repairSuccess: ctrlPass,
      oraclePassRate: Math.round((ctrlPass / (controlRuns.length || 1)) * 1000) / 10,
      parserFailures: controlRuns.filter((r) => r.parserFailure).length,
    },
    experiment: {
      runsCount: expRuns.length,
      truePositives: expTP,
      falsePositives: expFP,
      falseNegatives: expFN,
      detectionRate: expDetRate,
      falsePositiveRate: Math.round((expFP / ((expTP + expFP) || 1)) * 1000) / 10,
      avgInputTokens: expAvgIn,
      avgOutputTokens: expAvgOut,
      avgLatencyMs: expAvgLat,
      repairAttempted: expRep,
      repairSuccess: expPass,
      oraclePassRate: Math.round((expPass / (expRuns.length || 1)) * 1000) / 10,
      parserFailures: expRuns.filter((r) => r.parserFailure).length,
    },
    comparative: {
      relativeDetectionDelta: Math.round((expDetRate - ctrlDetRate) * 10) / 10,
      inputTokenReductionDelta: Math.round(((ctrlAvgIn - expAvgIn) / (ctrlAvgIn || 1)) * 1000) / 10,
      latencyDeltaMs: expAvgLat - ctrlAvgLat,
      oraclePassDelta: Math.round(((expPass - ctrlPass) / (controlRuns.length || 1)) * 1000) / 10,
    },
  };

  console.log('\n=============================================');
  console.log('REAL LLM BENCHMARK SUMMARY RESULTS:');
  console.log(JSON.stringify(summary, null, 2));
  console.log('=============================================\n');

  return { summary, rawRuns: runs };
}

// Direct execution
const res = await main();
console.log('EXECUTION_COMPLETE_DATA_POINT');
