import 'dotenv/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import express from 'express';
import { Pool } from 'pg';
import { PostgresTaskRepository } from '../../repository.js';
import { defaultAgentRegistry, isValidAgentId } from '../../office/registry.js';
import { defaultOfficeOrganization } from '../../office/organization.js';
import { createOrganizationalPlan, planStepToTask } from '../../office/planning.js';
import { defaultOfficeEventBus } from '../../office/events.js';
import { defaultCodeReviewManager } from '../../office/review.js';
import { defaultApprovalManager } from '../../office/approval.js';
import { authenticateOfficeRequest } from '../../office/auth.js';
import { defaultMemoryRetrievalEngine, defaultOrganizationalAwarenessEngine, defaultDailySkillEngine, defaultAutonomousPipelineEngine } from '../../office/memory.js';
import { parseEngineeringTask, validateEngineeringTask, createEngineeringPlan, engineeringTaskToTask } from '../../office/intent.js';
import { resolveContext } from '../../office/context-resolver.js';
import { TaskIntakeService } from '../service/task-intake-service.js';
import { TaskIntakeError } from '../../task/intake.js';
import { ExecutionSpecValidationError } from '../../task/spec-validator.js';
import { PdlTaskIngestionAdapter } from '../handoff/adapter.js';
import type { PdlTaskIngestionRequest } from '../handoff/types.js';
import {
  PdlGovernanceEngine,
  requireGovernanceAuth,
  type GovernanceAuthConfig,
} from '../governance/index.js';
import { PdlContinuousScheduler } from '../scheduler/index.js';
import {
  PdlDeadLetterRepository,
  type IPdlDeadLetterRepository,
} from '../dlq/index.js';

export interface PdlAppOptions {
  governance?: PdlGovernanceEngine;
  authConfig?: GovernanceAuthConfig;
  scheduler?: PdlContinuousScheduler;
  dlq?: IPdlDeadLetterRepository;
}

export const createPdlApp = (
  pool?: Pool,
  tasks?: PostgresTaskRepository,
  intake?: TaskIntakeService,
  options?: PdlAppOptions,
) => {
  const activePool = pool ?? new Pool({ connectionString: process.env.DATABASE_URL });
  const taskRepo = tasks ?? new PostgresTaskRepository(activePool);
  const intakeService = intake ?? new TaskIntakeService(activePool);
  const governance = options?.governance ?? new PdlGovernanceEngine({ pool: activePool });
  const dlq = options?.dlq ?? new PdlDeadLetterRepository(activePool);
  const scheduler = options?.scheduler ?? new PdlContinuousScheduler({
    governance,
    pool: activePool,
    dlq,
  });
  const authConfigGetter = () => options?.authConfig;

  const app = express();
  app.use(express.json());

  // Healthcheck dedicado do PDL (Liveness)
  app.get('/health', (_req, res) => res.json({
    status: 'ok',
    service: 'pdl-api',
    name: 'PDL API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  // Readiness dedicado do PDL (Database connectivity + Intake ready)
  app.get('/ready', async (_req, res) => {
    try {
      await activePool.query('SELECT 1');
      return res.json({
        status: 'ready',
        service: 'pdl-api',
        name: 'PDL API',
        database: 'connected',
        intakeService: 'ready',
        repositoryAuthorization: 'active',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(503).json({
        status: 'not_ready',
        service: 'pdl-api',
        name: 'PDL API',
        database: 'disconnected',
        error: err.message,
      });
    }
  });

  // Phase 5.5: Governance Observability & Emergency Stop Endpoints
  app.get(
    '/governance/status',
    requireGovernanceAuth('READ', authConfigGetter),
    async (_req, res) => {
      try {
        const limits = await governance.loadLimits();
        const killSwitchStatus = await governance.getKillSwitch().checkStatus();
        return res.json({
          service: 'pdl-api',
          governance: {
            activeLevel: limits.activeLevel,
            killSwitchActive: limits.killSwitchActive,
            limits,
            killSwitchStatus,
          },
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to retrieve governance status', details: err.message });
      }
    }
  );

  app.post(
    '/governance/kill-switch',
    requireGovernanceAuth('ADMIN_WRITE', authConfigGetter),
    async (req, res) => {
      try {
        const { active, reason, updatedBy } = req.body ?? {};
        if (typeof active !== 'boolean') {
          return res.status(400).json({ error: 'Field "active" (boolean) is required' });
        }
        const principal = (req as any).governancePrincipal;
        const effectiveUpdatedBy =
          typeof updatedBy === 'string' ? updatedBy : principal?.identifier || 'api-operator';

        await governance.getKillSwitch().setDatabaseState(
          active,
          effectiveUpdatedBy,
          typeof reason === 'string' ? reason : 'Kill switch toggled via API'
        );
        governance.invalidateCache();
        const status = await governance.getKillSwitch().checkStatus();
        return res.json({
          message: `Kill switch state successfully set to ${active}`,
          killSwitchStatus: status,
        });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to update kill switch state', details: err.message });
      }
    }
  );

  app.post(
    '/governance/limits',
    requireGovernanceAuth('ADMIN_WRITE', authConfigGetter),
    async (req, res) => {
      try {
        const {
          activeLevel,
          maxConsecutiveTasks,
          maxTaskDurationMs,
          maxToolRoundsPerTask,
          maxCorrectionAttempts,
          maxConsecutiveFailures,
          allowedProducts,
          killSwitchActive,
          reason,
          updatedBy,
        } = req.body ?? {};

        if (activeLevel !== undefined && (activeLevel === 5 || activeLevel < 0 || activeLevel > 4)) {
          return res.status(400).json({
            error: `Invalid governance level (${activeLevel}). Level 5 is strictly forbidden. Allowed levels: 0, 1, 2, 3, 4.`,
          });
        }

        const principal = (req as any).governancePrincipal;
        const effectiveUpdatedBy =
          typeof updatedBy === 'string' ? updatedBy : principal?.identifier || 'api-operator';

        const updated = await governance.updateLimits(
          {
            activeLevel,
            maxConsecutiveTasks,
            maxTaskDurationMs,
            maxToolRoundsPerTask,
            maxCorrectionAttempts,
            maxConsecutiveFailures,
            allowedProducts,
            killSwitchActive,
          },
          effectiveUpdatedBy,
          typeof reason === 'string' ? reason : 'Limits updated via API'
        );

        return res.json({
          message: 'Governance limits updated successfully',
          limits: updated,
        });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to update governance limits', details: err.message });
      }
    }
  );

  // Phase 5.5 Step 2: Bounded Continuous Scheduler Endpoints
  app.get(
    '/scheduler/status',
    requireGovernanceAuth('READ', authConfigGetter),
    async (_req, res) => {
      try {
        const status = scheduler.getStatus();
        return res.json({
          service: 'pdl-api',
          scheduler: status,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to retrieve scheduler status', details: err.message });
      }
    }
  );

  app.post(
    '/scheduler/start',
    requireGovernanceAuth('ADMIN_WRITE', authConfigGetter),
    async (_req, res) => {
      try {
        const session = await scheduler.start();
        return res.json({
          message: 'Scheduler session started',
          session,
        });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to start scheduler session', details: err.message });
      }
    }
  );

  app.post(
    '/scheduler/stop',
    requireGovernanceAuth('ADMIN_WRITE', authConfigGetter),
    async (req, res) => {
      try {
        const { reason } = req.body ?? {};
        const session = await scheduler.stop(typeof reason === 'string' ? reason : 'Stopped via API');
        return res.json({
          message: 'Scheduler session stopped',
          session,
        });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to stop scheduler session', details: err.message });
      }
    }
  );

  // Phase 5.5 Step 3: Dead-Letter Queue & Quarantine Endpoints
  app.get(
    '/dlq/status',
    requireGovernanceAuth('READ', authConfigGetter),
    async (_req, res) => {
      try {
        const status = await dlq.getStatus();
        return res.json({
          service: 'pdl-api',
          dlq: status,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to retrieve DLQ status', details: err.message });
      }
    }
  );

  app.get(
    '/dlq/records',
    requireGovernanceAuth('READ', authConfigGetter),
    async (req, res) => {
      try {
        const records = await dlq.list({
          taskId: typeof req.query.taskId === 'string' ? req.query.taskId : undefined,
          product: typeof req.query.product === 'string' ? req.query.product : undefined,
          failureClass: typeof req.query.failureClass === 'string' ? req.query.failureClass : undefined,
          failureCode: typeof req.query.failureCode === 'string' ? req.query.failureCode : undefined,
          quarantined: req.query.quarantined !== undefined ? req.query.quarantined === 'true' : undefined,
        });
        return res.json({
          service: 'pdl-api',
          records,
          count: records.length,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        return res.status(500).json({ error: 'Failed to retrieve DLQ records', details: err.message });
      }
    }
  );

  // Phase 5.8: Observability Control Plane — "O que o PDL está fazendo agora?"
  app.get('/observability/active-tasks', async (_req, res) => {
    try {
      const q = `
        SELECT 
          t.id AS "taskId",
          COALESCE(t.project, 'pub-dev-loop') AS "productId",
          COALESCE((t.result->>'promotionId'), '') AS "promotionId",
          t.prototype_session_id AS "prototypeSessionId",
          e.id AS "executionSpecId",
          COALESCE(t.lease_owner, t.worker, 'none') AS "worker",
          COALESCE(t.result->>'provider', 'none') AS "provider",
          COALESCE(t.result->>'model', 'none') AS "model",
          COALESCE(t.result->'trace'->>'gateway', 'none') AS "gateway",
          COALESCE(jsonb_array_length(COALESCE(t.result->'corrections', '[]'::jsonb)), 0) AS "attempt",
          t.status AS "currentPhase",
          CASE WHEN t.status = 'COMPLETED' THEN 'PASSED' WHEN t.status = 'FAILED' THEN 'FAILED' ELSE 'PENDING' END AS "validationStatus",
          COALESCE(t.result->>'recoveredViaCorrection', 'false') AS "correctionStatus",
          t.branch,
          COALESCE(t.commit_sha, '') AS "commitSha",
          t.status AS "finalStatus",
          t.created_at AS "startedAt",
          t.updated_at AS "updatedAt"
        FROM tasks t
        LEFT JOIN execution_specs e ON e.task_id = t.id
        ORDER BY t.created_at DESC
        LIMIT 25;
      `;
      const rows = await activePool.query(q);
      return res.json({
        service: 'pdl-api',
        activeTasksCount: rows.rows.filter(r => ['QUEUED', 'ASSIGNED', 'RUNNING', 'TESTING'].includes(r.currentPhase)).length,
        tasks: rows.rows,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to retrieve observability telemetry', details: err.message });
    }
  });

  app.get('/observability/tasks/:id/lineage', async (req, res) => {
    try {
      const taskId = req.params.id;
      const t = await activePool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
      if (!t.rows[0]) return res.status(404).json({ error: 'Task not found' });
      const e = await activePool.query('SELECT * FROM execution_specs WHERE task_id = $1', [taskId]);

      return res.json({
        task: t.rows[0],
        executionSpec: e.rows[0] || null,
        lineage: {
          taskId,
          prototypeSessionId: t.rows[0].prototype_session_id,
          promotionId: t.rows[0].result?.promotionId || null,
          specHash: e.rows[0]?.spec_hash || null,
          commitSha: t.rows[0].commit_sha,
          status: t.rows[0].status,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to retrieve task lineage', details: err.message });
    }
  });

  // Organização & Agentes
  app.get('/office/organization', (_req, res) => res.json({ organization: defaultOfficeOrganization.getOrganization() }));
  app.get('/office/agents', (_req, res) => res.json({ agents: defaultAgentRegistry.listAgents() }));
  app.get('/office/agents/:id', (req, res) => {
    const agent = defaultAgentRegistry.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    return res.json({ agent });
  });

  // POST /tasks — Canonical Phase 3B Atomic Task & ExecutionSpec Intake
  app.post('/tasks', async (req, res, next) => {
    try {
      const body = req.body ?? {};
      const rawPrompt = typeof body.prompt === 'string' && body.prompt.trim()
        ? body.prompt.trim()
        : (typeof body.objective === 'string' && body.objective.trim()
          ? body.objective.trim()
          : (typeof body.rawRequest === 'string' ? body.rawRequest.trim() : ''));

      if (!rawPrompt) {
        return res.status(400).json({ error: 'prompt or objective is required' });
      }

      const result = await intakeService.processIntake({
        rawRequest: rawPrompt,
        source: typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'pdl-api',
        project: typeof body.project === 'string' ? body.project.trim() : undefined,
        repository: typeof body.repository === 'string' ? body.repository.trim() : undefined,
        priority: typeof body.priority === 'number' ? body.priority : undefined,
        agentId: typeof body.agentId === 'string' ? body.agentId.trim() : undefined,
      });

      return res.status(201).json({
        ...result.task,
        task: {
          id: result.task.id,
          status: result.task.status,
        },
        executionSpec: {
          id: result.executionSpec.id,
          specVersion: result.executionSpec.spec_version,
          specHash: result.executionSpec.spec_hash,
          status: result.executionSpec.status,
          sealedAt: result.executionSpec.sealed_at,
          lineage: result.executionSpec.lineage,
        },
      });
    } catch (err: any) {
      if (err instanceof TaskIntakeError || err?.code === 'INVALID_TASK' || err?.name === 'TaskIntakeError') {
        return res.status(400).json({ error: err.message });
      }
      if (
        err instanceof ExecutionSpecValidationError ||
        err?.code === 'VALIDATION_FAILED' ||
        err?.name === 'ExecutionSpecValidationError' ||
        err?.message?.includes('validation failed')
      ) {
        return res.status(422).json({
          error: err.message,
          details: err.issues ?? [],
        });
      }
      return res.status(500).json({
        error: 'Failed to process task intake due to database transaction error',
      });
    }
  });

  // POST /tasks/ingest — Canonical Handoff Ingestion Boundary (Phase 3E)
  app.post('/tasks/ingest', async (req, res, next) => {
    try {
      const body = req.body as PdlTaskIngestionRequest;
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Request body is required' });
      }

      const requiredFields: (keyof PdlTaskIngestionRequest)[] = [
        'project',
        'repository',
        'branch',
        'checkpointSha',
        'promotionId',
        'prototypeSessionId',
        'objective',
        'prompt',
      ];

      for (const field of requiredFields) {
        if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
          return res.status(400).json({ error: `Missing or invalid required field: ${field}` });
        }
      }

      const adapter = new PdlTaskIngestionAdapter(taskRepo, intakeService);
      const result = await adapter.ingest(body);
      return res.status(201).json(result);
    } catch (err: any) {
      if (
        err instanceof TaskIntakeError ||
        err?.code === 'INVALID_TASK' ||
        err?.name === 'TaskIntakeError' ||
        err?.message?.includes('Repository authorization denied')
      ) {
        return res.status(400).json({ error: err.message });
      }
      if (
        err instanceof ExecutionSpecValidationError ||
        err?.code === 'VALIDATION_FAILED' ||
        err?.name === 'ExecutionSpecValidationError' ||
        err?.message?.includes('validation failed')
      ) {
        return res.status(422).json({
          error: err.message,
          details: err.issues ?? [],
        });
      }
      return next(err);
    }
  });

  // GET /tasks
  app.get('/tasks', async (_req, res, next) => {
    try {
      const allTasks = await taskRepo.list();
      return res.json(allTasks);
    } catch (err) {
      return next(err);
    }
  });

  // GET /tasks/:id
  app.get('/tasks/:id', async (req, res, next) => {
    try {
      const t = await taskRepo.get(req.params.id);
      return t ? res.json(t) : res.sendStatus(404);
    } catch (e) {
      return next(e);
    }
  });

  // POST /tasks/:id/cancel
  app.post('/tasks/:id/cancel', async (req, res, next) => {
    try {
      const t = await taskRepo.cancel(req.params.id);
      return t ? res.json(t) : res.status(409).json({ error: 'Task cannot be cancelled' });
    } catch (e) {
      return next(e);
    }
  });

  // POST /tasks/:id/retry
  app.post('/tasks/:id/retry', async (req, res, next) => {
    try {
      const t = await taskRepo.retry(req.params.id);
      return t ? res.json(t) : res.status(409).json({ error: 'Task cannot be retried' });
    } catch (e) {
      return next(e);
    }
  });

  // POST /office/plans
  app.post('/office/plans', (req, res) => {
    try {
      const { objective, project = 'pub-dev-loop', repository, context, steps } = req.body ?? {};
      if (!objective || typeof objective !== 'string' || !objective.trim()) {
        return res.status(400).json({ error: 'objective is required' });
      }

      defaultOfficeEventBus.publish({
        type: 'OBJECTIVE_SUBMITTED',
        actorId: 'ceo',
        targetId: 'chief-of-staff',
        project,
        summary: `Objetivo submetido pelo CEO: ${objective.slice(0, 50)}...`,
        payload: { objective },
      });

      defaultOfficeEventBus.publish({
        type: 'MEETING_STARTED',
        actorId: 'ceo',
        targetId: 'chief-of-staff',
        project,
        summary: `Alinhamento de Planejamento Estratégico: ${objective.slice(0, 40)}...`,
        payload: { participants: ['ceo', 'chief-of-staff'], topic: objective },
      });

      const plan = createOrganizationalPlan(
        { objective, project, repository, context },
        { steps }
      );

      defaultOfficeEventBus.publish({
        type: 'PLAN_FORMULATED',
        actorId: 'chief-of-staff',
        targetId: 'ceo',
        project,
        planId: plan.id,
        summary: `Plano organizacional formulado com ${plan.steps.length} etapas delegadas.`,
        payload: { stepCount: plan.steps.length },
      });

      defaultOfficeEventBus.publish({
        type: 'MEETING_ENDED',
        actorId: 'chief-of-staff',
        targetId: 'ceo',
        project,
        planId: plan.id,
        summary: 'Encerramento da Reunião de Alinhamento Estratégico',
      });

      return res.status(201).json({ plan });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /office/plans/execute-step
  app.post('/office/plans/execute-step', async (req, res, next) => {
    try {
      const { plan, stepId, overrides } = req.body ?? {};
      if (!plan || !stepId) {
        return res.status(400).json({ error: 'plan and stepId are required' });
      }
      const step = plan.steps?.find((s: any) => s.id === stepId);
      if (!step) {
        return res.status(404).json({ error: `Step '${stepId}' not found in plan` });
      }
      const intakeResult = await intakeService.processIntake({
        rawRequest: step.prompt || step.description,
        source: 'office-plan-step',
        project: plan.project,
        repository: plan.repository,
        priority: typeof overrides?.priority === 'number' ? overrides.priority : 1,
        agentId: typeof overrides?.agentId === 'string' ? overrides.agentId.trim() : (step.agentId || undefined),
        executionInstructions: [step.description],
        acceptanceCriteria: plan.context?.acceptance_criteria?.length ? plan.context.acceptance_criteria : [`Fulfill step: ${step.description}`],
        validationPlan: [`Verify implementation against step: ${step.description}`],
      });
      const createdTask = intakeResult.task;

      if (step.agentId) {
        defaultOfficeEventBus.publish({
          type: 'STEP_DELEGATED',
          actorId: 'chief-of-staff',
          targetId: step.agentId,
          project: plan.project,
          planId: plan.id,
          stepId: step.id,
          taskId: createdTask.id,
          summary: `Etapa '${step.id}' delegada a ${step.agentId.toUpperCase()}`,
        });

        defaultOfficeEventBus.publish({
          type: 'AGENT_STARTED_WORK',
          actorId: step.agentId,
          project: plan.project,
          taskId: createdTask.id,
          summary: `Iniciou execução da etapa '${step.id}'`,
        });

        if (step.dependsOn && step.dependsOn.length > 0) {
          const prevStepId = step.dependsOn[0];
          const prevStep = plan.steps.find((s: any) => s.id === prevStepId);
          if (prevStep?.agentId && prevStep.agentId !== step.agentId) {
            defaultOfficeEventBus.publish({
              type: 'AGENT_HANDOFF',
              actorId: prevStep.agentId,
              targetId: step.agentId,
              project: plan.project,
              summary: `Handoff de ${prevStep.agentId.toUpperCase()} para ${step.agentId.toUpperCase()}`,
            });
          }
        }
      }

      return res.status(201).json({
        task: createdTask,
        executionSpec: {
          id: intakeResult.executionSpec.id,
          specVersion: intakeResult.executionSpec.spec_version,
          specHash: intakeResult.executionSpec.spec_hash,
          status: intakeResult.executionSpec.status,
          sealedAt: intakeResult.executionSpec.sealed_at,
          lineage: intakeResult.executionSpec.lineage,
        },
      });
    } catch (err) {
      return next(err);
    }
  });

  // POST /office/reviews/evaluate
  app.post('/office/reviews/evaluate', (req, res) => {
    try {
      const { taskId, planId, developerAgentId, reviewerAgentId, project, findings, testPassed, typecheckPassed, buildPassed } = req.body ?? {};
      if (!taskId) {
        return res.status(400).json({ error: 'taskId is required' });
      }
      const review = defaultCodeReviewManager.evaluateReview({
        taskId,
        planId,
        developerAgentId,
        reviewerAgentId,
        project,
        findings,
        testPassed,
        typecheckPassed,
        buildPassed,
      });
      return res.status(200).json({ review });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /office/approvals/request
  app.post('/office/approvals/request', (req, res) => {
    try {
      const { planId, taskId, project, type, title, rationale, requestedBy } = req.body ?? {};
      if (!type || !title || !rationale || !requestedBy) {
        return res.status(400).json({ error: 'type, title, rationale and requestedBy are required' });
      }
      const approval = defaultApprovalManager.requestApproval({
        planId,
        taskId,
        project,
        type,
        title,
        rationale,
        requestedBy,
      });
      return res.status(201).json({ approval });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /office/approvals/:id/decide
  app.post('/office/approvals/:id/decide', (req, res) => {
    try {
      let principal;
      try {
        principal = authenticateOfficeRequest(req.headers);
      } catch (authErr: any) {
        return res.status(401).json({ error: authErr.message });
      }

      const { decision, notes } = req.body ?? {};
      if (!decision || (decision !== 'GRANT' && decision !== 'REJECT')) {
        return res.status(400).json({ error: 'decision must be GRANT or REJECT' });
      }

      const approval = defaultApprovalManager.decideApproval(req.params.id, decision, principal, notes);
      return res.status(200).json({ approval });
    } catch (err: any) {
      if (err.message.startsWith('UNAUTHORIZED') || err.message.startsWith('FORBIDDEN')) {
        return res.status(403).json({ error: err.message });
      }
      if (err.message.startsWith('NOT_FOUND')) {
        return res.status(404).json({ error: err.message });
      }
      if (err.message.startsWith('CONFLICT')) {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /office/approvals
  app.get('/office/approvals', (req, res) => {
    const project = typeof req.query.project === 'string' ? req.query.project.trim() : undefined;
    const approvals = defaultApprovalManager.listApprovals(project);
    return res.status(200).json({ approvals });
  });

  // GET /office/memory
  app.get('/office/memory', async (req, res) => {
    try {
      let principal;
      try {
        principal = authenticateOfficeRequest(req.headers);
      } catch (authErr: any) {
        return res.status(401).json({ error: authErr.message });
      }

      const project = typeof req.query.project === 'string' ? req.query.project.trim() : 'pub-dev-loop';
      const type = typeof req.query.type === 'string' ? (req.query.type.trim() as any) : undefined;
      const status = typeof req.query.status === 'string' ? (req.query.status.trim() as any) : undefined;
      const actorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : undefined;
      const agentRole = typeof req.query.agentRole === 'string' ? (req.query.agentRole.trim() as any) : undefined;
      const taskId = typeof req.query.taskId === 'string' ? req.query.taskId.trim() : undefined;
      const planId = typeof req.query.planId === 'string' ? req.query.planId.trim() : undefined;
      const query = typeof req.query.query === 'string' ? req.query.query.trim() : undefined;
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) || 5 : 5;

      const memories = await defaultMemoryRetrievalEngine.retrieveContext({
        tenantId: principal.tenantId || 'pub-dev-loop',
        projectId: project,
        types: type ? [type] : undefined,
        status,
        actorId,
        agentRole,
        taskId,
        planId,
        query,
        limit,
      });

      return res.status(200).json({ memories });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /office/intelligence & /office/awareness
  app.get(['/office/intelligence', '/office/awareness'], async (req, res) => {
    try {
      let principal;
      try {
        principal = authenticateOfficeRequest(req.headers);
      } catch (authErr: any) {
        return res.status(401).json({ error: authErr.message });
      }

      const project = typeof req.query.project === 'string' ? req.query.project.trim() : 'pub-dev-loop';
      const tenantId = principal.tenantId || 'pub-dev-loop';

      const allTasks = await taskRepo.list();
      const allEvents = defaultOfficeEventBus.getEventsSince(0, { project });

      const awareness = defaultOrganizationalAwarenessEngine.generateAwareness({
        tenantId,
        projectId: project,
        tasks: allTasks,
        events: allEvents,
      });

      return res.status(200).json({ awareness });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /office/skills
  app.get('/office/skills', async (req, res) => {
    try {
      let principal;
      try {
        principal = authenticateOfficeRequest(req.headers);
      } catch (authErr: any) {
        return res.status(401).json({ error: authErr.message });
      }

      const project = typeof req.query.project === 'string' ? req.query.project.trim() : undefined;
      const role = typeof req.query.role === 'string' ? (req.query.role.trim() as any) : undefined;
      const status = typeof req.query.status === 'string' ? (req.query.status.trim() as any) : undefined;
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) || 50 : 50;
      const tenantId = principal.tenantId || 'pub-dev-loop';

      const skills = defaultDailySkillEngine.listSkills({
        tenantId,
        projectId: project,
        role,
        status,
        limit,
      });

      return res.status(200).json({ skills });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /office/skills/:id
  app.get('/office/skills/:id', async (req, res) => {
    try {
      let principal;
      try {
        principal = authenticateOfficeRequest(req.headers);
      } catch (authErr: any) {
        return res.status(401).json({ error: authErr.message });
      }

      const id = req.params.id;
      const tenantId = principal.tenantId || 'pub-dev-loop';

      const skill = defaultDailySkillEngine.getSkill(id, tenantId);
      if (!skill) {
        return res.status(404).json({ error: `Skill '${id}' not found` });
      }

      return res.status(200).json({ skill });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /office/pipelines/create
  app.post('/office/pipelines/create', async (req, res) => {
    try {
      let principal;
      try {
        principal = authenticateOfficeRequest(req.headers);
      } catch (authErr: any) {
        return res.status(401).json({ error: authErr.message });
      }

      const { title, ceoObjective, steps, project } = req.body ?? {};
      if (!title || !ceoObjective || !steps) {
        return res.status(400).json({ error: 'title, ceoObjective, and steps are required' });
      }

      const tenantId = principal.tenantId || 'pub-dev-loop';
      const projectId = project || 'pub-dev-loop';

      const pipeline = defaultAutonomousPipelineEngine.createPipeline({
        tenantId,
        projectId,
        title,
        ceoObjective,
        steps,
      });

      return res.status(201).json({ pipeline });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // GET /office/pipelines
  app.get('/office/pipelines', async (req, res) => {
    try {
      let principal;
      try {
        principal = authenticateOfficeRequest(req.headers);
      } catch (authErr: any) {
        return res.status(401).json({ error: authErr.message });
      }

      const project = typeof req.query.project === 'string' ? req.query.project.trim() : undefined;
      const status = typeof req.query.status === 'string' ? (req.query.status.trim() as any) : undefined;
      const tenantId = principal.tenantId || 'pub-dev-loop';

      const pipelines = defaultAutonomousPipelineEngine.listPipelines({
        tenantId,
        projectId: project,
        status,
      });

      return res.status(200).json({ pipelines });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /office/pipelines/:id
  app.get('/office/pipelines/:id', async (req, res) => {
    try {
      let principal;
      try {
        principal = authenticateOfficeRequest(req.headers);
      } catch (authErr: any) {
        return res.status(401).json({ error: authErr.message });
      }

      const id = req.params.id;
      const tenantId = principal.tenantId || 'pub-dev-loop';

      const pipeline = defaultAutonomousPipelineEngine.getPipeline(id, tenantId);
      if (!pipeline) {
        return res.status(404).json({ error: `Pipeline '${id}' not found` });
      }

      return res.status(200).json({ pipeline });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // POST /office/pipelines/:id/tick
  app.post('/office/pipelines/:id/tick', async (req, res) => {
    try {
      let principal;
      try {
        principal = authenticateOfficeRequest(req.headers);
      } catch (authErr: any) {
        return res.status(401).json({ error: authErr.message });
      }

      const id = req.params.id;
      const tenantId = principal.tenantId || 'pub-dev-loop';

      const pipeline = defaultAutonomousPipelineEngine.tickPipeline(id, tenantId);
      return res.status(200).json({ pipeline });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // POST /office/pipelines/:id/checkpoints/:stepId/decide
  app.post('/office/pipelines/:id/checkpoints/:stepId/decide', async (req, res) => {
    try {
      let principal;
      try {
        principal = authenticateOfficeRequest(req.headers);
      } catch (authErr: any) {
        return res.status(401).json({ error: authErr.message });
      }

      const { decision, decidedBy } = req.body ?? {};
      if (!decision || !['GRANT', 'REJECT'].includes(decision)) {
        return res.status(400).json({ error: 'decision must be GRANT or REJECT' });
      }

      const { id, stepId } = req.params;
      const tenantId = principal.tenantId || 'pub-dev-loop';

      const pipeline = defaultAutonomousPipelineEngine.decideCheckpoint(
        id,
        stepId,
        decision,
        decidedBy || 'CEO',
        tenantId
      );

      return res.status(200).json({ pipeline });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // GET /office/stream (SSE)
  app.get('/office/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const project = typeof req.query.project === 'string' ? req.query.project.trim() : undefined;
    const lastEventIdHeader = req.headers['last-event-id'] || req.query.lastEventId;
    const lastSeq = typeof lastEventIdHeader === 'string' ? parseInt(lastEventIdHeader, 10) || 0 : 0;

    res.write(': connected\n\n');

    if (lastSeq > 0) {
      const missed = defaultOfficeEventBus.getEventsSince(lastSeq, { project });
      for (const evt of missed) {
        res.write(`id: ${evt.sequence}\nevent: office\ndata: ${JSON.stringify(evt)}\n\n`);
      }
    }

    const unsubscribe = defaultOfficeEventBus.subscribe({ project }, (evt) => {
      try {
        res.write(`id: ${evt.sequence}\nevent: office\ndata: ${JSON.stringify(evt)}\n\n`);
      } catch {}
    });

    const heartbeatTimer = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeatTimer);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeatTimer);
      unsubscribe();
    });
  });

  return app;
};

const isDirectRun = process.argv[1]?.endsWith('entry.ts') || process.argv[1]?.endsWith('entry.js') || process.argv[1]?.endsWith('pdl-api-entry.ts') || process.argv[1]?.endsWith('pdl-api-entry.js');
if (isDirectRun) {
  const port = Number(process.env.PDL_API_PORT ?? 3000);
  const app = createPdlApp();
  app.listen(port, '0.0.0.0', () => {
    console.log(`[PDL API] Dedicated server listening on 0.0.0.0:${port}`);
  });
}
