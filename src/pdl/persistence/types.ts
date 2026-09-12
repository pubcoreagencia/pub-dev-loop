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
}
