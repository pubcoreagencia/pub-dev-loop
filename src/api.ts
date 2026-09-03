import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { PostgresTaskRepository } from './repository.js';
import { PostgresPrototypeRepository } from './prototype/repository.js';
import { PrototypeEventStream, PostgresPrototypeEventBridge } from './prototype/events.js';
import { PrototypeSseBroker } from './prototype/sse.js';
import { prototypeUiHtml } from './prototype/ui.js';
import { prototypeHistoryUiScript } from './prototype/history-ui.js';
import { PrototypeComparisonPreviewManager } from './prototype/comparison-preview.js';
import { LocalPreviewRuntime } from './prototype/local-preview-runtime.js';
import { PublicPreviewRuntime } from './prototype/public-preview-runtime.js';
import { PrototypeHandoffService, type PrototypeHandoffInput } from './prototype/handoff.js';
import { defaultAgentRegistry, isValidAgentId } from './office/registry.js';
import { defaultOfficeOrganization } from './office/organization.js';
import { createOrganizationalPlan, planStepToTask } from './office/planning.js';
import { defaultOfficeEventBus } from './office/events.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prototypeEvents = new PrototypeEventStream();
const prototypeEventBridge = new PostgresPrototypeEventBridge(pool, prototypeEvents);
const prototypeSse = new PrototypeSseBroker();
prototypeEvents.subscribe(event => prototypeSse.publish(event));
void prototypeEventBridge.start().catch(error => console.error('Prototype event bridge failed:', error));

const defaultPrototypeRepository = process.env.PROTOTYPE_TEMPLATE_REPOSITORY ?? 'https://github.com/pubcoreagencia/pub-dev-loop-template.git';
const prototypeWorkspaceRoot = process.env.PROTOTYPE_WORKSPACES_ROOT ?? '/tmp/pub-prototype';
const comparisonRuntime = (process.env.PROTOTYPE_PREVIEW_MODE ?? 'public') === 'local'
  ? new LocalPreviewRuntime()
  : new PublicPreviewRuntime();
const comparisonPreviews = new PrototypeComparisonPreviewManager(comparisonRuntime);
const previewCommand = process.env.PROTOTYPE_PREVIEW_COMMAND ?? 'npm';
const previewArgs = (process.env.PROTOTYPE_PREVIEW_ARGS ?? 'run dev -- --host 0.0.0.0 --port {PORT}')
  .split(' ')
  .filter(Boolean);
const previewPublicBaseUrl = process.env.PROTOTYPE_PREVIEW_BASE_URL || undefined;

const repoPath = (sessionId: string) => path.join(prototypeWorkspaceRoot, sessionId);
function gitDiff(cwd: string, base: string, head: string): string {
  return execFileSync('git', ['diff', '--no-ext-diff', '--unified=3', base, head], { cwd, encoding: 'utf8', maxBuffer: 250_000 }).slice(0, 200_000);
}

export const createApp = (tasks = new PostgresTaskRepository(pool), prototypes = new PostgresPrototypeRepository(pool)) => {
  const app = express(); app.use(express.json());
  const handoff = new PrototypeHandoffService(tasks, prototypes, prototypeEvents);

  app.get('/health', (_q,res)=>res.json({status:'ok'}));
  app.get('/office/organization', (_req, res) => res.json({ organization: defaultOfficeOrganization.getOrganization() }));
  app.get('/office/agents', (_req, res) => res.json({ agents: defaultAgentRegistry.listAgents() }));
  app.get('/office/agents/:id', (req, res) => {
    const agent = defaultAgentRegistry.getAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    return res.json({ agent });
  });
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
      const taskPayload = planStepToTask(step, plan, overrides);
      const createdTask = await tasks.create(taskPayload);

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

      return res.status(201).json({ task: createdTask });
    } catch (err) {
      return next(err);
    }
  });

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
      } catch {
        // Conexão encerrada
      }
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
  app.get(['/prototype', '/prototype/sessions/:id/view'], (_req,res)=>res.status(200).type('html').send(prototypeUiHtml()+prototypeHistoryUiScript()));

  app.post('/tasks', async(req,res,next)=>{
    try {
      const {project,repository,objective,prompt,priority,agentId}=req.body??{};
      if(!project||!repository||!objective||!prompt) return res.status(400).json({error:'project, repository, objective and prompt are required'});
      if(agentId !== undefined && agentId !== null) {
        if(!isValidAgentId(agentId)) {
          return res.status(400).json({error:`Invalid agentId: '${agentId}'. Must be a registered agent in The Office.`});
        }
      }
      return res.status(201).json(await tasks.create({
        project,
        repository,
        objective,
        prompt,
        priority,
        agentId: typeof agentId === 'string' ? agentId.trim() : undefined,
      }));
    } catch(e){return next(e);}
  });
  app.get('/tasks',async(_q,res,next)=>{try{return res.json(await tasks.list())}catch(e){return next(e)}});
  app.get('/tasks/:id',async(req,res,next)=>{try{const t=await tasks.get(req.params.id);return t?res.json(t):res.sendStatus(404)}catch(e){return next(e)}});
  app.post('/tasks/:id/cancel',async(req,res,next)=>{try{const t=await tasks.cancel(req.params.id);return t?res.json(t):res.status(409).json({error:'Task cannot be cancelled'})}catch(e){return next(e)}});
  app.post('/tasks/:id/retry',async(req,res,next)=>{try{const t=await tasks.retry(req.params.id);return t?res.json(t):res.status(409).json({error:'Task cannot be retried'})}catch(e){return next(e)}});

  app.post('/prototype/sessions', async(req,res,next)=>{
    try {
      const {project, repository, branch} = req.body ?? {};
      if(!project) return res.status(400).json({error:'project is required'});
      const session = await prototypes.createSession({project, repository: repository || defaultPrototypeRepository, branch});
      prototypeEvents.emit({sessionId:session.id,type:'PREVIEW_STARTED',payload:{phase:'session_created',repository:session.repository}});
      return res.status(201).json(session);
    } catch(e){return next(e);}
  });

  app.get('/prototype/sessions',async(_req,res,next)=>{try{return res.json(await prototypes.listSessions())}catch(e){return next(e)}});
  app.get('/prototype/sessions/:id',async(req,res,next)=>{try{const session=await prototypes.getSession(req.params.id);if(!session)return res.sendStatus(404);const allTasks = await tasks.list();const filtered = allTasks.filter(t => t.prototypeSessionId === session.id);return res.json({session,checkpoints:await prototypes.listCheckpoints(session.id),tasks:filtered})}catch(e){return next(e)}});
  app.get('/prototype/sessions/:id/events',async(req,res,next)=>{
    try { const session=await prototypes.getSession(req.params.id); if(!session)return res.sendStatus(404);
      res.status(200); res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache, no-transform'); res.setHeader('Connection','keep-alive'); res.flushHeaders?.();
      const unsubscribe=prototypeSse.subscribe(session.id,res); const heartbeat=setInterval(()=>prototypeSse.heartbeat(session.id),15000); req.on('close',()=>{clearInterval(heartbeat);unsubscribe();}); res.write(': connected\\n\\n');
    } catch(e){return next(e);}
  });

  app.patch('/prototype/sessions/:id',async(req,res,next)=>{
    try { const allowed=['status','mode','previewUrl','previewRuntime','workspacePath','lastCheckpointSha'] as const;
      const patch=Object.fromEntries(allowed.filter(k=>req.body?.[k]!==undefined).map(k=>[k,req.body[k]]));
      const session=await prototypes.updateSession(req.params.id,patch); if(!session)return res.sendStatus(404);
      const eventType=patch.status==='READY'?'PREVIEW_READY':patch.status==='FAILED'?'ERROR':null;
      if(eventType)prototypeEvents.emit({sessionId:session.id,type:eventType,payload:{status:session.status,previewUrl:session.previewUrl}});
      return res.json(session);
    } catch(e){return next(e);
    }
  });

  app.post('/prototype/sessions/:id/prompts',async(req,res,next)=>{
    try { const session=await prototypes.getSession(req.params.id); if(!session)return res.sendStatus(404); const {objective='Prototype MVP iteration',prompt,priority}=req.body??{};
      if(!prompt)return res.status(400).json({error:'prompt is required'});
      if(['BUILDING','PREVIEWING'].includes(session.status))return res.status(409).json({error:'Prototype session is already processing a prompt'});
      const updated=await prototypes.incrementPromptCount(session.id); if(!updated)return res.sendStatus(409);
      prototypeEvents.emit({sessionId:updated.id,type:'USER_PROMPT',payload:{prompt,promptIndex:updated.promptCount,objective}});
      const task=await tasks.create({project:updated.project,repository:updated.repository,objective,prompt,priority:priority??0,prototypeSessionId:updated.id});
      await tasks.update(task.id,{branch:updated.branch,workspacePath:path.join(prototypeWorkspaceRoot,updated.id)});
      prototypeEvents.emit({sessionId:updated.id,type:'AGENT_STARTED',payload:{taskId:task.id}});
      return res.status(202).json({session:updated,task,mode:'PROTOTYPE'});
    } catch(e){return next(e);}
  });

  app.get('/prototype/sessions/:id/diff',async(req,res,next)=>{
    try {
      const session=await prototypes.getSession(req.params.id); if(!session)return res.sendStatus(404);
      const checkpoints=await prototypes.listCheckpoints(session.id);
      const fromId=String(req.query.from ?? '');
      const toId=String(req.query.to ?? '');
      const from=fromId?checkpoints.find(c=>c.id===fromId):null;
      const to=toId?checkpoints.find(c=>c.id===toId):null;
      if(!from||!to||!from.commitSha||!to.commitSha)return res.status(400).json({error:'from and to must reference checkpoints with commits from this session'});
      const workspace=session.workspacePath || repoPath(session.id);
      const diff=gitDiff(workspace,from.commitSha,to.commitSha);
      return res.json({from,to,diff,truncated:diff.length>=200000});
    } catch(e){return next(e);}
  });

  app.post('/prototype/sessions/:id/comparison-previews',async(req,res,next)=>{
    try {
      const session=await prototypes.getSession(req.params.id); if(!session)return res.sendStatus(404);
      const checkpointId=String(req.body?.checkpointId ?? '');
      const checkpoint=(await prototypes.listCheckpoints(session.id)).find(c=>c.id===checkpointId);
      if(!checkpoint||!checkpoint.commitSha)return res.status(400).json({error:'checkpointId must reference a committed checkpoint from this session'});
      if(!session.workspacePath)return res.status(409).json({error:'Prototype workspace is not available'});
      const comparison=await comparisonPreviews.create({
        sessionId:session.id,
        checkpointId:checkpoint.id,
        repositoryWorkspace:session.workspacePath,
        commitSha:checkpoint.commitSha,
        command:previewCommand,
        args:previewArgs,
        publicBaseUrl:previewPublicBaseUrl,
      });
      prototypeEvents.emit({sessionId:session.id,type:'PREVIEW_READY',payload:{kind:'comparison',checkpointId:checkpoint.id,url:comparison.info.url,runtimeId:comparison.runtimeId,comparisonId:comparison.id}});
      return res.status(201).json(comparison);
    } catch(e){return next(e);}
  });

  app.get('/prototype/sessions/:id/comparison-previews/:previewId',async(req,res,next)=>{
    try { const comparison=await comparisonPreviews.get(req.params.previewId); if(!comparison||comparison.sessionId!==req.params.id)return res.sendStatus(404); return res.json(comparison); } catch(e){return next(e); }
  });

  app.delete('/prototype/sessions/:id/comparison-previews/:previewId',async(req,res,next)=>{
    try { const session=await prototypes.getSession(req.params.id); if(!session)return res.sendStatus(404); const comparison=await comparisonPreviews.get(req.params.previewId); if(!comparison||comparison.sessionId!==session.id)return res.sendStatus(404); await comparisonPreviews.destroy(comparison.id,session.workspacePath ?? repoPath(session.id)); return res.sendStatus(204); } catch(e){return next(e); }
  });

  app.post('/prototype/sessions/:id/checkpoints',async(req,res,next)=>{
    try { const session=await prototypes.getSession(req.params.id); if(!session)return res.sendStatus(404); const {promptIndex,prompt,commitSha,previewUrl,buildPassed}=req.body??{};
      if(!Number.isInteger(promptIndex)||promptIndex<1||typeof prompt!=='string')return res.status(400).json({error:'promptIndex and prompt are required'});
      const checkpoint=await prototypes.createCheckpoint({sessionId:session.id,promptIndex,prompt,commitSha:commitSha??null,previewUrl:previewUrl??null,buildPassed:buildPassed===true});
      const updated=await prototypes.updateSession(session.id,{lastCheckpointSha:checkpoint.commitSha,previewUrl:checkpoint.previewUrl,status:checkpoint.buildPassed?'READY':'FAILED'});
      prototypeEvents.emit({sessionId:session.id,type:'CHECKPOINT_CREATED',payload:checkpoint as unknown as Record<string,unknown>});
      if(updated)prototypeEvents.emit({sessionId:session.id,type:checkpoint.buildPassed?'PREVIEW_READY':'PREVIEW_FAILED',payload:{previewUrl:updated.previewUrl,buildPassed:checkpoint.buildPassed}});
      return res.status(201).json(checkpoint);
    } catch(e){return next(e);
    }
  });

  app.post('/prototype/sessions/:id/promote', async (req, res, next) => {
    try {
      const input: PrototypeHandoffInput = {
        sessionId: req.params.id,
        objective: req.body?.objective,
        prompt: req.body?.prompt,
        priority: req.body?.priority,
      };

      const result = await handoff.execute(input);
      return res.status(200).json({
        session: result.session,
        promotion: result.promotion,
        task: result.task,
        mode: result.mode,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.startsWith('NOT_FOUND:')) {
        return res.sendStatus(404);
      }
      if (message.startsWith('CONFLICT:')) {
        return res.status(409).json({ error: message.replace(/^CONFLICT:\s*/, '') });
      }
      return next(e);
    }
  });
  return app;
};

if(process.argv[1]?.endsWith('api.ts')||process.argv[1]?.endsWith('api.js')){const port=Number(process.env.PORT??3000);createApp().listen(port,()=>console.log(`API listening on ${port}`));}
