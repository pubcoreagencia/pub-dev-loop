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

export class PostgresPrototypeRepository implements PrototypeRepository {
  constructor(private readonly pool: Pool) {}
  async createSession(input: CreatePrototypeSession): Promise<PrototypeSession> {
    const id = randomUUID();
    const sanitizedProject = input.project.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const branch = input.branch ?? `prototype/${sanitizedProject || 'untitled'}/${id}`;
    const result = await this.pool.query(`INSERT INTO prototype_sessions (id, project, repository, branch) VALUES ($1,$2,$3,$4) RETURNING *`, [id,input.project,input.repository,branch]);
    return mapSession(result.rows[0]);
  }
  async getSession(id:string):Promise<PrototypeSession|null>{ const r=await this.pool.query(`SELECT * FROM prototype_sessions WHERE id=$1`,[id]); return r.rows[0]?mapSession(r.rows[0]):null; }
  async listSessions():Promise<PrototypeSession[]>{ const r=await this.pool.query(`SELECT * FROM prototype_sessions ORDER BY updated_at DESC`); return r.rows.map(mapSession); }
  async updateSession(id:string, patch: Partial<Pick<PrototypeSession,'status'|'mode'|'previewUrl'|'previewRuntime'|'workspacePath'|'lastCheckpointSha'>>):Promise<PrototypeSession|null>{
    const fields:Record<string,string>={status:'status',mode:'mode',previewUrl:'preview_url',previewRuntime:'preview_runtime',workspacePath:'workspace_path',lastCheckpointSha:'last_checkpoint_sha'};
    const values:unknown[]=[]; const set:string[]=[]; for(const [key,value] of Object.entries(patch)){ if(value===undefined)continue; set.push(`${fields[key]}=$${values.length+1}`); values.push(value); }
    if(!set.length)return this.getSession(id); values.push(id);
    const r=await this.pool.query(`UPDATE prototype_sessions SET ${set.join(',')}, updated_at=now() WHERE id=$${values.length} RETURNING *`,values); return r.rows[0]?mapSession(r.rows[0]):null;
  }
  /** Atomically reserves the next prompt slot and transitions the session to BUILDING. */
  async incrementPromptCount(id:string):Promise<PrototypeSession|null>{
    const r=await this.pool.query(`UPDATE prototype_sessions
      SET prompt_count=prompt_count+1,status='BUILDING',updated_at=now()
      WHERE id=$1 AND status IN ('CREATING','READY','FAILED')
      RETURNING *`,[id]);
    return r.rows[0]?mapSession(r.rows[0]):null;
  }
  /** Atomically transitions session from READY/APPROVED to PROMOTED in DEVELOPMENT mode. */
  async promoteSession(id:string):Promise<PrototypeSession|null>{
    const r=await this.pool.query(`UPDATE prototype_sessions
      SET mode='DEVELOPMENT', status='PROMOTED', updated_at=now()
      WHERE id=$1 AND status IN ('READY','APPROVED') AND last_checkpoint_sha IS NOT NULL
      RETURNING *`,[id]);
    return r.rows[0]?mapSession(r.rows[0]):null;
  }
  async createCheckpoint(input:Omit<PrototypeCheckpoint,'id'|'createdAt'>):Promise<PrototypeCheckpoint>{const id=randomUUID(); const r=await this.pool.query(`INSERT INTO prototype_checkpoints (id,session_id,prompt_index,prompt,commit_sha,preview_url,build_passed) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[id,input.sessionId,input.promptIndex,input.prompt,input.commitSha,input.previewUrl,input.buildPassed]); return mapCheckpoint(r.rows[0]);}
  async listCheckpoints(sessionId:string):Promise<PrototypeCheckpoint[]>{const r=await this.pool.query(`SELECT * FROM prototype_checkpoints WHERE session_id=$1 ORDER BY prompt_index DESC`,[sessionId]); return r.rows.map(mapCheckpoint);}
  async createPromotion(input:Omit<PrototypePromotion,'id'>):Promise<PrototypePromotion>{
    const id=randomUUID();
    const r=await this.pool.query(`INSERT INTO prototype_promotions (id,session_id,from_mode,to_mode,repository,branch,checkpoint_sha,promoted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[id,input.sessionId,input.fromMode,input.toMode,input.repository,input.branch,input.checkpointSha,input.promotedAt || new Date()]);
    return mapPromotion(r.rows[0]);
  }
  async getPromotion(sessionId:string):Promise<PrototypePromotion|null>{
    const r=await this.pool.query(`SELECT * FROM prototype_promotions WHERE session_id=$1 ORDER BY promoted_at DESC LIMIT 1`,[sessionId]);
    return r.rows[0]?mapPromotion(r.rows[0]):null;
  }
  async nextMessageOrder(sessionId: string): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Lock the session row to serialize MAX("order") computation securely
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
  }

  async addMessage(msg: PrototypeMessage): Promise<PrototypeMessage> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      let order = msg.order;
      if (!order || order <= 0) {
        // Lock session to prevent concurrent order calculation races
        await client.query('SELECT 1 FROM prototype_sessions WHERE id=$1 FOR UPDATE', [msg.sessionId]);
        const r = await client.query(
          `SELECT COALESCE(MAX("order"),0)+1 AS next FROM prototype_messages WHERE session_id=$1`,
          [msg.sessionId]
        );
        order = Number(r.rows[0].next);
      }
      const id = (msg as any).id ?? (await import('node:crypto')).randomUUID();
      const r = await client.query(
        `INSERT INTO prototype_messages (id, session_id, task_id, role, content, "order")
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (session_id, "order") DO UPDATE SET content=EXCLUDED.content
         RETURNING *`,
         [id, msg.sessionId, msg.taskId ?? null, msg.role, msg.content, order]
      );
      await client.query('COMMIT');
      return mapMessage(r.rows[0]);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async listMessages(sessionId: string): Promise<PrototypeMessage[]> {
    const r = await this.pool.query(
      `SELECT * FROM prototype_messages WHERE session_id=$1 ORDER BY "order" ASC`,
      [sessionId]
    );
    return r.rows.map(mapMessage);
  }
}

