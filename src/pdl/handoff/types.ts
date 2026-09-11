/**
 * Canonical PDL Task Ingestion Boundary Contracts (Phase 3D Step 2).
 *
 * Owned strictly by the PDL domain. Defines the neutral ingestion port
 * through which external upstream systems (such as prototype promotion,
 * external webhooks, or API gateways) submit tasks into PDL.
 *
 * Invariants:
 * - Zero dependencies on PP internal types, sessions, or worker classes.
 * - Minimum required payload to trigger canonical TaskIntakeService.
 */

export interface PdlTaskIngestionRequest {
  project: string;
  repository: string;
  branch: string;
  checkpointSha: string;
  promotionId: string;
  prototypeSessionId: string;
  objective: string;
  prompt: string;
  priority?: number;
}

export interface PdlTaskIngestionResult {
  id: string;
  taskId: string;
  status?: string;
  branch?: string | null;
  repository?: string;
  prototypeSessionId?: string | null;
  result?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface PdlTaskIngestionPort {
  ingest(request: PdlTaskIngestionRequest): Promise<PdlTaskIngestionResult>;
}
