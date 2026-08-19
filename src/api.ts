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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prototypeEvents = new PrototypeEventStream();
const prototypeEventBridge = new PostgresPrototypeEventBridge(pool, prototypeEvents);
const prototypeSse = new PrototypeSseBroker();
prototypeEvents.subscribe(event => prototypeSse.publish(event));
void prototypeEventBridge.start().catch(error => console.error('Prototype event bridge failed:', error));

const defaultPrototypeRepository = process.env.PROTOTYPE_TEMPLATE_REPOSITORY ?? 'https://github.com/pubcoreagencia/pub-dev-loop-template.git';
const prototypeWorkspaceRoot = process.env.PROTOTYPE_WORKSPACES_ROOT ?? '/tmp/pub-prototype';

const repoPath = (sessionId: string) => path.join(prototypeWorkspaceRoot, sessionId);
function gitDiff(cwd: string, base: string, head: string): string {
  return execFileSync('git', ['diff', '--no-ext-diff', '--unified=3', base, head], { cwd, encoding: 'utf8', maxBuffer: 250_000 }).slice(0, 200_000);
}

export const createApp = (tasks = new PostgresTaskRepository(pool), prototypes = new PostgresPrototypeRepository(pool)) => {
  const app = express(); app.use(express.json());
  app.get('/health', (_q,res)=>res.json({status:'ok'}));
  app.get('/prototype', (_req,res)=>res.status(200).type('html').send(prototypeUiHtml()));

  app.post('/tasks', async(req,res,next)=>{ try { const {project,repository,objective,prompt,priority}=req.body??{}; if(!project||!repository||!objective||!prompt)return res.status(400).json({error:'project, repository, objective and prompt are required'}); return res.status(201).json(await tasks.create({project,repository,objective,prompt,priority})); } catch(e){return next(e);} });
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
  app.get('/prototype/sessions/:id',async(req,res,next)=>{try{const session=await prototypes.getSession(req.params.id);if(!session)return res.sendStatus(404);return res.json({session,checkpoints:await prototypes.listCheckpoints(session.id)})}catch(e){return next(e)}});
  app.get('/prototype/sessions/:id/events',async(req,res,next)=>{
    try { const session=await prototypes.getSession(req.params.id); if(!session)return res.sendStatus(404);
      res.status(200); res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache, no-transform'); res.setHeader('Connection','keep-alive'); res.flushHeaders?.();
      const unsubscribe=prototypeSse.subscribe(session.id,res); const heartbeat=setInterval(()=>prototypeSse.heartbeat(session.id),15000); req.on('close',()=>{clearInterval(heartbeat);unsubscribe();}); res.write(': connected\n\n');
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

  app.post('/prototype/sessions/:id/checkpoints',async(req,res,next)=>{
    try { const session=await prototypes.getSession(req.params.id); if(!session)return res.sendStatus(404); const {promptIndex,prompt,commitSha,previewUrl,buildPassed}=req.body??{};
      if(!Number.isInteger(promptIndex)||promptIndex<1||typeof prompt!=='string')return res.status(400).json({error:'promptIndex and prompt are required'});
      const checkpoint=await prototypes.createCheckpoint({sessionId:session.id,promptIndex,prompt,commitSha:commitSha??null,previewUrl:previewUrl??null,buildPassed:buildPassed===true});
      const updated=await prototypes.updateSession(session.id,{lastCheckpointSha:checkpoint.commitSha,previewUrl:checkpoint.previewUrl,status:checkpoint.buildPassed?'READY':'FAILED'});
      prototypeEvents.emit({sessionId:session.id,type:'CHECKPOINT_CREATED',payload:checkpoint as unknown as Record<string,unknown>});
      if(updated)prototypeEvents.emit({sessionId:session.id,type:checkpoint.buildPassed?'PREVIEW_READY':'PREVIEW_FAILED',payload:{previewUrl:updated.previewUrl,buildPassed:checkpoint.buildPassed}});
      return res.status(201).json(checkpoint);
    } catch(e){return next(e);}
  });
  return app;
};

if(process.argv[1]?.endsWith('api.ts')||process.argv[1]?.endsWith('api.js')){const port=Number(process.env.PORT??3000);createApp().listen(port,()=>console.log(`API listening on ${port}`));}
