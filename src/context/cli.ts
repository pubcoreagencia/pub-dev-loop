#!/usr/bin/env node
/**
 * CLI: validate operational context before task execution.
 *
 * Usage:
 *   npx tsx src/context/agent-context.ts --validate
 *   npx tsx src/context/agent-context.ts --summary
 *   npx tsx src/context/agent-context.ts --git-state
 *
 * Exit codes:
 *   0 — context is valid, git state consistent
 *   1 — context missing/incomplete, or git divergence detected
 */

import { AgentContext } from '../context/agent-context.js';

const args = process.argv.slice(2);

async function main() {
  const mode = args[0] ?? '--validate';

  if (mode === '--validate' || mode === '--summary' || mode === '--git-state' || mode === '--help') {
    try {
      const ctx = await AgentContext.load();
      const git = AgentContext.getGitState();

      if (mode === '--validate') {
        AgentContext.validateGit();
        console.log('✅ Context valid. Git state consistent.');
        console.log(`   Branch: ${git.branch}`);
        console.log(`   HEAD:   ${git.localHead}`);
        if (git.remoteHead) {
          console.log(`   Remote: ${git.remoteHead}`);
        }
      } else if (mode === '--summary') {
        const s = ctx.getSummary();
        console.log('=== Operational Context Summary ===');
        console.log(`Current Task:      ${s.currentTask ?? 'N/A'}`);
        console.log(`Next Task:         ${s.nextTask ?? 'N/A'}`);
        console.log(`Last Completed:    ${s.lastCompletedTask ?? 'N/A'}`);
        console.log(`Limitations:       ${s.limitations.length}`);
        console.log(`Context Dir:       ${s.agentDir}`);
      } else if (mode === '--git-state') {
        console.log('=== Git State ===');
        console.log(`  Branch:    ${git.branch}`);
        console.log(`  Local:     ${git.localHead}`);
        console.log(`  Remote:    ${git.remoteHead ?? '(none)'}`);
        console.log(`  Synced:    ${git.synced ? 'YES' : 'NO'}`);
        console.log(`  Worktree:  ${git.worktree ? git.worktree : '(clean)'}`);
      } else {
        console.log('Usage: agent-context.ts [--validate|--summary|--git-state]');
      }
    } catch (e: any) {
      console.error('❌ ' + e.message);
      process.exit(1);
    }
  } else {
    console.error('Unknown mode: ' + mode);
    console.error('Usage: agent-context.ts [--validate|--summary|--git-state]');
    process.exit(1);
  }
}

main();
