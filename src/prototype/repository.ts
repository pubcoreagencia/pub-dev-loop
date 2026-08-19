import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { CreatePrototypeSession, PrototypeCheckpoint, PrototypeSession, PrototypeSessionStatus, PrototypeMode } from './domain.js';

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

export interface PrototypeRepository {
  createSession(input: CreatePrototypeSession): Promise<PrototypeSession>;
  getSession(id: string): Promise<PrototypeSession | null>;
  listSessions(): Promise<PrototypeSession[]>;
  updateSession(id: string, patch: Partial<Pick<PrototypeSession,'status'|'mode'|'previewUrl'|'previewRuntime'|'workspacePath'|'lastCheckpointSha'>>): Promise<PrototypeSession | null>;
  incrementPromptCount(id: string): Promise<PrototypeSession | null>;
  createCheckpoint(input: Omit<PrototypeCheckpoint,'id'|'createdAt'>): Promise<PrototypeCheckpoint>;
  listCheckpoints(sessionId: string): Promise<PrototypeCheckpoint[]>;
}

export class PostgresPrototypeRepository implements PrototypeRepository {
  constructor(private readonly pool: Pool) {}
  async createSession(input: CreatePrototypeSession): Promise<PrototypeSession> {
    const id = randomUUID(); const branch = input.branch ?? `prototype/${input.project}/${id}`;
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
      WHERE id=$1 AND status IN ('CREATING','READY')
      RETURNING *`,[id]);
    return r.rows[0]?mapSession(r.rows[0]):null;
  }
  async createCheckpoint(input:Omit<PrototypeCheckpoint,'id'|'createdAt'>):Promise<PrototypeCheckpoint>{const id=randomUUID(); const r=await this.pool.query(`INSERT INTO prototype_checkpoints (id,session_id,prompt_index,prompt,commit_sha,preview_url,build_passed) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[id,input.sessionId,input.promptIndex,input.prompt,input.commitSha,input.previewUrl,input.buildPassed]); return mapCheckpoint(r.rows[0]);}
  async listCheckpoints(sessionId:string):Promise<PrototypeCheckpoint[]>{const r=await this.pool.query(`SELECT * FROM prototype_checkpoints WHERE session_id=$1 ORDER BY prompt_index DESC`,[sessionId]); return r.rows.map(mapCheckpoint);}
}
