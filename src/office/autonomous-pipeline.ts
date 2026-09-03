import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { OfficeAgentRole } from './context-assembly.js';
import { defaultDailySkillEngine } from './skills.js';

export type PipelineStatus =
  | 'PLANNING'
  | 'RUNNING'
  | 'PAUSED'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type StepStatus =
  | 'PENDING'
  | 'WAITING_DEPENDENCY'
  | 'WAITING_APPROVAL'
  | 'READY'
  | 'ASSIGNED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export type CheckpointType =
  | 'SECURITY_AUDIT'
  | 'SCHEMA_MIGRATION'
  | 'ARCHITECTURE_GATE'
  | 'PRODUCTION_DEPLOY'
  | 'BUDGET_THRESHOLD';

export interface PipelineCheckpoint {
  id: string;
  stepId: string;
  type: CheckpointType;
  title: string;
  rationale: string;
  requiresCEOApproval: true;
  approvalId?: string;
  status: 'PENDING' | 'GRANTED' | 'REJECTED';
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface PipelineStep {
  id: string;
  title: string;
  description: string;
  targetRole: OfficeAgentRole;
  assignedAgentId?: string;
  requiredSkills: string[];
  dependsOnStepIds: string[];
  status: StepStatus;
  taskId?: string;
  checkpoint?: PipelineCheckpoint;
  outputSummary?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AutonomousPipeline {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  ceoObjective: string;
  status: PipelineStatus;
  steps: PipelineStep[];
  totalSteps: number;
  completedSteps: number;
  currentStepId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreatePipelineInput {
  tenantId?: string;
  projectId?: string;
  title: string;
  ceoObjective: string;
  steps: Array<{
    id?: string;
    title: string;
    description: string;
    targetRole: OfficeAgentRole;
    assignedAgentId?: string;
    requiredSkills?: string[];
    dependsOnStepIds?: string[];
    checkpoint?: {
      type: CheckpointType;
      title: string;
      rationale: string;
    };
  }>;
}

export class AdaptiveTaskFlowEngine {
  /**
   * Validates DAG to ensure there are no cyclic dependencies.
   */
  public validateDAG(steps: Array<{ id: string; dependsOnStepIds?: string[] }>): void {
    const stepIds = new Set(steps.map((s) => s.id));
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const graph = new Map<string, string[]>();
    for (const step of steps) {
      const deps = (step.dependsOnStepIds || []).filter((d) => stepIds.has(d));
      graph.set(step.id, deps);
    }

    const checkCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (checkCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true; // Cycle detected
        }
      }

      recursionStack.delete(node);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        if (checkCycle(step.id)) {
          throw new Error(`Cyclic dependency detected in pipeline step '${step.id}'`);
        }
      }
    }
  }

  /**
   * Matches the best agent for a step based on role and skills.
   */
  public matchAgentForStep(
    role: OfficeAgentRole,
    requiredSkills: string[] = [],
    tenantId: string = 'pub-dev-loop'
  ): string {
    const activeSkills = defaultDailySkillEngine.retrieveSkillsForContext(role, { tenantId });
    const skillCapabilities = activeSkills.map((s) => s.capability);

    // Default canonical role assignments
    switch (role) {
      case 'chief-of-staff':
        return 'chief-of-staff';
      case 'architect':
        return 'architect';
      case 'developer':
        return 'developer';
      case 'reviewer':
        return 'reviewer';
      case 'qa-engineer':
        return 'qa-engineer';
      default:
        return 'developer';
    }
  }
}

export class AutonomousPipelineEngine {
  private pipelines: Map<string, AutonomousPipeline> = new Map();
  private flowEngine: AdaptiveTaskFlowEngine = new AdaptiveTaskFlowEngine();
  private pool?: Pool;

  constructor(pool?: Pool) {
    this.pool = pool;
  }

  public setPool(pool: Pool): void {
    this.pool = pool;
  }

  public createPipeline(input: CreatePipelineInput): AutonomousPipeline {
    if (!input.title || !input.ceoObjective) {
      throw new Error('Pipeline title and ceoObjective are required');
    }
    if (!input.steps || input.steps.length === 0) {
      throw new Error('Pipeline must contain at least one step');
    }

    const tenantId = input.tenantId || 'pub-dev-loop';
    const projectId = input.projectId || 'pub-dev-loop';
    const now = new Date().toISOString();
    const pipelineId = `pipe-${Date.now()}-${randomUUID().slice(0, 8)}`;

    // Normalize steps and assign IDs
    const normalizedSteps: PipelineStep[] = input.steps.map((s, index) => {
      const stepId = s.id || `step-${index + 1}-${randomUUID().slice(0, 6)}`;
      let checkpoint: PipelineCheckpoint | undefined;

      if (s.checkpoint) {
        checkpoint = {
          id: `chk-${stepId}`,
          stepId,
          type: s.checkpoint.type,
          title: s.checkpoint.title,
          rationale: s.checkpoint.rationale,
          requiresCEOApproval: true,
          status: 'PENDING',
          createdAt: now,
        };
      }

      return {
        id: stepId,
        title: s.title,
        description: s.description,
        targetRole: s.targetRole,
        assignedAgentId: s.assignedAgentId || this.flowEngine.matchAgentForStep(s.targetRole, s.requiredSkills, tenantId),
        requiredSkills: s.requiredSkills || [],
        dependsOnStepIds: s.dependsOnStepIds || [],
        status: s.dependsOnStepIds && s.dependsOnStepIds.length > 0 ? 'WAITING_DEPENDENCY' : 'READY',
        checkpoint,
      };
    });

    // Validate DAG
    this.flowEngine.validateDAG(normalizedSteps);

    const pipeline: AutonomousPipeline = {
      id: pipelineId,
      tenantId,
      projectId,
      title: input.title,
      ceoObjective: input.ceoObjective,
      status: 'PLANNING',
      steps: normalizedSteps,
      totalSteps: normalizedSteps.length,
      completedSteps: 0,
      currentStepId: normalizedSteps[0]?.id,
      createdAt: now,
      updatedAt: now,
    };

    this.pipelines.set(pipeline.id, pipeline);
    return pipeline;
  }

  public getPipeline(id: string, tenantId?: string): AutonomousPipeline | undefined {
    const pipeline = this.pipelines.get(id);
    if (!pipeline) return undefined;
    if (tenantId && pipeline.tenantId !== tenantId) return undefined;
    return pipeline;
  }

  public listPipelines(filter: { tenantId?: string; projectId?: string; status?: PipelineStatus } = {}): AutonomousPipeline[] {
    const { tenantId, projectId, status } = filter;
    const result: AutonomousPipeline[] = [];

    for (const pipeline of this.pipelines.values()) {
      if (tenantId && pipeline.tenantId !== tenantId) continue;
      if (projectId && pipeline.projectId !== projectId) continue;
      if (status && pipeline.status !== status) continue;

      result.push(pipeline);
    }

    return result;
  }

  /**
   * Advances the pipeline state machine.
   * Resolves dependencies, flags approval checkpoints, and marks progression.
   */
  public tickPipeline(id: string, tenantId?: string): AutonomousPipeline {
    const pipeline = this.getPipeline(id, tenantId);
    if (!pipeline) {
      throw new Error(`Pipeline '${id}' not found`);
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(pipeline.status)) {
      return pipeline;
    }

    const now = new Date().toISOString();
    let isWaitingForApproval = false;
    let completedCount = 0;
    const completedStepIds = new Set<string>();

    for (const step of pipeline.steps) {
      if (step.status === 'COMPLETED') {
        completedCount++;
        completedStepIds.add(step.id);
      }
    }

    for (const step of pipeline.steps) {
      if (step.status === 'COMPLETED') continue;

      // Check if dependencies are satisfied
      const allDepsDone = step.dependsOnStepIds.every((depId) => completedStepIds.has(depId));

      if (!allDepsDone) {
        step.status = 'WAITING_DEPENDENCY';
        continue;
      }

      // Dependencies satisfied -> Check checkpoint
      if (step.checkpoint && step.checkpoint.status === 'PENDING') {
        step.status = 'WAITING_APPROVAL';
        isWaitingForApproval = true;
        continue;
      }

      if (step.checkpoint && step.checkpoint.status === 'REJECTED') {
        step.status = 'FAILED';
        pipeline.status = 'FAILED';
        pipeline.updatedAt = now;
        return pipeline;
      }

      // Ready or in progress
      if (step.status === 'WAITING_DEPENDENCY' || step.status === 'PENDING') {
        step.status = 'READY';
      }
    }

    pipeline.completedSteps = completedCount;
    pipeline.updatedAt = now;

    if (completedCount === pipeline.totalSteps) {
      pipeline.status = 'COMPLETED';
      pipeline.completedAt = now;
    } else if (isWaitingForApproval) {
      pipeline.status = 'WAITING_APPROVAL';
    } else {
      pipeline.status = 'RUNNING';
    }

    this.pipelines.set(pipeline.id, pipeline);
    return pipeline;
  }

  /**
   * Decides a CEO checkpoint approval on a pipeline step.
   */
  public decideCheckpoint(
    pipelineId: string,
    stepId: string,
    decision: 'GRANT' | 'REJECT',
    decidedBy: string = 'CEO',
    tenantId?: string
  ): AutonomousPipeline {
    const pipeline = this.getPipeline(pipelineId, tenantId);
    if (!pipeline) {
      throw new Error(`Pipeline '${pipelineId}' not found`);
    }

    const step = pipeline.steps.find((s) => s.id === stepId);
    if (!step || !step.checkpoint) {
      throw new Error(`Step '${stepId}' with checkpoint not found in pipeline '${pipelineId}'`);
    }

    const now = new Date().toISOString();
    step.checkpoint.status = decision === 'GRANT' ? 'GRANTED' : 'REJECTED';
    step.checkpoint.decidedAt = now;
    step.checkpoint.decidedBy = decidedBy;

    if (decision === 'GRANT') {
      step.status = 'READY';
    } else {
      step.status = 'FAILED';
      pipeline.status = 'FAILED';
    }

    return this.tickPipeline(pipelineId, tenantId);
  }

  /**
   * Marks a step as completed and updates output summary.
   */
  public completeStep(
    pipelineId: string,
    stepId: string,
    outputSummary: string = 'Step executed successfully',
    tenantId?: string
  ): AutonomousPipeline {
    const pipeline = this.getPipeline(pipelineId, tenantId);
    if (!pipeline) {
      throw new Error(`Pipeline '${pipelineId}' not found`);
    }

    const step = pipeline.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step '${stepId}' not found in pipeline '${pipelineId}'`);
    }

    step.status = 'COMPLETED';
    step.outputSummary = outputSummary;
    step.completedAt = new Date().toISOString();

    return this.tickPipeline(pipelineId, tenantId);
  }

  public clear(): void {
    this.pipelines.clear();
  }
}

export const defaultAutonomousPipelineEngine = new AutonomousPipelineEngine();
