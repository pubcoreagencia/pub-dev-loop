import { describe, it, expect, beforeEach } from 'vitest';
import {
  DecisionContextEngine,
  defaultDecisionContextEngine,
  ROLE_AUTHORITY_BOUNDARIES,
  ROLE_RESPONSIBILITY_CONTRACTS,
} from '../src/office/decision-context.js';
import { ContextAssemblyEngine } from '../src/office/context-assembly.js';
import type { Task } from '../domain.js';

describe('PDL — Phase 8.6-C: Agent Decision Context Test Suite', () => {
  let assemblyEngine: ContextAssemblyEngine;
  let decisionEngine: DecisionContextEngine;
  const tenantId = 'pub-dev-loop';
  const projectId = 'pub-dev-loop';

  beforeEach(() => {
    assemblyEngine = new ContextAssemblyEngine();
    decisionEngine = new DecisionContextEngine();
  });

  function createBaseTask(agentRole: any, overrides?: Partial<Task>): Task {
    return {
      id: `task-${agentRole}-decision`,
      project: projectId,
      tenantId: tenantId as any,
      agentId: agentRole,
      type: 'execute',
      objective: `Implement feature for ${agentRole}`,
      prompt: 'Execute implementation of user service.',
      status: 'pending',
      ...overrides,
    };
  }

  it('1. Deterministic Decision Context: Same assembly result produces identical structured decision context', () => {
    const task = createBaseTask('developer');
    const assemblyRes = assemblyEngine.assembleContext({
      agentRole: 'developer',
      tenantId,
      projectId,
      currentTask: task,
      runtimeEvidence: 'Tests compiled with 0 errors.',
    });

    const dec1 = decisionEngine.buildDecisionContext(assemblyRes, {
      role: 'developer',
      tenantId,
      projectId,
      task,
    });

    const dec2 = decisionEngine.buildDecisionContext(assemblyRes, {
      role: 'developer',
      tenantId,
      projectId,
      task,
    });

    expect(dec1.objective.statement).toBe(dec2.objective.statement);
    expect(dec1.nextStep.action).toBe(dec2.nextStep.action);
    expect(dec1.evidence.length).toBe(dec2.evidence.length);
    expect(dec1.confidence).toBe(dec2.confidence);
  });

  it('2. Role-Specific Objectives and Responsibility Contracts for all 5 roles', () => {
    const roles = ['chief-of-staff', 'architect', 'developer', 'reviewer', 'qa-engineer'] as const;

    for (const role of roles) {
      const task = createBaseTask(role);
      const assemblyRes = assemblyEngine.assembleContext({
        agentRole: role,
        tenantId,
        projectId,
        currentTask: task,
        ceoObjective: role === 'chief-of-staff' ? 'Deliver MVP by Friday' : undefined,
      });

      const dec = decisionEngine.buildDecisionContext(assemblyRes, {
        role,
        tenantId,
        projectId,
        task,
        ceoObjective: role === 'chief-of-staff' ? 'Deliver MVP by Friday' : undefined,
      });

      expect(dec.role).toBe(role);
      expect(dec.responsibility.operationalScope).toBeDefined();
      expect(dec.authorityBoundary).toBeDefined();

      if (role === 'chief-of-staff') {
        expect(dec.objective.source).toBe('CEO_DIRECTIVE');
        expect(dec.objective.statement).toBe('Deliver MVP by Friday');
      } else {
        expect(dec.objective.source).toBe('TASK_INSTRUCTION');
      }
    }
  });

  it('3. Authority Boundaries & Zero Privilege Elevation: No agent can modify governance or auto-approve outside boundaries', () => {
    const devBoundary = ROLE_AUTHORITY_BOUNDARIES.developer;
    expect(devBoundary.canExecute).toBe(true);
    expect(devBoundary.canApprove).toBe(false);
    expect(devBoundary.canModifyGovernance).toBe(false);

    const archBoundary = ROLE_AUTHORITY_BOUNDARIES.architect;
    expect(archBoundary.canRecommend).toBe(true);
    expect(archBoundary.canApprove).toBe(false);
    expect(archBoundary.canModifyGovernance).toBe(false);

    const cosBoundary = ROLE_AUTHORITY_BOUNDARIES['chief-of-staff'];
    expect(cosBoundary.canApprove).toBe(false); // CEO approves, CoS plans
    expect(cosBoundary.canModifyGovernance).toBe(false);

    const revBoundary = ROLE_AUTHORITY_BOUNDARIES.reviewer;
    expect(revBoundary.canReview).toBe(true);
    expect(revBoundary.canModifyGovernance).toBe(false);
  });

  it('4. Guardrail & Constraints Enforcement: Reviewer MAX_REVIEW_ITERATIONS = 3 and CEO Sovereignty', () => {
    const revTask = createBaseTask('reviewer');
    const revAssembly = assemblyEngine.assembleContext({
      agentRole: 'reviewer',
      tenantId,
      projectId,
      currentTask: revTask,
    });

    const revDecBlocked = decisionEngine.buildDecisionContext(revAssembly, {
      role: 'reviewer',
      tenantId,
      projectId,
      task: revTask,
      reviewIteration: 3, // Limit reached
    });

    expect(revDecBlocked.governance.blocked).toBe(true);
    expect(revDecBlocked.governance.blockingReason).toBe('MAX_REVIEW_ITERATIONS_EXCEEDED');
    expect(revDecBlocked.constraints.some((c) => c.id === 'CONST_MAX_REVIEW_ITERATIONS')).toBe(true);

    const cosTask = createBaseTask('chief-of-staff');
    const cosAssembly = assemblyEngine.assembleContext({
      agentRole: 'chief-of-staff',
      tenantId,
      projectId,
      currentTask: cosTask,
    });

    const cosDec = decisionEngine.buildDecisionContext(cosAssembly, {
      role: 'chief-of-staff',
      tenantId,
      projectId,
      task: cosTask,
    });

    expect(cosDec.constraints.some((c) => c.id === 'CONST_CEO_SOVEREIGNTY')).toBe(true);
  });

  it('5. Missing Context Detection: Missing objective or evidence is captured in missingContext list', () => {
    const emptyTask: Task = {
      id: 'task-empty',
      project: projectId,
      tenantId: tenantId as any,
      agentId: 'developer',
      type: 'execute',
      prompt: '', // Empty prompt
      status: 'pending',
    };

    const emptyAssembly = assemblyEngine.assembleContext({
      agentRole: 'developer',
      tenantId,
      projectId,
      currentTask: emptyTask,
    });

    const dec = decisionEngine.buildDecisionContext(emptyAssembly, {
      role: 'developer',
      tenantId,
      projectId,
      task: emptyTask,
    });

    expect(dec.missingContext.some((mc) => mc.includes('MISSING_OBJECTIVE'))).toBe(true);
    expect(dec.confidence).toBe('LOW');
  });

  it('6. NextStep Invariant: Recommendations are advisory and isAutomatic is strictly false', () => {
    const task = createBaseTask('developer');
    const assemblyRes = assemblyEngine.assembleContext({
      agentRole: 'developer',
      tenantId,
      projectId,
      currentTask: task,
    });

    const dec = decisionEngine.buildDecisionContext(assemblyRes, {
      role: 'developer',
      tenantId,
      projectId,
      task,
    });

    expect(dec.nextStep.action).toBe('IMPLEMENT');
    expect(dec.nextStep.isAutomatic).toBe(false); // Execution remains separated
  });

  it('7. Formatting Helper: Formats decision context as advisory markdown block', () => {
    const task = createBaseTask('developer');
    const assemblyRes = assemblyEngine.assembleContext({
      agentRole: 'developer',
      tenantId,
      projectId,
      currentTask: task,
    });

    const dec = decisionEngine.buildDecisionContext(assemblyRes, {
      role: 'developer',
      tenantId,
      projectId,
      task,
    });

    const formatted = decisionEngine.formatDecisionContext(dec);
    expect(formatted).toContain('[OPERATIONAL DECISION CONTEXT — DEVELOPER]');
    expect(formatted).toContain('OBJETIVO OPERACIONAL:');
    expect(formatted).toContain('PRÓXIMA AÇÃO RECOMENDADA:');
    expect(formatted).toContain('AVISO: Esta estrutura de decisão é consultiva');
  });
});
