import { Pool } from 'pg';
import { DEFAULT_FAIL_CLOSED_LIMITS } from '../dist/pdl/governance/types.js';
import { PdlGovernanceEngine } from '../dist/pdl/governance/policy-engine.js';

const PG_URL = process.env.DATABASE_URL || 'postgres://pubdevloop:pubdevloop@localhost:5432/pubdevloop';

async function main() {
  const pool = new Pool({ connectionString: PG_URL });
  const governance = new PdlGovernanceEngine({ pool });

  try {
    await governance.updateLimits(
      {
        activeLevel: DEFAULT_FAIL_CLOSED_LIMITS.activeLevel,
        killSwitchActive: DEFAULT_FAIL_CLOSED_LIMITS.killSwitchActive,
        maxConsecutiveTasks: DEFAULT_FAIL_CLOSED_LIMITS.maxConsecutiveTasks,
        maxTaskDurationMs: DEFAULT_FAIL_CLOSED_LIMITS.maxTaskDurationMs,
        maxToolRoundsPerTask: DEFAULT_FAIL_CLOSED_LIMITS.maxToolRoundsPerTask,
        maxCorrectionAttempts: DEFAULT_FAIL_CLOSED_LIMITS.maxCorrectionAttempts,
        maxConsecutiveFailures: DEFAULT_FAIL_CLOSED_LIMITS.maxConsecutiveFailures,
        allowedProducts: DEFAULT_FAIL_CLOSED_LIMITS.allowedProducts,
      },
      'governance-reset-command',
      'Restore canonical fail-closed baseline',
    );

    const state = await governance.loadLimits();
    console.log('GOVERNANCE RESET');
    console.log('================');
    console.log(JSON.stringify(state, null, 2));

    const ok =
      state.activeLevel === 0 &&
      state.killSwitchActive === true &&
      state.maxConsecutiveTasks === 1 &&
      state.maxConsecutiveFailures === 1 &&
      state.maxCorrectionAttempts === 2;

    if (!ok) {
      throw new Error('FAIL: canonical governance baseline was not established');
    }

    console.log('Governance canonical baseline: PASS');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('GOVERNANCE RESET: FAIL');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
