/**
 * Phase 3C.2 — ExecutionSpec Persistence Foundation
 *
 * Minimal, contract-aligned, first-class persisted execution specification.
 *
 * Scope: persistence ONLY. No BaseWorker, RouterWorker, provider, or
 * finalization integration (those are Phase 3D+).
 *
 * Uses the repository's PostgreSQL migration conventions (db/migrations/*.sql).
 * Hash uses existing `stableHash` from src/task/hash.ts.
 * Validation reuses canonical task validators.
 */

import { stableHash } from '../task/hash.js';
import {
  type ExecutionSpec,
  type TaskLineage,
  serializeExecutionSpec,
  deserializeExecutionSpec,
} from '../task/execution-spec.js';
import { validateExecutionSpec } from '../task/spec-validator.js';
import { validateExecutionSpecSemantics } from '../task/spec-semantics.js';

export type SpecStatus = 'UNSEALED' | 'VALIDATED' | 'SEALED' | 'BLOCKED';

/**
 * Deterministic canonical serialization for spec_hash computation.
 * Sorts keys lexicographically so identical content always yields identical hash.
 */
export function sortKeysRecursively(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysRecursively);
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = sortKeysRecursively((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

function canonicalSerialize(spec: ExecutionSpec): string {
  // Normalize metadata.specHash to avoid self-referential hash divergence
  const normalized: ExecutionSpec = {
    ...spec,
    metadata: {
      ...spec.metadata,
      specHash: '',
    },
  };
  return JSON.stringify(sortKeysRecursively(normalized));
}

/**
 * Deterministic spec_hash from canonical ExecutionSpec content.
 * Uses existing stableHash (FNV-1a) from src/task/hash.ts.
 * Input includes all spec content fields; excludes persistence-only fields by contract.
 */
export function computeSpecHash(spec: ExecutionSpec): string {
  return stableHash(canonicalSerialize(spec));
}

export const computeCanonicalSpecHash = computeSpecHash;

/* ---------- Execution Spec Record (persistence model) ---------- */

export interface ExecutionSpecRecord {
  id: string;
  task_id: string;
  spec_version: string;
  spec_hash: string;
  objective: string;
  lineage: TaskLineage;
  status: SpecStatus;
  created_at: string;
  sealed_at?: string;
  spec_content_json: string;
}

/* ---------- Database / Store Interfaces ---------- */

export interface ExecutionSpecStore {
  create(record: ExecutionSpecRecord): Promise<ExecutionSpecRecord>;
  loadByTaskId(taskId: string): Promise<ExecutionSpecRecord | null>;
  updateStatus(
    idOrTaskId: string,
    status: SpecStatus,
    sealedAt?: string,
    specHash?: string,
    specContentJson?: string,
  ): Promise<ExecutionSpecRecord>;
  verifyIntegrity?(record: ExecutionSpecRecord): Promise<boolean>;
}

export interface QueryableDb {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

export type ExecutionSpecDatabase = ExecutionSpecStore | QueryableDb;

function isExecutionSpecStore(db: unknown): db is ExecutionSpecStore {
  return typeof db === 'object' && db !== null && typeof (db as ExecutionSpecStore).loadByTaskId === 'function';
}

function isQueryableDb(db: unknown): db is QueryableDb {
  return typeof db === 'object' && db !== null && typeof (db as QueryableDb).query === 'function';
}

/* ---------- Query helpers for QueryableDb ---------- */

async function queryLoadByTaskId(db: QueryableDb, taskId: string): Promise<ExecutionSpecRecord | null> {
  const res = await db.query(
    `SELECT * FROM execution_specs WHERE task_id = $1 LIMIT 1`,
    [taskId],
  );
  if (!res.rows || res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    spec_version: String(row.spec_version),
    spec_hash: String(row.spec_hash ?? ''),
    objective: String(row.objective),
    lineage: typeof row.lineage === 'string' ? JSON.parse(row.lineage) : row.lineage,
    status: row.status as SpecStatus,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    sealed_at: row.sealed_at ? (row.sealed_at instanceof Date ? row.sealed_at.toISOString() : String(row.sealed_at)) : undefined,
    spec_content_json: typeof row.spec_content_json === 'string' ? row.spec_content_json : JSON.stringify(row.spec_content_json),
  };
}

async function queryCreate(db: QueryableDb, record: ExecutionSpecRecord): Promise<ExecutionSpecRecord> {
  try {
    await db.query(
      `INSERT INTO execution_specs (id, task_id, spec_version, spec_hash, objective, lineage, status, created_at, sealed_at, spec_content_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        record.id,
        record.task_id,
        record.spec_version,
        record.spec_hash,
        record.objective,
        JSON.stringify(record.lineage),
        record.status,
        record.created_at,
        record.sealed_at ?? null,
        record.spec_content_json,
      ],
    );
    return record;
  } catch (err: any) {
    if (err?.code === '23505' || err?.message?.includes('unique') || err?.message?.includes('duplicate')) {
      throw new Error(`ExecutionSpec already exists for task ${record.task_id}`);
    }
    throw err;
  }
}

async function queryUpdateStatus(
  db: QueryableDb,
  taskId: string,
  status: SpecStatus,
  sealedAt?: string,
  specHash?: string,
  specContentJson?: string,
): Promise<ExecutionSpecRecord> {
  // REQ 13 — SEALED = immutable: reject mutation of sealed record
  const existingRow = await db.query(`SELECT status FROM execution_specs WHERE task_id = $1`, [taskId]);
  if (existingRow?.rows?.[0]?.status === 'SEALED') {
    // Block any modification attempt to SEALED record
    throw new Error(`ExecutionSpec for task ${taskId} is SEALED and immutable; mutation rejected`);
  }
  const res = await db.query(
    `UPDATE execution_specs
     SET status = $1,
         sealed_at = $2,
         spec_hash = COALESCE($3, spec_hash),
         spec_content_json = COALESCE($4, spec_content_json)
     WHERE task_id = $5
     RETURNING *`,
    [status, sealedAt ?? null, specHash ?? null, specContentJson ?? null, taskId],
  );
  if (!res.rows || res.rows.length === 0) {
    throw new Error(`Record for task ${taskId} not found`);
  }
  const row = res.rows[0];
  return {
    id: String(row.id),
    task_id: String(row.task_id),
    spec_version: String(row.spec_version),
    spec_hash: String(row.spec_hash ?? ''),
    objective: String(row.objective),
    lineage: typeof row.lineage === 'string' ? JSON.parse(row.lineage) : row.lineage,
    status: row.status as SpecStatus,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    sealed_at: row.sealed_at ? (row.sealed_at instanceof Date ? row.sealed_at.toISOString() : String(row.sealed_at)) : undefined,
    spec_content_json: typeof row.spec_content_json === 'string' ? row.spec_content_json : JSON.stringify(row.spec_content_json),
  };
}

/* ---------- Persistence operations ---------- */

/**
 * Create a new UNSEALED execution spec record tied to a task.
 * Structural validation is performed at creation time.
 */
export async function createExecutionSpec(
  db: ExecutionSpecDatabase,
  taskId: string,
  rawSpec: unknown,
): Promise<ExecutionSpecRecord> {
  const structural = validateExecutionSpec(rawSpec);
  if (!structural.valid) {
    throw new Error(
      `Structural validation failed: ${structural.errors.map((e) => e.code).join(', ')}`,
    );
  }
  const validated = structural.value;

  const existing = await loadExecutionSpec(db, taskId);
  if (existing) {
    throw new Error(`ExecutionSpec already exists for task ${taskId}`);
  }

  const record: ExecutionSpecRecord = {
    id: crypto.randomUUID(),
    task_id: taskId,
    spec_version: validated.specVersion,
    spec_hash: '',
    objective: validated.objective,
    lineage: validated.lineage,
    status: 'UNSEALED',
    created_at: new Date().toISOString(),
    sealed_at: undefined,
    spec_content_json: serializeExecutionSpec(validated),
  };

  if (isExecutionSpecStore(db)) {
    return await db.create(record);
  }
  if (isQueryableDb(db)) {
    return await queryCreate(db, record);
  }
  throw new Error('Invalid database client: must implement ExecutionSpecStore or QueryableDb');
}

/**
 * Seal a previously UNSEALED spec into SEALED status.
 *
 * Performs:
 *  1. retrieval of existing record
 *  2. structural validation
 *  3. canonical spec_hash computation and check
 *  4. semantic validation
 *  5. atomic status transition to SEALED
 *
 * A failed validation MUST NOT produce a SEALED spec.
 */
export async function sealExecutionSpec(
  db: ExecutionSpecDatabase,
  taskId: string,
  specHashOrSpec?: string | ExecutionSpec,
): Promise<ExecutionSpecRecord> {
  const existing = await loadExecutionSpec(db, taskId);
  if (!existing) {
    throw new Error(`ExecutionSpec not found for task ${taskId}`);
  }

  if (existing.status === 'SEALED') {
    if (typeof specHashOrSpec === 'string' && specHashOrSpec.trim().length > 0 && specHashOrSpec !== existing.spec_hash) {
      throw new Error(
        `ExecutionSpec for task ${taskId} is already SEALED with different hash (${existing.spec_hash} vs ${specHashOrSpec})`,
      );
    }
    return existing;
  }

  let spec: ExecutionSpec;
  if (typeof specHashOrSpec === 'object' && specHashOrSpec !== null) {
    spec = specHashOrSpec as ExecutionSpec;
  } else {
    try {
      spec = JSON.parse(existing.spec_content_json) as ExecutionSpec;
    } catch {
      throw new Error(`Corrupted ExecutionSpec content JSON for task ${taskId}`);
    }
  }

  const structural = validateExecutionSpec(spec);
  if (!structural.valid) {
    throw new Error(`Structural validation failed at seal: ${structural.errors.map((e) => e.code).join(', ')}`);
  }
  const validated = structural.value;

  const computedHash = computeSpecHash(validated);

  if (typeof specHashOrSpec === 'string' && specHashOrSpec.trim().length > 0) {
    if (specHashOrSpec !== computedHash) {
      throw new Error(`Hash mismatch at seal: expected ${specHashOrSpec}, computed ${computedHash}`);
    }
  }

  const specForSemanticCheck: ExecutionSpec = {
    ...validated,
    metadata: {
      ...validated.metadata,
      specHash: computedHash,
    },
  };

  const semantic = validateExecutionSpecSemantics(specForSemanticCheck);
  if (!semantic.valid) {
    throw new Error(`Semantic validation failed at seal: ${semantic.errors.map((e) => e.code).join(', ')}`);
  }

  const sealedAt = new Date().toISOString();
  const serializedContent = serializeExecutionSpec(specForSemanticCheck);

  if (isExecutionSpecStore(db)) {
    return await db.updateStatus(existing.id, 'SEALED', sealedAt, computedHash, serializedContent);
  }
  if (isQueryableDb(db)) {
    return await queryUpdateStatus(db, existing.task_id, 'SEALED', sealedAt, computedHash, serializedContent);
  }
  throw new Error('Invalid database client: must implement ExecutionSpecStore or QueryableDb');
}

/**
 * Load execution spec record by task_id (or record id).
 */
export async function loadExecutionSpec(
  db: ExecutionSpecDatabase,
  taskId: string,
): Promise<ExecutionSpecRecord | null> {
  if (isExecutionSpecStore(db)) {
    return await db.loadByTaskId(taskId);
  }
  if (isQueryableDb(db)) {
    return await queryLoadByTaskId(db, taskId);
  }
  throw new Error('Invalid database client: must implement ExecutionSpecStore or QueryableDb');
}

/**
 * Verify cryptographic and semantic integrity of a persisted ExecutionSpec record.
 */
export async function verifyExecutionSpecIntegrity(
  db: ExecutionSpecDatabase,
  taskId: string,
): Promise<boolean> {
  try {
    const record = await loadExecutionSpec(db, taskId);
    if (!record) return false;
    if (record.status !== 'SEALED') return false;
    if (!record.spec_hash || record.spec_hash.trim().length === 0) return false;

    let spec: ExecutionSpec;
    try {
      spec = JSON.parse(record.spec_content_json) as ExecutionSpec;
    } catch {
      return false;
    }

    const structural = validateExecutionSpec(spec);
    if (!structural.valid) return false;

    const computedHash = computeSpecHash(structural.value);
    if (computedHash !== record.spec_hash) return false;

    const semantic = validateExecutionSpecSemantics({
      ...structural.value,
      metadata: {
        ...structural.value.metadata,
        specHash: computedHash,
      },
    });
    if (!semantic.valid) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Load by task_id or assert on record, require SEALED status, and verify hash integrity.
 * Returns the exact persisted contract record.
 * Mismatch produces an explicit integrity failure.
 */
export async function assertSealedExecutable(
  dbOrRecord: ExecutionSpecDatabase | ExecutionSpecRecord | null,
  taskId?: string,
): Promise<ExecutionSpecRecord> {
  let record: ExecutionSpecRecord | null = null;

  if (taskId !== undefined) {
    if (!dbOrRecord) throw new Error('No ExecutionSpec found');
    record = await loadExecutionSpec(dbOrRecord as ExecutionSpecDatabase, taskId);
  } else if (dbOrRecord && typeof dbOrRecord === 'object' && 'status' in dbOrRecord) {
    record = dbOrRecord as ExecutionSpecRecord;
  } else {
    throw new Error('No ExecutionSpec found');
  }

  if (!record) {
    throw new Error(`No ExecutionSpec found${taskId ? ` for task ${taskId}` : ''}`);
  }

  if (record.status !== 'SEALED') {
    throw new Error(
      `ExecutionSpec is not SEALED (status=${record.status}), not executable`,
    );
  }

  let spec: ExecutionSpec;
  try {
    spec = JSON.parse(record.spec_content_json) as ExecutionSpec;
  } catch {
    throw new Error(`Corrupted ExecutionSpec content JSON for task ${record.task_id}`);
  }

  const computedHash = computeSpecHash(spec);
  if (record.spec_hash && record.spec_hash !== computedHash) {
    throw new Error(
      `ExecutionSpec integrity violation: persisted hash ${record.spec_hash} does not match computed hash ${computedHash}`,
    );
  }

  return record;
}

/**
 * Deserializes the validated ExecutionSpec directly from the record.
 * Directly satisfies Phase 3C.1 prepareExecution(task, executionSpec).
 */
export function deserializeRecordSpec(record: ExecutionSpecRecord): ExecutionSpec {
  return deserializeExecutionSpec(record.spec_content_json);
}