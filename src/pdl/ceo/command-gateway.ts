/**
 * CEO Command Gateway — Governance-First Command Intake & Dispatch.
 *
 * Enforces strict pipeline order:
 * CEO Command -> Validation -> Trusted Identity -> Normalization
 * -> GOVERNANCE EVALUATION -> ALLOW / BLOCK -> Task Intake (Only if ALLOW)
 *
 * Fail-Closed Guarantee:
 * - If Governance blocks (Kill Switch, Level 0, Unauthorized Product),
 *   ZERO tasks are created or inserted into the database.
 * - Emits audit events and returns CeoCommandResult.status = 'BLOCKED'.
 */

import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { TaskRepository, Task } from '../../domain.js';
import { PdlGovernanceEngine, defaultGovernanceEngine } from '../governance/index.js';
import { TaskIntakeService } from '../service/task-intake-service.js';
import { defaultProductCatalog, type ProductCatalog } from '../products/catalog.js';
import { defaultCeoConversationStore, type CeoConversationStore } from '../../office/ceo-conversation-store.js';
import type {
  CEOCommand,
  CeoCommandInputPacket,
  CEOCommandResult,
  CeoCommandIntent,
  CeoGovernanceEvaluation,
} from './types.js';

export interface CeoCommandGatewayOptions {
  governance?: PdlGovernanceEngine;
  intakeService?: TaskIntakeService;
  taskRepo?: TaskRepository;
  catalog?: ProductCatalog;
  conversationStore?: CeoConversationStore;
  pool?: Pool;
}

export class CeoCommandGateway {
  private readonly governance: PdlGovernanceEngine;
  private readonly intakeService?: TaskIntakeService;
  private readonly taskRepo?: TaskRepository;
  private readonly catalog: ProductCatalog;
  private readonly conversationStore: CeoConversationStore;

  // In-memory idempotency cache: key -> CEOCommandResult
  private readonly idempotencyCache = new Map<string, CEOCommandResult>();

  constructor(options: CeoCommandGatewayOptions = {}) {
    this.governance = options.governance || defaultGovernanceEngine;
    this.catalog = options.catalog || defaultProductCatalog;
    this.conversationStore = options.conversationStore || defaultCeoConversationStore;
    this.taskRepo = options.taskRepo;
    this.intakeService = options.intakeService || (options.pool ? new TaskIntakeService(options.pool) : undefined);
  }

  /**
   * Main entrypoint for processing CEO directives.
   * Strictly evaluates governance BEFORE creating any task record.
   */
  public async handleCommand(packet: CeoCommandInputPacket): Promise<CEOCommandResult> {
    const started = Date.now();
    const commandId = randomUUID();
    const correlationId = `ceo-corr-${randomUUID()}`;
    const events: Array<{ type: string; message: string; timestamp: string; data?: Record<string, unknown> }> = [];

    const recordEvent = (type: string, message: string, data?: Record<string, unknown>) => {
      const entry = { type, message, timestamp: new Date().toISOString(), data };
      events.push(entry);
    };

    recordEvent('COMMAND_RECEIVED', 'CEO command received at gateway boundary');

    // 1. Validate Trusted CEO Identity (Authority cannot come from unauthenticated text!)
    if (
      !packet.trustedContext ||
      packet.trustedContext.verified !== true ||
      packet.trustedContext.role !== 'CEO' ||
      !packet.trustedContext.operatorId ||
      packet.trustedContext.operatorId.toUpperCase() !== 'MATHEUS'
    ) {
      const decision: CeoGovernanceEvaluation = {
        allowed: false,
        reasonCode: 'UNAUTHORIZED_OPERATOR',
        reason: 'Command rejected: Operator identity is not authenticated as MATHEUS (CEO).',
        evaluatedAt: new Date().toISOString(),
        activeLevel: 0,
        killSwitchActive: true,
      };

      recordEvent('OPERATOR_REJECTED', decision.reason);

      return {
        commandId,
        correlationId,
        issuedBy: packet.trustedContext?.operatorId || 'UNKNOWN',
        project: packet.project || 'unknown',
        intent: 'INQUIRY',
        status: 'BLOCKED',
        governanceDecision: decision,
        error: decision.reason,
        durationMs: Date.now() - started,
        events,
      };
    }

    const issuedBy = packet.trustedContext.operatorId;

    // 2. Validate Command Input Content
    const rawCommand = (packet.command || '').trim();
    if (!rawCommand) {
      const decision: CeoGovernanceEvaluation = {
        allowed: false,
        reasonCode: 'EMPTY_COMMAND',
        reason: 'Command rejected: Directive text cannot be empty.',
        evaluatedAt: new Date().toISOString(),
        activeLevel: 0,
        killSwitchActive: false,
      };

      recordEvent('VALIDATION_FAILED', decision.reason);

      return {
        commandId,
        correlationId,
        issuedBy,
        project: packet.project || 'unknown',
        intent: 'INQUIRY',
        status: 'BLOCKED',
        governanceDecision: decision,
        error: decision.reason,
        durationMs: Date.now() - started,
        events,
      };
    }

    // 3. Idempotency Check
    if (packet.idempotencyKey) {
      const cached = this.idempotencyCache.get(packet.idempotencyKey);
      if (cached) {
        recordEvent('IDEMPOTENT_REPLAY', `Command replayed from idempotency cache (${packet.idempotencyKey})`);
        return {
          ...cached,
          events: [...events, ...cached.events],
          durationMs: Date.now() - started,
        };
      }
    }

    // 4. Validate Target Project (Canonical Context)
    const rawProject = packet.project?.trim();
    if (!rawProject) {
      const decision: CeoGovernanceEvaluation = {
        allowed: false,
        reasonCode: 'MISSING_PROJECT',
        reason: 'Command rejected: Target project identifier is required.',
        evaluatedAt: new Date().toISOString(),
        activeLevel: 0,
        killSwitchActive: false,
      };

      recordEvent('VALIDATION_FAILED', decision.reason);

      return {
        commandId,
        correlationId,
        issuedBy,
        project: 'unknown',
        intent: 'INQUIRY',
        status: 'BLOCKED',
        governanceDecision: decision,
        error: decision.reason,
        durationMs: Date.now() - started,
        events,
      };
    }

    const project = rawProject;
    const repository = packet.repository?.trim() || this.catalog.get(project)?.repository || `https://github.com/pubcoreagencia/${project}.git`;
    const { intent, constraints, requestedAction } = this.normalizeIntent(rawCommand);

    const ceoCommand: CEOCommand = {
      id: commandId,
      correlationId,
      issuedBy,
      channel: packet.trustedContext.channel,
      command: rawCommand,
      project,
      repository,
      intent,
      requestedAction,
      constraints,
      idempotencyKey: packet.idempotencyKey,
      timestamp: new Date().toISOString(),
    };

    recordEvent('COMMAND_NORMALIZED', `Directive normalized: Intent=${intent}, Project=${project}`, {
      correlationId,
      intent,
      constraints,
    });

    // Record message into CEO conversation store
    const conversationId = packet.conversationId || `ceo-conv-${randomUUID()}`;
    this.conversationStore.getOrCreateSession(conversationId, project, repository);
    this.conversationStore.addMessage(conversationId, {
      conversationId,
      sender: 'CEO',
      senderName: `${issuedBy} (CEO)`,
      senderRole: 'Comandante & Operador Humano',
      content: rawCommand,
      metadata: { correlationId, commandId },
    });

    // 5. GOVERNANCE-FIRST EVALUATION (CRITICAL GATE)
    // The command is strictly evaluated BEFORE any task intake or database insertion!
    const govDecision = await this.evaluateGovernance(ceoCommand);
    recordEvent('GOVERNANCE_EVALUATED', `Governance decision: ${govDecision.allowed ? 'PERMITTED' : 'BLOCKED'} (${govDecision.reasonCode})`, {
      ...govDecision,
    });

    if (!govDecision.allowed) {
      recordEvent('COMMAND_BLOCKED', `Execution halted: ${govDecision.reason}`);

      const blockedResult: CEOCommandResult = {
        commandId,
        correlationId,
        issuedBy,
        project,
        intent,
        status: 'BLOCKED',
        governanceDecision: govDecision,
        taskId: null,
        error: govDecision.reason,
        durationMs: Date.now() - started,
        events,
      };

      if (packet.idempotencyKey) {
        this.idempotencyCache.set(packet.idempotencyKey, blockedResult);
      }

      return blockedResult;
    }

    // 6. GOVERNANCE ALLOWED -> DISPATCH TASK VIA TASK INTAKE SERVICE
    // Task is created ONLY AFTER governance explicitly permits execution!
    recordEvent('INTAKE_INITIATED', 'Governance permitted: Dispatching task creation via TaskIntakeService');

    let createdTask: Task | null = null;
    let taskId: string | null = null;

    try {
      if (this.intakeService) {
        const intakeResult = await this.intakeService.processIntake({
          rawRequest: rawCommand,
          prompt: rawCommand,
          objective: requestedAction,
          source: `ceo-command:${correlationId}`,
          project,
          repository,
          priority: 100, // Priority executive directive
          branch: `feat/${project}-ceo-${commandId.slice(0, 8)}`,
          constraints,
        });
        createdTask = intakeResult.task;
        taskId = createdTask.id;
      } else if (this.taskRepo) {
        createdTask = await this.taskRepo.create({
          project,
          repository,
          objective: requestedAction,
          prompt: rawCommand,
          priority: 100,
        });
        taskId = createdTask.id;
        await this.taskRepo.update(taskId, {
          branch: `feat/${project}-ceo-${commandId.slice(0, 8)}`,
          result: { correlationId },
        });
      } else {
        throw new Error('NO_TASK_PERSISTENCE: Neither TaskIntakeService nor TaskRepository is available');
      }

      recordEvent('TASK_CREATED', `Task created and enqueued with ID: ${taskId}`, { taskId });

      // Link task to active CEO session in CeoConversationStore
      this.conversationStore.linkTaskToConversation(taskId, conversationId);

      const successResult: CEOCommandResult = {
        commandId,
        correlationId,
        issuedBy,
        project,
        intent,
        status: 'QUEUED',
        governanceDecision: govDecision,
        taskId,
        output: `Directive accepted by Governance. Task [${taskId}] is queued for scheduler execution.`,
        durationMs: Date.now() - started,
        events,
      };

      if (packet.idempotencyKey) {
        this.idempotencyCache.set(packet.idempotencyKey, successResult);
      }

      return successResult;
    } catch (err: any) {
      recordEvent('INTAKE_FAILED', `Failed to create task after governance approval: ${err.message}`);

      return {
        commandId,
        correlationId,
        issuedBy,
        project,
        intent,
        status: 'FAILED',
        governanceDecision: govDecision,
        taskId: null,
        error: `INTAKE_ERROR: ${err.message}`,
        durationMs: Date.now() - started,
        events,
      };
    }
  }

  /**
   * Governance-first evaluation evaluating limits, kill switch, and product authorizations.
   */
  private async evaluateGovernance(command: CEOCommand): Promise<CeoGovernanceEvaluation> {
    const limits = await this.governance.loadLimits();
    const evaluatedAt = new Date().toISOString();

    // 1. Emergency Kill Switch Authority
    if (limits.killSwitchActive) {
      return {
        allowed: false,
        reasonCode: 'KILL_SWITCH_ACTIVE',
        reason: 'CEO Command blocked: Emergency kill switch is active in pdl_governance_state.',
        evaluatedAt,
        activeLevel: limits.activeLevel,
        killSwitchActive: true,
      };
    }

    // 2. Product Catalog / Allowed Products Authority
    const manifest = this.catalog.get(command.project);
    if (!manifest) {
      return {
        allowed: false,
        reasonCode: 'UNAUTHORIZED_PRODUCT',
        reason: `CEO Command blocked: Product '${command.project}' is not registered in Product Catalog.`,
        evaluatedAt,
        activeLevel: limits.activeLevel,
        killSwitchActive: limits.killSwitchActive,
      };
    }

    if (!limits.allowedProducts.includes(command.project)) {
      return {
        allowed: false,
        reasonCode: 'UNAUTHORIZED_PRODUCT',
        reason: `CEO Command blocked: Product '${command.project}' is not authorized in current governance policy.`,
        evaluatedAt,
        activeLevel: limits.activeLevel,
        killSwitchActive: limits.killSwitchActive,
      };
    }

    // 3. Governance Level Authority
    // Level 0: Manual execution only. Autonomous action/mutation is strictly blocked.
    if (limits.activeLevel === 0 && (command.intent === 'ACTION' || command.intent === 'MUTATION')) {
      return {
        allowed: false,
        reasonCode: 'LEVEL_0_MANUAL_ONLY',
        reason: 'CEO Command blocked: Governance Level is 0 (Manual only). Autonomous action directives are prohibited.',
        evaluatedAt,
        activeLevel: 0,
        killSwitchActive: limits.killSwitchActive,
      };
    }

    // Level 1: Supervised step-by-step; blocks direct autonomous action dispatch unless explicitly supervised
    if (limits.activeLevel === 1 && command.intent === 'MUTATION') {
      return {
        allowed: false,
        reasonCode: 'LEVEL_1_SUPERVISED_ONLY',
        reason: 'CEO Command blocked: Governance Level 1 requires interactive human supervision for code mutations.',
        evaluatedAt,
        activeLevel: 1,
        killSwitchActive: limits.killSwitchActive,
      };
    }

    return {
      allowed: true,
      reasonCode: 'PERMITTED',
      reason: `CEO Command authorized under Governance Level ${limits.activeLevel}`,
      evaluatedAt,
      activeLevel: limits.activeLevel,
      killSwitchActive: false,
    };
  }

  /**
   * Normalizes intent and extracts constraints from natural language directive.
   */
  private normalizeIntent(command: string): {
    intent: CeoCommandIntent;
    constraints: string[];
    requestedAction: string;
  } {
    const lower = command.toLowerCase();
    const constraints: string[] = [];

    const isNoMutation =
      lower.includes('não altere arquivos') ||
      lower.includes('nao altere arquivos') ||
      lower.includes('sem alterar') ||
      lower.includes('no changes') ||
      lower.includes('read only') ||
      lower.includes('somente leitura') ||
      lower.includes('diagnóstico') ||
      lower.includes('diagnostico');

    if (isNoMutation) {
      constraints.push('NO_MUTATION');
    }

    let intent: CeoCommandIntent = 'ACTION';
    if (lower.includes('crie um arquivo') || lower.includes('modifique') || lower.includes('corrija') || lower.includes('atualize')) {
      intent = isNoMutation ? 'DIAGNOSTIC' : 'MUTATION';
    } else if (isNoMutation || lower.includes('analise') || lower.includes('verifique') || lower.includes('status')) {
      intent = 'DIAGNOSTIC';
    } else if (lower.includes('como') || lower.includes('qual') || lower.includes('onde')) {
      intent = 'INQUIRY';
    }

    return {
      intent,
      constraints,
      requestedAction: command,
    };
  }
}
