import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { CreatePrototypeSession, PrototypeCheckpoint, PrototypeSession, PrototypeSessionStatus, PrototypeMode, PrototypePromotion, PrototypeMessage } from './domain.js';

const mapSession = (r: Record<string, unknown>): PrototypeSession => ({
  id: r.id as string,
  project: r.project as string,
  repository: r.repository as string,
  branch: r.branch as string,
  mode: r.mode as PrototypeMode,
  status: r.status as PrototypeSessionStatus,
  previewUrl: r.preview_url as string | null,
  previewRuntime: r.preview_runtime as string | null,
  workspacePath: r.workspace_path as string | null,
  lastCheckpointSha: r.last_checkpoint_sha as string | null,
  promptCount: r.prompt_count as number,
  createdAt: r.created_at as Date,
  updatedAt: r.updated_at as Date,
});

const mapCheckpoint = (r: Record<string, unknown>): PrototypeCheckpoint => ({
  id: r.id as string, sessionId: r.session_id as string, promptIndex: r.prompt_index as number,
  prompt: r.prompt as string, commitSha: r.commit_sha as string | null,
  previewUrl: r.preview_url as string | null, buildPassed: r.build_passed as boolean, createdAt: r.created_at as Date,
});

const mapPromotion = (r: Record<string, unknown>): PrototypePromotion => ({
  id: r.id as string,
  sessionId: r.session_id as string,
  fromMode: r.from_mode as Extract<PrototypeMode, 'PROTOTYPE'>,
  toMode: r.to_mode as Extract<PrototypeMode, 'DEVELOPMENT'>,
  repository: r.repository as string,
  branch: r.branch as string,
  checkpointSha: r.checkpoint_sha as string | null,
  promotedAt: r.promoted_at as Date,
});

const mapMessage = (r: Record<string, unknown>): PrototypeMessage => ({
  id: r.id as string,
  sessionId: r.session_id as string,
  taskId: r.task_id as string | undefined,
  role: r.role as any,
  content: r.content as string,
  createdAt: r.created_at as Date,
  order: Number(r.order),
});

export interface PrototypeRepository {
  createSession(input: CreatePrototypeSession): Promise<PrototypeSession>;
  getSession(id: string): Promise<PrototypeSession | null>;
  listSessions(): Promise<PrototypeSession[]>;
  updateSession(id: string, patch: Partial<Pick<PrototypeSession,'status'|'mode'|'previewUrl'|'previewRuntime'|'workspacePath'|'lastCheckpointSha'>>): Promise<PrototypeSession | null>;
  incrementPromptCount(id: string): Promise<PrototypeSession | null>;
  promoteSession(id: string): Promise<PrototypeSession | null>;
  createCheckpoint(input: Omit<PrototypeCheckpoint,'id'|'createdAt'>): Promise<PrototypeCheckpoint>;
  listCheckpoints(sessionId: string): Promise<PrototypeCheckpoint[]>;
  createPromotion(input: Omit<PrototypePromotion, 'id'>): Promise<PrototypePromotion>;
  getPromotion(sessionId: string): Promise<PrototypePromotion | null>;
  addMessage(msg: PrototypeMessage): Promise<PrototypeMessage>;
  listMessages(sessionId: string): Promise<PrototypeMessage[]>;
  nextMessageOrder(sessionId: string): Promise<number>;

}

// Sovereign in-memory fallback store to ensure zero downtime when database quota is reached
const fallbackSessions = new Map<string, PrototypeSession>();
const fallbackCheckpoints = new Map<string, PrototypeCheckpoint[]>();
const fallbackPromotions = new Map<string, PrototypePromotion>();
const fallbackMessages = new Map<string, PrototypeMessage[]>();

const defaultSessionId = '00000000-0000-0000-0000-000000000001';
fallbackSessions.set(defaultSessionId, {
  id: defaultSessionId,
  project: 'pub-neural-os',
  repository: 'https://github.com/pubcoreagencia/pub-dev-loop-prototypes.git',
  branch: 'prototype/pub-neural-os/' + defaultSessionId,
  mode: 'PROTOTYPE',
  status: 'READY',
  previewUrl: null,
  previewRuntime: null,
  workspacePath: null,
  lastCheckpointSha: null,
  promptCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

export class PostgresPrototypeRepository implements PrototypeRepository {
  constructor(private readonly pool: Pool) {}

  async createSession(input: CreatePrototypeSession): Promise<PrototypeSession> {
    const id = randomUUID();
    const sanitizedProject = input.project.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const branch = input.branch ?? `prototype/${sanitizedProject || 'untitled'}/${id}`;
    try {
      const result = await this.pool.query(
        `INSERT INTO prototype_sessions (id, project, repository, branch) VALUES ($1,$2,$3,$4) RETURNING *`,
        [id, input.project, input.repository, branch]
      );
      if (result?.rows?.[0]) {
        const session = mapSession(result.rows[0]);
        fallbackSessions.set(session.id, session);
        return session;
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on createSession, using sovereign memory:', err.message);
    }
    const session: PrototypeSession = {
      id,
      project: input.project,
      repository: input.repository,
      branch,
      mode: 'PROTOTYPE',
      status: 'CREATING',
      previewUrl: null,
      previewRuntime: null,
      workspacePath: null,
      lastCheckpointSha: null,
      promptCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    fallbackSessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<PrototypeSession | null> {
    try {
      const r = await this.pool.query(`SELECT * FROM prototype_sessions WHERE id=$1`, [id]);
      if (r?.rows?.[0]) {
        const session = mapSession(r.rows[0]);
        fallbackSessions.set(session.id, session);
        return session;
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on getSession:', err.message);
    }
    return fallbackSessions.get(id) || null;
  }

  async listSessions(): Promise<PrototypeSession[]> {
    try {
      const r = await this.pool.query(`SELECT * FROM prototype_sessions ORDER BY updated_at DESC`);
      if (r?.rows) {
        const dbSessions = r.rows.map(mapSession);
        for (const s of dbSessions) {
          fallbackSessions.set(s.id, s);
        }
        return Array.from(fallbackSessions.values()).sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on listSessions:', err.message);
    }
    return Array.from(fallbackSessions.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async updateSession(id: string, patch: Partial<Pick<PrototypeSession, 'status' | 'mode' | 'previewUrl' | 'previewRuntime' | 'workspacePath' | 'lastCheckpointSha'>>): Promise<PrototypeSession | null> {
    try {
      const fields: Record<string, string> = { status: 'status', mode: 'mode', previewUrl: 'preview_url', previewRuntime: 'preview_runtime', workspacePath: 'workspace_path', lastCheckpointSha: 'last_checkpoint_sha' };
      const values: unknown[] = [];
      const set: string[] = [];
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        set.push(`${fields[key]}=$${values.length + 1}`);
        values.push(value);
      }
      if (set.length > 0) {
        values.push(id);
        const r = await this.pool.query(`UPDATE prototype_sessions SET ${set.join(',')}, updated_at=now() WHERE id=$${values.length} RETURNING *`, values);
        if (r?.rows?.[0]) {
          const session = mapSession(r.rows[0]);
          fallbackSessions.set(session.id, session);
          return session;
        }
      } else {
        return this.getSession(id);
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on updateSession:', err.message);
    }
    const current = fallbackSessions.get(id);
    if (!current) return null;
    const updated: PrototypeSession = {
      ...current,
      ...patch,
      updatedAt: new Date(),
    };
    fallbackSessions.set(id, updated);
    return updated;
  }

  async incrementPromptCount(id: string): Promise<PrototypeSession | null> {
    try {
      const r = await this.pool.query(`UPDATE prototype_sessions
        SET prompt_count=prompt_count+1,status='BUILDING',updated_at=now()
        WHERE id=$1 AND status IN ('CREATING','READY','FAILED')
        RETURNING *`, [id]);
      if (r?.rows) {
        if (r.rows[0]) {
          const session = mapSession(r.rows[0]);
          fallbackSessions.set(session.id, session);
          return session;
        }
        return null;
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on incrementPromptCount:', err.message);
    }
    const current = fallbackSessions.get(id);
    if (!current) return null;
    if (!['CREATING', 'READY', 'FAILED'].includes(current.status)) return null;
    const updated: PrototypeSession = {
      ...current,
      promptCount: (current.promptCount || 0) + 1,
      status: 'BUILDING',
      updatedAt: new Date(),
    };
    fallbackSessions.set(id, updated);
    return updated;
  }

  async promoteSession(id: string): Promise<PrototypeSession | null> {
    try {
      const r = await this.pool.query(`UPDATE prototype_sessions
        SET mode='DEVELOPMENT', status='PROMOTED', updated_at=now()
        WHERE id=$1 AND status IN ('READY','APPROVED') AND last_checkpoint_sha IS NOT NULL
        RETURNING *`, [id]);
      if (r?.rows) {
        if (r.rows[0]) {
          const session = mapSession(r.rows[0]);
          fallbackSessions.set(session.id, session);
          return session;
        }
        return null;
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on promoteSession:', err.message);
    }
    const current = fallbackSessions.get(id);
    if (!current) return null;
    if (!['READY', 'APPROVED'].includes(current.status) || !current.lastCheckpointSha) return null;
    const updated: PrototypeSession = {
      ...current,
      mode: 'DEVELOPMENT',
      status: 'PROMOTED',
      updatedAt: new Date(),
    };
    fallbackSessions.set(id, updated);
    return updated;
  }

  async createCheckpoint(input: Omit<PrototypeCheckpoint, 'id' | 'createdAt'>): Promise<PrototypeCheckpoint> {
    const id = randomUUID();
    try {
      const r = await this.pool.query(
        `INSERT INTO prototype_checkpoints (id,session_id,prompt_index,prompt,commit_sha,preview_url,build_passed) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, input.sessionId, input.promptIndex, input.prompt, input.commitSha, input.previewUrl, input.buildPassed]
      );
      if (r?.rows?.[0]) {
        const cp = mapCheckpoint(r.rows[0]);
        const list = fallbackCheckpoints.get(input.sessionId) || [];
        list.unshift(cp);
        fallbackCheckpoints.set(input.sessionId, list);
        return cp;
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on createCheckpoint:', err.message);
    }
    const checkpoint: PrototypeCheckpoint = {
      id,
      sessionId: input.sessionId,
      promptIndex: input.promptIndex,
      prompt: input.prompt,
      commitSha: input.commitSha,
      previewUrl: input.previewUrl,
      buildPassed: input.buildPassed,
      createdAt: new Date(),
    };
    const list = fallbackCheckpoints.get(input.sessionId) || [];
    list.unshift(checkpoint);
    fallbackCheckpoints.set(input.sessionId, list);
    return checkpoint;
  }

  async listCheckpoints(sessionId: string): Promise<PrototypeCheckpoint[]> {
    try {
      const r = await this.pool.query(`SELECT * FROM prototype_checkpoints WHERE session_id=$1 ORDER BY prompt_index DESC`, [sessionId]);
      if (r?.rows) {
        const cps = r.rows.map(mapCheckpoint);
        fallbackCheckpoints.set(sessionId, cps);
        return cps;
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on listCheckpoints:', err.message);
    }
    return fallbackCheckpoints.get(sessionId) || [];
  }

  async createPromotion(input: Omit<PrototypePromotion, 'id'>): Promise<PrototypePromotion> {
    const id = randomUUID();
    try {
      const r = await this.pool.query(
        `INSERT INTO prototype_promotions (id,session_id,from_mode,to_mode,repository,branch,checkpoint_sha,promoted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [id, input.sessionId, input.fromMode, input.toMode, input.repository, input.branch, input.checkpointSha, input.promotedAt || new Date()]
      );
      if (r?.rows?.[0]) {
        const promo = mapPromotion(r.rows[0]);
        fallbackPromotions.set(input.sessionId, promo);
        return promo;
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on createPromotion:', err.message);
    }
    const promo: PrototypePromotion = {
      id,
      sessionId: input.sessionId,
      fromMode: input.fromMode,
      toMode: input.toMode,
      repository: input.repository,
      branch: input.branch,
      checkpointSha: input.checkpointSha,
      promotedAt: input.promotedAt || new Date(),
    };
    fallbackPromotions.set(input.sessionId, promo);
    return promo;
  }

  async getPromotion(sessionId: string): Promise<PrototypePromotion | null> {
    try {
      const r = await this.pool.query(`SELECT * FROM prototype_promotions WHERE session_id=$1 ORDER BY promoted_at DESC LIMIT 1`, [sessionId]);
      if (r?.rows?.[0]) {
        const promo = mapPromotion(r.rows[0]);
        fallbackPromotions.set(sessionId, promo);
        return promo;
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on getPromotion:', err.message);
    }
    return fallbackPromotions.get(sessionId) || null;
  }

  async nextMessageOrder(sessionId: string): Promise<number> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT 1 FROM prototype_sessions WHERE id=$1 FOR UPDATE', [sessionId]);
        const r = await client.query(
          `SELECT COALESCE(MAX("order"),0)+1 AS next FROM prototype_messages WHERE session_id=$1`,
          [sessionId]
        );
        await client.query('COMMIT');
        return Number(r.rows[0].next);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on nextMessageOrder:', err.message);
      const msgs = fallbackMessages.get(sessionId) || [];
      const maxOrder = msgs.reduce((max, m) => Math.max(max, m.order || 0), 0);
      return maxOrder + 1;
    }
  }

  async addMessage(msg: PrototypeMessage): Promise<PrototypeMessage> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        let order = msg.order;
        if (!order || order <= 0) {
          await client.query('SELECT 1 FROM prototype_sessions WHERE id=$1 FOR UPDATE', [msg.sessionId]);
          const r = await client.query(
            `SELECT COALESCE(MAX("order"),0)+1 AS next FROM prototype_messages WHERE session_id=$1`,
            [msg.sessionId]
          );
          order = Number(r.rows[0].next);
        }
        const id = (msg as any).id ?? randomUUID();
        const r = await client.query(
          `INSERT INTO prototype_messages (id, session_id, task_id, role, content, "order")
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (session_id, "order") DO UPDATE SET content=EXCLUDED.content
           RETURNING *`,
          [id, msg.sessionId, msg.taskId ?? null, msg.role, msg.content, order]
        );
        await client.query('COMMIT');
        const mapped = mapMessage(r.rows[0]);
        const msgs = fallbackMessages.get(msg.sessionId) || [];
        msgs.push(mapped);
        fallbackMessages.set(msg.sessionId, msgs);
        return mapped;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on addMessage:', err.message);
      const msgs = fallbackMessages.get(msg.sessionId) || [];
      const order = msg.order && msg.order > 0 ? msg.order : (msgs.reduce((max, m) => Math.max(max, m.order || 0), 0) + 1);
      const savedMsg: PrototypeMessage = {
        ...msg,
        id: msg.id || randomUUID(),
        order,
        createdAt: msg.createdAt || new Date(),
      };
      msgs.push(savedMsg);
      fallbackMessages.set(msg.sessionId, msgs);
      return savedMsg;
    }
  }

  async listMessages(sessionId: string): Promise<PrototypeMessage[]> {
    try {
      const r = await this.pool.query(
        `SELECT * FROM prototype_messages WHERE session_id=$1 ORDER BY "order" ASC`,
        [sessionId]
      );
      if (r?.rows) {
        const msgs = r.rows.map(mapMessage);
        fallbackMessages.set(sessionId, msgs);
        return msgs;
      }
    } catch (err: any) {
      console.warn('[PostgresPrototypeRepository] DB quota/error on listMessages:', err.message);
    }
    return fallbackMessages.get(sessionId) || [];
  }
}

