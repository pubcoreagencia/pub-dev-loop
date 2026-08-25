import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
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
import { validateWorkspacePath } from './prototype/validation.js';

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
  .split(' ').filter(Boolean);
const previewPublicBaseUrl = process.env.PROTOTYPE_PREVIEW_BASE_URL || undefined;

const repoPath = (sessionId: string) => path.join(prototypeWorkspaceRoot, sessionId);

function gitDiff(cwd: string, base: string, head: string): string {
  return execFileSync('git', ['diff', '--no-ext-diff', '--unified=3', base, head], { cwd, encoding: 'utf8', maxBuffer: 250_000 }).slice(0, 200_000);
}

function extractApiKey(req: Request): string | null {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const xApiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
  if (typeof xApiKey === 'string') {
    return xApiKey.trim();
  }
  // Query param apiKey for SSE EventSource connections in browsers
  const queryKey = req.query.apiKey || req.query.api_key;
  if (typeof queryKey === 'string') {
    return queryKey.trim();
  }
  return null;
}

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expectedApiKey = process.env.PUB_DEV_LOOP_API_KEY?.trim();
  if (expectedApiKey) {
    const providedApiKey = extractApiKey(req);
    if (!providedApiKey || providedApiKey !== expectedApiKey) {
      res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
      return;
    }
  }
  next();
}

export const createApp = (tasks = new PostgresTaskRepository(pool), prototypes = new PostgresPrototypeRepository(pool)) => {
  const app = express();
  app.use(express.json());

  app.get('/health', (_q, res) => res.json({ status: 'ok' }));
  app.get('/prototype', (_req, res) => res.status(200).type('html').send(prototypeUiHtml() + prototypeHistoryUiScript()));

  // Classical PDL Task routes
  app.post('/tasks', requireApiKey, async (req, res, next) => {
    try {
      const { project, repository, objective, prompt, priority } = req.body ?? {};
      if (!project || !repository || !objective || !prompt) return res.status(400).json({ error: 'project, repository, objective and prompt are required' });
      return res.status(201).json(await tasks.create({ project, repository, objective, prompt, priority }));
    } catch (e) { return next(e); }
  });
  app.get('/tasks', requireApiKey, async (_q, res, next) => { try { return res.json(await tasks.list()); } catch (e) { return next(e); } });
  app.get('/tasks/:id', requireApiKey, async (req, res, next) => { try { const t = await tasks.get(String(req.params.id)); return t ? res.json(t) : res.sendStatus(404); } catch (e) { return next(e); } });
  app.post('/tasks/:id/cancel', requireApiKey, async (req, res, next) => { try { const t = await tasks.cancel(String(req.params.id)); return t ? res.json(t) : res.status(409).json({ error: 'Task cannot be cancelled' }); } catch (e) { return next(e); } });
  app.post('/tasks/:id/retry', requireApiKey, async (req, res, next) => { try { const t = await tasks.retry(String(req.params.id)); return t ? res.json(t) : res.status(409).json({ error: 'Task cannot be retried' }); } catch (e) { return next(e); } });

  // PUB Prototype API endpoints - protected by requireApiKey
  app.post('/prototype/sessions', requireApiKey, async (req, res, next) => {
    try {
      const { project, repository, branch } = req.body ?? {};
      if (!project) return res.status(400).json({ error: 'project is required' });
      const session = await prototypes.createSession({ project, repository: repository || defaultPrototypeRepository, branch });
      prototypeEvents.emit({ sessionId: session.id, type: 'PREVIEW_STARTED', payload: { phase: 'session_created', repository: session.repository } });
      return res.status(201).json(session);
    } catch (e) { return next(e); }
  });

  app.get('/prototype/sessions', requireApiKey, async (_req, res, next) => { try { return res.json(await prototypes.listSessions()); } catch (e) { return next(e); } });

  app.get('/prototype/sessions/:id', requireApiKey, async (req, res, next) => {
    try {
      const session = await prototypes.getSession(String(req.params.id));
      if (!session) return res.sendStatus(404);
      return res.json({ session, checkpoints: await prototypes.listCheckpoints(session.id) });
    } catch (e) { return next(e); }
  });

  app.get('/prototype/sessions/:id/events', requireApiKey, async (req, res, next) => {
    try {
      const session = await prototypes.getSession(String(req.params.id));
      if (!session) return res.sendStatus(404);
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      const unsubscribe = prototypeSse.subscribe(session.id, res);
      const heartbeat = setInterval(() => prototypeSse.heartbeat(session.id), 15000);
      req.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
      res.write(': connected\n\n');
    } catch (e) { return next(e); }
  });

  app.patch('/prototype/sessions/:id', requireApiKey, async (req, res, next) => {
    try {
      const allowed = ['status', 'mode', 'previewUrl', 'previewRuntime', 'workspacePath', 'lastCheckpointSha'] as const;
      const patch = Object.fromEntries(allowed.filter(k => req.body?.[k] !== undefined).map(k => [k, req.body[k]]));
      if (typeof patch.workspacePath === 'string') {
        try {
          patch.workspacePath = validateWorkspacePath(patch.workspacePath, prototypeWorkspaceRoot);
        } catch (valErr: any) {
          return res.status(400).json({ error: valErr.message });
        }
      }
      const session = await prototypes.updateSession(String(req.params.id), patch);
      if (!session) return res.sendStatus(404);
      const eventType = patch.status === 'READY' ? 'PREVIEW_READY' : patch.status === 'FAILED' ? 'ERROR' : null;
      if (eventType) prototypeEvents.emit({ sessionId: session.id, type: eventType, payload: { status: session.status, previewUrl: session.previewUrl } });
      return res.json(session);
    } catch (e) { return next(e); }
  });

  app.post('/prototype/sessions/:id/prompts', requireApiKey, async (req, res, next) => {
    try {
      const session = await prototypes.getSession(String(req.params.id));
      if (!session) return res.sendStatus(404);
      const { objective = 'Prototype MVP iteration', prompt, priority } = req.body ?? {};
      if (!prompt) return res.status(400).json({ error: 'prompt is required' });
      if (['BUILDING', 'PREVIEWING'].includes(session.status)) return res.status(409).json({ error: 'Prototype session is already processing a prompt' });
      const updated = await prototypes.incrementPromptCount(session.id);
      if (!updated) return res.sendStatus(409);
      prototypeEvents.emit({ sessionId: updated.id, type: 'USER_PROMPT', payload: { prompt, promptIndex: updated.promptCount, objective } });
      const task = await tasks.create({ project: updated.project, repository: updated.repository, objective, prompt, priority: priority ?? 0, prototypeSessionId: updated.id });
      await tasks.update(task.id, { branch: updated.branch, workspacePath: path.join(prototypeWorkspaceRoot, updated.id) });
      prototypeEvents.emit({ sessionId: updated.id, type: 'AGENT_STARTED', payload: { taskId: task.id } });
      return res.status(202).json({ session: updated, task, mode: 'PROTOTYPE' });
    } catch (e) { return next(e); }
  });

  app.get('/prototype/sessions/:id/diff', requireApiKey, async (req, res, next) => {
    try {
      const session = await prototypes.getSession(String(req.params.id));
      if (!session) return res.sendStatus(404);
      const checkpoints = await prototypes.listCheckpoints(session.id);
      const fromId = String(req.query.from ?? '');
      const toId = String(req.query.to ?? '');
      const from = fromId ? checkpoints.find(c => c.id === fromId) : null;
      const to = toId ? checkpoints.find(c => c.id === toId) : null;
      if (!from || !to || !from.commitSha || !to.commitSha) return res.status(400).json({ error: 'from and to must reference checkpoints with commits from this session' });
      const rawWorkspace = session.workspacePath || repoPath(session.id);
      let workspace: string;
      try {
        workspace = validateWorkspacePath(rawWorkspace, prototypeWorkspaceRoot);
      } catch (valErr: any) {
        return res.status(400).json({ error: valErr.message });
      }
      const diff = gitDiff(workspace, from.commitSha, to.commitSha);
      return res.json({ from, to, diff, truncated: diff.length >= 200000 });
    } catch (e) { return next(e); }
  });

  app.post('/prototype/sessions/:id/comparison-previews', requireApiKey, async (req, res, next) => {
    try {
      const session = await prototypes.getSession(String(req.params.id));
      if (!session) return res.sendStatus(404);
      const checkpointId = String(req.body?.checkpointId ?? '');
      const checkpoint = (await prototypes.listCheckpoints(session.id)).find(c => c.id === checkpointId);
      if (!checkpoint || !checkpoint.commitSha) return res.status(400).json({ error: 'checkpointId must reference a committed checkpoint from this session' });
      if (!session.workspacePath) return res.status(409).json({ error: 'Prototype workspace is not available' });
      let validatedWorkspace: string;
      try {
        validatedWorkspace = validateWorkspacePath(session.workspacePath, prototypeWorkspaceRoot);
      } catch (valErr: any) {
        return res.status(400).json({ error: valErr.message });
      }
      const comparison = await comparisonPreviews.create({
        sessionId: session.id,
        checkpointId: checkpoint.id,
        repositoryWorkspace: validatedWorkspace,
        commitSha: checkpoint.commitSha,
        command: previewCommand,
        args: previewArgs,
        publicBaseUrl: previewPublicBaseUrl,
      });
      prototypeEvents.emit({ sessionId: session.id, type: 'PREVIEW_READY', payload: { kind: 'comparison', checkpointId: checkpoint.id, url: comparison.info.url, runtimeId: comparison.runtimeId, comparisonId: comparison.id } });
      return res.status(201).json(comparison);
    } catch (e) { return next(e); }
  });

  app.get('/prototype/sessions/:id/comparison-previews/:previewId', requireApiKey, async (req, res, next) => {
    try {
      const comparison = await comparisonPreviews.get(String(req.params.previewId));
      if (!comparison || comparison.sessionId !== String(req.params.id)) return res.sendStatus(404);
      return res.json(comparison);
    } catch (e) { return next(e); }
  });

  app.delete('/prototype/sessions/:id/comparison-previews/:previewId', requireApiKey, async (req, res, next) => {
    try {
      const session = await prototypes.getSession(String(req.params.id));
      if (!session) return res.sendStatus(404);
      const comparison = await comparisonPreviews.get(String(req.params.previewId));
      if (!comparison || comparison.sessionId !== session.id) return res.sendStatus(404);
      const repoWorkspace = session.workspacePath ?? repoPath(session.id);
      const validatedWorkspace = validateWorkspacePath(repoWorkspace, prototypeWorkspaceRoot);
      await comparisonPreviews.destroy(comparison.id, validatedWorkspace);
      return res.sendStatus(204);
    } catch (e) { return next(e); }
  });

  app.post('/prototype/sessions/:id/checkpoints', requireApiKey, async (req, res, next) => {
    try {
      const session = await prototypes.getSession(String(req.params.id));
      if (!session) return res.sendStatus(404);
      const { promptIndex, prompt, commitSha, previewUrl, buildPassed } = req.body ?? {};
      if (!Number.isInteger(promptIndex) || promptIndex < 1 || typeof prompt !== 'string') return res.status(400).json({ error: 'promptIndex and prompt are required' });
      const checkpoint = await prototypes.createCheckpoint({ sessionId: session.id, promptIndex, prompt, commitSha: commitSha ?? null, previewUrl: previewUrl ?? null, buildPassed: buildPassed === true });
      const updated = await prototypes.updateSession(session.id, { lastCheckpointSha: checkpoint.commitSha, previewUrl: checkpoint.previewUrl, status: checkpoint.buildPassed ? 'READY' : 'FAILED' });
      prototypeEvents.emit({ sessionId: session.id, type: 'CHECKPOINT_CREATED', payload: checkpoint as unknown as Record<string, unknown> });
      if (updated) prototypeEvents.emit({ sessionId: session.id, type: checkpoint.buildPassed ? 'PREVIEW_READY' : 'PREVIEW_FAILED', payload: { previewUrl: updated.previewUrl, buildPassed: checkpoint.buildPassed } });
      return res.status(201).json(checkpoint);
    } catch (e) { return next(e); }
  });

  app.post('/prototype/sessions/:id/restore/:checkpointId', requireApiKey, async (req, res, next) => {
    try {
      const session = await prototypes.getSession(String(req.params.id));
      if (!session) return res.sendStatus(404);
      const checkpoints = await prototypes.listCheckpoints(session.id);
      const checkpoint = checkpoints.find(c => c.id === String(req.params.checkpointId));
      if (!checkpoint || !checkpoint.commitSha) return res.status(400).json({ error: 'checkpoint must reference a committed checkpoint' });
      if (['BUILDING', 'PREVIEWING'].includes(session.status)) return res.status(409).json({ error: 'Prototype session is already processing' });
      const updated = await prototypes.incrementPromptCount(session.id);
      if (!updated) return res.sendStatus(409);
      const restoreObjective = '__PP_RESTORE_CHECKPOINT__';
      const restorePayload = JSON.stringify({ commitSha: checkpoint.commitSha, checkpointId: checkpoint.id });
      const task = await tasks.create({ project: updated.project, repository: updated.repository, objective: restoreObjective, prompt: restorePayload, priority: 1, prototypeSessionId: updated.id });
      await tasks.update(task.id, { branch: updated.branch, workspacePath: path.join(prototypeWorkspaceRoot, updated.id) });
      prototypeEvents.emit({ sessionId: updated.id, type: 'AGENT_STARTED', payload: { taskId: task.id, phase: 'restore' } });
      return res.status(202).json({ session: updated, task, mode: 'PROTOTYPE' });
    } catch (e) { return next(e); }
  });

  app.post('/prototype/sessions/:id/promote', requireApiKey, async (req, res, next) => {
    try {
      const session = await prototypes.getSession(String(req.params.id));
      if (!session) return res.sendStatus(404);

      if (!['READY', 'APPROVED'].includes(session.status)) {
        return res.status(409).json({ error: `Session in status ${session.status} cannot be promoted. Must be READY or APPROVED.` });
      }

      if (!session.lastCheckpointSha) {
        return res.status(409).json({ error: 'Session must have a valid lastCheckpointSha to be promoted' });
      }

      if (!session.branch || !session.repository) {
        return res.status(409).json({ error: 'Session must have repository and branch configured' });
      }

      const updated = await prototypes.promoteSession(session.id);
      if (!updated) {
        return res.status(409).json({ error: 'Session already promoted or status conflict' });
      }

      const promotion = await prototypes.createPromotion({
        sessionId: updated.id,
        fromMode: 'PROTOTYPE',
        toMode: 'DEVELOPMENT',
        repository: updated.repository,
        branch: updated.branch,
        checkpointSha: updated.lastCheckpointSha!,
        promotedAt: new Date(),
      });

      const {
        objective = `Development handoff from Prototype ${updated.project}`,
        prompt = `Continuar desenvolvimento a partir do protótipo aprovado (${updated.branch} @ ${updated.lastCheckpointSha})`,
        priority = 0,
      } = req.body ?? {};

      // Create Development Task with prototypeSessionId = null
      const devTask = await tasks.create({
        project: updated.project,
        repository: updated.repository,
        objective,
        prompt,
        priority,
      });

      await tasks.update(devTask.id, {
        branch: updated.branch,
      });

      prototypeEvents.emit({
        sessionId: updated.id,
        type: 'PROMOTED_TO_DEVELOPMENT',
        payload: {
          sessionId: updated.id,
          promotionId: promotion.id,
          taskId: devTask.id,
          branch: updated.branch,
          checkpointSha: updated.lastCheckpointSha,
          repository: updated.repository,
        },
      });

      return res.status(200).json({
        session: updated,
        promotion,
        task: devTask,
        mode: 'DEVELOPMENT',
      });
    } catch (e) {
      return next(e);
    }
  });

  return app;
};

if (process.argv[1]?.endsWith('api.ts') || process.argv[1]?.endsWith('api.js')) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(`API listening on ${port}`));
}

