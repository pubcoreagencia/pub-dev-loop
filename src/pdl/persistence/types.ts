import type { ProductManifest } from '../products/catalog.js';

export type RemotePersistenceStatus =
  | 'NOT_REQUESTED'
  | 'PUSHED'
  | 'VERIFIED'
  | 'FAILED';

export interface RemotePersistenceResult {
  status: RemotePersistenceStatus;
  repository: string;
  branch: string;
  pushAttempted: boolean;
  pushSucceeded: boolean;
  localSha: string | null;
  remoteSha: string | null;
  remoteVerified: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface RemotePersistenceOptions {
  workspace: string;
  product: string | ProductManifest;
  branch: string;
  localSha: string;
  targetRepository?: string;
  requested?: boolean;
  gitToken?: string;
  /**
   * Advisory metadata only. Cannot override the remote baseline.
   * If supplied, it must strictly match the verified remote baseline SHA or persistence fails closed.
   */
  baseSha?: string;
  /**
   * Pluggable remote transport for remote persistence (defaults to GitHubTransport).
   */
  transport?: RemoteTransport;
}

import type { GitExecutor } from './remote-persistence.js';

/**
 * Parameter packet passed to RemoteTransport implementations.
 */
export interface RemotePersistenceRequest {
  workspace: string;
  manifest: ProductManifest;
  branch: string;
  localSha: string;
  baseSha?: string;
  targetRepository?: string;
  gitToken?: string;
  executor: GitExecutor;
  collectRangeTouchedFiles: (workspace: string, localSha: string, baseCommit: string) => string[];
  validateChangesetSecurity: (touchedFiles: string[], workspace: string) => { allowed: boolean; reason?: string };
}

/**
 * Pluggable remote transport abstraction for PDL persistence.
 */
export interface RemoteTransport {
  readonly name: string;
  persist(request: RemotePersistenceRequest): Promise<RemotePersistenceResult>;
}

