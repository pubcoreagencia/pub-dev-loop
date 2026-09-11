import 'dotenv/config';
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

export const createPdlApp = (
  pool?: Pool,
  tasks?: PostgresTaskRepository,
  intake?: TaskIntakeService,
) => {
  const activePool = pool ?? new Pool({ connectionString: process.env.DATABASE_URL });
  const taskRepo = tasks ?? new PostgresTaskRepository(activePool);
  const intakeService = intake ?? new TaskIntakeService(activePool);

  const app = express();
  app.use(express.json());

  // Healthcheck dedicado do PDL
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'pdl-api' }));

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
