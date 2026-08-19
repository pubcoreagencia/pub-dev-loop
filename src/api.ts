import 'dotenv/config';
import express from 'express';
import { Pool } from 'pg';
import { PostgresTaskRepository } from './repository.js';
import { PostgresPrototypeRepository } from './prototype/repository.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const createApp = (
  tasks = new PostgresTaskRepository(pool),
  prototypes = new PostgresPrototypeRepository(pool),
) => {
  const app = express();
  app.use(express.json());

  app.get('/health', (_q, res) => res.json({ status: 'ok' }));

  app.post('/tasks', async (req, res, next) => {
    try {
      const { project, repository, objective, prompt, priority } = req.body ?? {};
      if (!project || !repository || !objective || !prompt) {
        return res.status(400).json({ error: 'project, repository, objective and prompt are required' });
      }
      return res.status(201).json(await tasks.create({ project, repository, objective, prompt, priority }));
    } catch (e) {
      return next(e);
    }
  });

  app.get('/tasks', async (_q, res, next) => {
    try { return res.json(await tasks.list()); } catch (e) { return next(e); }
  });

  app.get('/tasks/:id', async (req, res, next) => {
    try {
      const t = await tasks.get(req.params.id);
      return t ? res.json(t) : res.sendStatus(404);
    } catch (e) {
      return next(e);
    }
  });

  app.post('/tasks/:id/cancel', async (req, res, next) => {
    try {
      const t = await tasks.cancel(req.params.id);
      return t ? res.json(t) : res.status(409).json({ error: 'Task cannot be cancelled' });
    } catch (e) {
      return next(e);
    }
  });

  app.post('/tasks/:id/retry', async (req, res, next) => {
    try {
      const t = await tasks.retry(req.params.id);
      return t ? res.json(t) : res.status(409).json({ error: 'Task cannot be retried' });
    } catch (e) {
      return next(e);
    }
  });

  // PUB Prototype API ------------------------------------------------------
  app.post('/prototype/sessions', async (req, res, next) => {
    try {
      const { project, repository, branch } = req.body ?? {};
      if (!project || !repository) {
        return res.status(400).json({ error: 'project and repository are required' });
      }
      return res.status(201).json(await prototypes.createSession({ project, repository, branch }));
    } catch (e) {
      return next(e);
    }
  });

  app.get('/prototype/sessions', async (_req, res, next) => {
    try { return res.json(await prototypes.listSessions()); } catch (e) { return next(e); }
  });

  app.get('/prototype/sessions/:id', async (req, res, next) => {
    try {
      const session = await prototypes.getSession(req.params.id);
      if (!session) return res.sendStatus(404);
      const checkpoints = await prototypes.listCheckpoints(session.id);
      return res.json({ session, checkpoints });
    } catch (e) {
      return next(e);
    }
  });

  app.patch('/prototype/sessions/:id', async (req, res, next) => {
    try {
      const allowed = ['status', 'mode', 'previewUrl', 'previewRuntime', 'lastCheckpointSha'] as const;
      const patch = Object.fromEntries(
        allowed.filter(key => req.body?.[key] !== undefined).map(key => [key, req.body[key]]),
      );
      const session = await prototypes.updateSession(req.params.id, patch);
      return session ? res.json(session) : res.sendStatus(404);
    } catch (e) {
      return next(e);
    }
  });

  app.post('/prototype/sessions/:id/prompts', async (req, res, next) => {
    try {
      const session = await prototypes.getSession(req.params.id);
      if (!session) return res.sendStatus(404);
      const { objective, prompt, priority } = req.body ?? {};
      if (!objective || !prompt) {
        return res.status(400).json({ error: 'objective and prompt are required' });
      }

      const updated = await prototypes.incrementPromptCount(session.id);
      if (!updated) return res.sendStatus(409);

      const task = await tasks.create({
        project: updated.project,
        repository: updated.repository,
        objective,
        prompt,
        priority: priority ?? 0,
      });

      return res.status(202).json({ session: updated, task, mode: 'PROTOTYPE' });
    } catch (e) {
      return next(e);
    }
  });

  app.post('/prototype/sessions/:id/checkpoints', async (req, res, next) => {
    try {
      const session = await prototypes.getSession(req.params.id);
      if (!session) return res.sendStatus(404);
      const { promptIndex, prompt, commitSha, previewUrl, buildPassed } = req.body ?? {};
      if (!Number.isInteger(promptIndex) || promptIndex < 1 || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'promptIndex and prompt are required' });
      }
      const checkpoint = await prototypes.createCheckpoint({
        sessionId: session.id,
        promptIndex,
        prompt,
        commitSha: commitSha ?? null,
        previewUrl: previewUrl ?? null,
        buildPassed: buildPassed === true,
      });
      await prototypes.updateSession(session.id, {
        lastCheckpointSha: checkpoint.commitSha,
        previewUrl: checkpoint.previewUrl,
        status: checkpoint.buildPassed ? 'READY' : 'FAILED',
      });
      return res.status(201).json(checkpoint);
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
