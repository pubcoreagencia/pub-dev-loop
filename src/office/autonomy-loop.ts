import { randomUUID } from 'node:crypto';
import type { Task, TaskRepository } from '../domain.js';
import {
  parseEngineeringTask,
  engineeringTaskToTask,
  type EngineeringTask,
  type RiskLevel,
} from './intent.js';
import { resolveContext, type ResolvedContext } from './context-resolver.js';

export type CapabilityStatus = 'ABSENT' | 'PARTIAL' | 'VERIFIED' | 'BLOCKED';

export interface CapabilityDefinition {
  id: string;
  name: string;
  category: 'FOUNDATION' | 'CONTEXT' | 'RESEARCH' | 'REASONING' | 'EXECUTION' | 'VERIFICATION' | 'FEEDBACK';
  status: CapabilityStatus;
  dependencies: string[]; // IDs of capabilities that must be VERIFIED before this capability
  evidence?: string;
}

export interface Mission {
  id: string;
  title: string;
  objective: string;
  project: string;
  targetCapabilities: string[]; // Capability IDs that the mission requires to be VERIFIED
  constraints: string[];
  riskPolicy: 'STRICT' | 'STANDARD' | 'AUTONOMOUS';
  maxCycles: number;
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'BLOCKED';
  createdAt: string;
  completedAt?: string;
}

export interface SystemCurrentState {
  missionId: string;
  project: string;
  capabilities: Record<string, CapabilityDefinition>;
  evaluatedAt: string;
}

export interface EngineeringGap {
  id: string;
  capabilityId: string;
  currentStatus: CapabilityStatus;
  targetStatus: 'VERIFIED';
  blockedBy: string[]; // Unsatisfied dependency capability IDs
  isActionable: boolean; // True when all dependencies are VERIFIED
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rationale: string;
}

export interface NextBestAction {
  id: string;
  title: string;
  description: string;
  actionType: 'IMPLEMENT_CAPABILITY' | 'VERIFY_CAPABILITY' | 'UNBLOCK_DEPENDENCY' | 'COMPLETE_MISSION' | 'BLOCKED_REVIEW';
  targetCapabilityId?: string;
  targetGapId?: string;
  priority: number;
  estimatedRisk: RiskLevel;
  rationale: string;
  suggestedPrompt: string;
}

export interface AutonomyCycleRecord {
  cycleId: string;
  missionId: string;
  cycleNumber: number;
  currentState: Record<string, CapabilityStatus>;
  identifiedGaps: EngineeringGap[];
  selectedAction: NextBestAction;
  generatedTaskId?: string;
  generatedTask?: EngineeringTask;
  timestamp: string;
}

export interface AutonomyStepResult {
  cycle: AutonomyCycleRecord;
  task?: Task;
  nextState: SystemCurrentState;
  missionStatus: Mission['status'];
}

/**
 * Standard baseline capabilities that model the PDL autonomous engineering ladder.
 */
export const DEFAULT_PDL_CAPABILITIES: Record<string, CapabilityDefinition> = {
  intent_foundation: {
    id: 'intent_foundation',
    name: 'Intent Understanding & EngineeringTask',
    category: 'FOUNDATION',
    status: 'VERIFIED',
    dependencies: [],
    evidence: 'Phase 0 completed and verified',
  },
  context_resolution: {
    id: 'context_resolution',
    name: 'Context Resolution & Real Git Inspection',
    category: 'CONTEXT',
    status: 'VERIFIED',
    dependencies: ['intent_foundation'],
    evidence: 'Phase 1 & 1.1 verified with real git state and evidence snippets',
  },
  research_engine: {
    id: 'research_engine',
    name: 'Autonomous Research & Codebase Navigation',
    category: 'RESEARCH',
    status: 'ABSENT',
    dependencies: ['context_resolution'],
  },
  skill_discovery: {
    id: 'skill_discovery',
    name: 'Dynamic Skill Matching & Selection',
    category: 'REASONING',
    status: 'ABSENT',
    dependencies: ['context_resolution'],
  },
  auto_fix_loop: {
    id: 'auto_fix_loop',
    name: 'Failure Analysis & Automated Test Auto-Fix',
    category: 'FEEDBACK',
    status: 'ABSENT',
    dependencies: ['context_resolution', 'research_engine'],
  },
  autonomous_mission_loop: {
    id: 'autonomous_mission_loop',
    name: 'Continuous Mission Evaluation & Next Best Action Loop',
    category: 'EXECUTION',
    status: 'PARTIAL',
    dependencies: ['intent_foundation', 'context_resolution'],
  },
  verified_learning: {
    id: 'verified_learning',
    name: 'Validated Institutional Lessons & Organizational Memory',
    category: 'FEEDBACK',
    status: 'PARTIAL',
    dependencies: ['auto_fix_loop'],
  },
};

/**
 * Initializes a new SystemCurrentState for a given mission.
 */
export function createInitialSystemState(
  mission: Mission,
  initialCapabilities: Record<string, CapabilityDefinition> = DEFAULT_PDL_CAPABILITIES
): SystemCurrentState {
  const capabilitiesCopy: Record<string, CapabilityDefinition> = {};
  for (const [key, cap] of Object.entries(initialCapabilities)) {
    capabilitiesCopy[key] = { ...cap, dependencies: [...cap.dependencies] };
  }

  return {
    missionId: mission.id,
    project: mission.project,
    capabilities: capabilitiesCopy,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Analyzes gaps between current system state and target capabilities required by the mission.
 * Deterministically checks dependencies to identify blocked vs actionable items.
 */
export function analyzeGaps(mission: Mission, state: SystemCurrentState): EngineeringGap[] {
  const gaps: EngineeringGap[] = [];

  for (const targetId of mission.targetCapabilities) {
    const capability = state.capabilities[targetId];
    if (!capability) {
      gaps.push({
        id: `gap-${targetId}-${Date.now()}`,
        capabilityId: targetId,
        currentStatus: 'ABSENT',
        targetStatus: 'VERIFIED',
        blockedBy: [],
        isActionable: true,
        severity: 'HIGH',
        rationale: `Target capability '${targetId}' is not yet registered in system capabilities.`,
      });
      continue;
    }

    if (capability.status !== 'VERIFIED') {
      // Check which dependencies are not yet verified
      const unsatisfiedDeps = capability.dependencies.filter((depId) => {
        const dep = state.capabilities[depId];
        return !dep || dep.status !== 'VERIFIED';
      });

      const isActionable = unsatisfiedDeps.length === 0;
      let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

      if (capability.category === 'FOUNDATION' || capability.category === 'CONTEXT') {
        severity = 'CRITICAL';
      } else if (capability.category === 'RESEARCH' || capability.category === 'FEEDBACK') {
        severity = 'HIGH';
      }

      const rationale = isActionable
        ? `Capability '${capability.name}' is ${capability.status} and all dependencies [${capability.dependencies.join(', ') || 'none'}] are verified. Ready for action.`
        : `Capability '${capability.name}' is blocked by unverified dependencies: [${unsatisfiedDeps.join(', ')}].`;

      gaps.push({
        id: `gap-${capability.id}`,
        capabilityId: capability.id,
        currentStatus: capability.status,
        targetStatus: 'VERIFIED',
        blockedBy: unsatisfiedDeps,
        isActionable,
        severity,
        rationale,
      });
    }
  }

  return gaps;
}

/**
 * Computes how many unverified capabilities in the state depend directly or indirectly on a given capability.
 * This represents the "Unblocking Leverage" of a candidate capability.
 */
function calculateUnblockingLeverage(capabilityId: string, state: SystemCurrentState): number {
  let count = 0;
  for (const cap of Object.values(state.capabilities)) {
    if (cap.status !== 'VERIFIED' && cap.id !== capabilityId) {
      if (cap.dependencies.includes(capabilityId)) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * Deterministically selects the Next Best Action based on:
 * GAPS + DEPENDENCY GRAPH + UNBLOCKING LEVERAGE + SEVERITY + RISK.
 *
 * Invariant: NEVER hardcodes static roadmap rules (e.g. "if research missing return phase 2").
 */
export function selectNextBestAction(
  mission: Mission,
  gaps: EngineeringGap[],
  state: SystemCurrentState
): NextBestAction {
  // 1. If no gaps exist, mission target capabilities are satisfied!
  if (gaps.length === 0) {
    return {
      id: `act-complete-${Date.now()}`,
      title: `Complete Mission: ${mission.title}`,
      description: `All target capabilities for mission '${mission.title}' are VERIFIED. Mission goal reached.`,
      actionType: 'COMPLETE_MISSION',
      priority: 1,
      estimatedRisk: 'LOW',
      rationale: 'Zero remaining capability gaps detected against mission target capabilities.',
      suggestedPrompt: `Finalize and report successful completion of mission: ${mission.title}`,
    };
  }

  // 2. Identify actionable gaps (all dependencies satisfied)
  const actionableGaps = gaps.filter((g) => g.isActionable);

  // 3. If no gaps are actionable, the system is blocked by circular or failed dependencies
  if (actionableGaps.length === 0) {
    const blockers = Array.from(new Set(gaps.flatMap((g) => g.blockedBy)));
    return {
      id: `act-blocked-${Date.now()}`,
      title: 'Resolve Capability Dependency Impasse',
      description: `All remaining gaps are currently blocked by unverified dependencies: ${blockers.join(', ')}.`,
      actionType: 'BLOCKED_REVIEW',
      priority: 3,
      estimatedRisk: 'HIGH',
      rationale: 'Deadlock detected: remaining capabilities cannot proceed without unblocking prerequisites.',
      suggestedPrompt: `Investigate and resolve dependency blocker for: ${blockers.join(', ')}`,
    };
  }

  // 4. Rank actionable gaps dynamically:
  // Score = (Unblocking Leverage * 10) + Severity Weight + (10 if PARTIAL else 5)
  const ranked = actionableGaps.map((gap) => {
    const cap = state.capabilities[gap.capabilityId];
    const leverage = calculateUnblockingLeverage(gap.capabilityId, state);
    const severityWeight = gap.severity === 'CRITICAL' ? 30 : gap.severity === 'HIGH' ? 20 : gap.severity === 'MEDIUM' ? 10 : 5;
    const progressBonus = gap.currentStatus === 'PARTIAL' ? 15 : 0; // Bias toward completing work already in flight

    const totalScore = (leverage * 25) + severityWeight + progressBonus;

    return {
      gap,
      cap,
      leverage,
      score: totalScore,
    };
  });

  // Sort descending by calculated score
  ranked.sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const capName = best.cap?.name || best.gap.capabilityId;

  const actionType = best.gap.currentStatus === 'PARTIAL' ? 'VERIFY_CAPABILITY' : 'IMPLEMENT_CAPABILITY';
  const risk: RiskLevel = best.gap.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM';

  return {
    id: `act-${best.gap.capabilityId}-${Date.now()}`,
    title: `Advance Capability: ${capName}`,
    description: `Implement and verify capability '${capName}' to address gap '${best.gap.id}'.`,
    actionType,
    targetCapabilityId: best.gap.capabilityId,
    targetGapId: best.gap.id,
    priority: best.score > 40 ? 3 : 2,
    estimatedRisk: risk,
    rationale: `Selected based on dynamic graph resolution: unblocks ${best.leverage} downstream capabilities, severity ${best.gap.severity}, total leverage score ${best.score}.`,
    suggestedPrompt: `Implement and verify ${capName} in project ${mission.project}. Ensure automated verification and test evidence.`,
  };
}

/**
 * Transforms a selected NextBestAction into a canonical EngineeringTask.
 * Integrates directly with the Phase 0 & 1 contract without parallel data structures.
 */
export function generateEngineeringTaskFromAction(
  action: NextBestAction,
  mission: Mission
): EngineeringTask {
  const rawPrompt = `${action.title}: ${action.suggestedPrompt}`;

  const engTask = parseEngineeringTask({
    prompt: rawPrompt,
    project: mission.project,
  });

  // Enrich with mission provenance and explicit rationale
  engTask.known_context.push(`Mission: ${mission.title} (${mission.id})`);
  engTask.known_context.push(`Action Rationale: ${action.rationale}`);
  if (action.targetCapabilityId) {
    engTask.known_context.push(`Target Capability: ${action.targetCapabilityId}`);
  }

  // Inherit constraints from the Mission
  for (const c of mission.constraints) {
    if (!engTask.constraints.includes(c)) {
      engTask.constraints.push(c);
    }
  }

  return engTask;
}

/**
 * Updates a capability status upon task completion or verification and produces a new immutable state.
 */
export function applyStateUpdate(
  state: SystemCurrentState,
  capabilityId: string,
  newStatus: CapabilityStatus,
  evidence?: string
): SystemCurrentState {
  const updatedCapabilities = { ...state.capabilities };
  const existing = updatedCapabilities[capabilityId];

  if (existing) {
    updatedCapabilities[capabilityId] = {
      ...existing,
      status: newStatus,
      evidence: evidence || existing.evidence,
    };
  } else {
    updatedCapabilities[capabilityId] = {
      id: capabilityId,
      name: capabilityId,
      category: 'EXECUTION',
      status: newStatus,
      dependencies: [],
      evidence,
    };
  }

  return {
    missionId: state.missionId,
    project: state.project,
    capabilities: updatedCapabilities,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Executes a single discrete, observable step of the Autonomy Loop:
 * 1. Analyze Gaps against Current State.
 * 2. Select Next Best Action via dynamic dependency ranking.
 * 3. Generate canonical EngineeringTask.
 * 4. Queue task in TaskRepository (if provided).
 * 5. Record cycle audit log.
 */
export async function stepAutonomyLoop(
  mission: Mission,
  state: SystemCurrentState,
  taskRepo?: TaskRepository,
  cycleNumber = 1
): Promise<AutonomyStepResult> {
  // 1. Analyze Gaps
  const gaps = analyzeGaps(mission, state);

  // 2. Select Action
  const action = selectNextBestAction(mission, gaps, state);

  // If mission is completed
  if (action.actionType === 'COMPLETE_MISSION') {
    const cycleRecord: AutonomyCycleRecord = {
      cycleId: `cycle-${Date.now()}-${randomUUID().slice(0, 6)}`,
      missionId: mission.id,
      cycleNumber,
      currentState: Object.fromEntries(
        Object.entries(state.capabilities).map(([k, v]) => [k, v.status])
      ),
      identifiedGaps: gaps,
      selectedAction: action,
      timestamp: new Date().toISOString(),
    };

    mission.status = 'COMPLETED';
    mission.completedAt = new Date().toISOString();

    return {
      cycle: cycleRecord,
      nextState: state,
      missionStatus: 'COMPLETED',
    };
  }

  // 3. Generate EngineeringTask
  const engTask = generateEngineeringTaskFromAction(action, mission);

  // 4. Optionally register task in TaskRepository
  let runtimeTask: Task | undefined;
  if (taskRepo) {
    const resolvedContext: ResolvedContext = resolveContext(engTask);
    const runtimeInput = engineeringTaskToTask(engTask, {}, resolvedContext);
    runtimeTask = await taskRepo.create(runtimeInput);
  }

  // 5. Record Cycle
  const cycleRecord: AutonomyCycleRecord = {
    cycleId: `cycle-${Date.now()}-${randomUUID().slice(0, 6)}`,
    missionId: mission.id,
    cycleNumber,
    currentState: Object.fromEntries(
      Object.entries(state.capabilities).map(([k, v]) => [k, v.status])
    ),
    identifiedGaps: gaps,
    selectedAction: action,
    generatedTaskId: runtimeTask?.id || engTask.id,
    generatedTask: engTask,
    timestamp: new Date().toISOString(),
  };

  return {
    cycle: cycleRecord,
    task: runtimeTask,
    nextState: state,
    missionStatus: mission.status,
  };
}
