/**
 * CEO Command & Control Room Types and Contracts.
 *
 * Implements strict governance-first contracts for executive directives issued by MATHEUS (CEO).
 * Guarantees end-to-end correlation, tamper-proof operator identity, and fail-closed auditability.
 */

import type { GovernanceDecisionCode } from '../governance/types.js';

export type CeoCommandIntent = 'INQUIRY' | 'DIAGNOSTIC' | 'ACTION' | 'MUTATION';

export interface TrustedCeoContext {
  /** Authenticated operator ID (e.g., 'MATHEUS') verified by input channel / session */
  operatorId: string;
  /** Role of the operator in the executive hierarchy (must be 'CEO') */
  role: 'CEO';
  /** Provenance of the command (e.g., 'terminal', 'chat', 'api') */
  channel: 'chat' | 'api' | 'cli' | 'internal';
  /** Cryptographic or session verification token confirming operator authenticity */
  verified: boolean;
}

export interface CeoCommandInputPacket {
  /** Raw message or directive instruction */
  command: string;
  /** Target project / product identifier */
  project?: string;
  /** Explicit repository URI if different from catalog default */
  repository?: string;
  /** Optional conversation or thread ID */
  conversationId?: string;
  /** Optional idempotency key to prevent duplicate dispatch */
  idempotencyKey?: string;
  /** Trusted authentication context confirming caller is MATHEUS (CEO) */
  trustedContext: TrustedCeoContext;
}

export interface CEOCommand {
  /** Unique ID of this command execution */
  id: string;
  /** End-to-end correlation ID linking CEO directive, governance audit, task, and outcome */
  correlationId: string;
  /** Authenticated operator who issued the command */
  issuedBy: string;
  /** Provenance channel */
  channel: string;
  /** Original command text */
  command: string;
  /** Target project identifier */
  project: string;
  /** Target repository URI */
  repository: string;
  /** Classified intent */
  intent: CeoCommandIntent;
  /** Normalized requested action */
  requestedAction: string;
  /** Extracted execution constraints (e.g., ['NO_MUTATION', 'AUDIT_ONLY']) */
  constraints: string[];
  /** Optional idempotency key */
  idempotencyKey?: string;
  /** Timestamp when the command was received */
  timestamp: string;
}

export interface CeoGovernanceEvaluation {
  allowed: boolean;
  reasonCode: GovernanceDecisionCode | string;
  reason: string;
  evaluatedAt: string;
  activeLevel: number;
  killSwitchActive: boolean;
}

export interface CEOCommandResult {
  commandId: string;
  correlationId: string;
  issuedBy: string;
  project: string;
  intent: CeoCommandIntent;
  status: 'COMPLETED' | 'BLOCKED' | 'QUEUED' | 'FAILED';
  governanceDecision: CeoGovernanceEvaluation;
  /** Set ONLY if governance permits task creation and task is enqueued */
  taskId?: string | null;
  /** Output or diagnostic response returned to CEO */
  output?: string;
  /** Optional error message if blocked or failed */
  error?: string | null;
  durationMs: number;
  events: Array<{
    type: string;
    message: string;
    timestamp: string;
    data?: Record<string, unknown>;
  }>;
}
