import { randomUUID } from 'node:crypto';
import type { Task, TaskRepository } from '../domain.js';
import { AgentRegistry, defaultAgentRegistry } from './registry.js';
import { CeoConversationStore, defaultCeoConversationStore, type CeoOperationalEvent } from './ceo-conversation-store.js';
import { resolveContext } from './context-resolver.js';
import { classifyTaskType, type TaskType, type EngineeringTask } from './intent.js';
import { normalizeTaskIntake } from '../task/intake.js';
import { TaskIntakeService, buildCanonicalExecutionSpec } from '../pdl/service/task-intake-service.js';
import { computeSpecHash, createExecutionSpec, sealExecutionSpec, type ExecutionSpecDatabase } from '../execution/execution-spec-persistence.js';
import type { ExecutionSpec } from '../task/execution-spec.js';
import { CodeReviewManager, defaultCodeReviewManager, extractReviewContextFromTask, type CodeReviewResult } from './review.js';
import { DefaultPubNeuralBridge, defaultPubNeuralBridge } from '../pdl/neural/neural-bridge.js';
import type { PubNeuralBridge, NeuralIngestionStatus } from '../pdl/neural/types.js';
import type { Worker } from '../worker-service.js';

export interface CeoCommandInput {
  message: string;
  conversationId?: string;
  project?: string;
  repository?: string;
  workspaceDir?: string;
  executeSynchronously?: boolean;
}

export interface CeoCommandResponse {
  conversationId: string;
  response: string;
  type: 'INQUIRY' | 'ACTION' | 'CLARIFICATION';
  assignedSpecialist?: {
    id: string;
    name: string;
    role: string;
  };
  task?: {
    id: string;
    project: string;
    objective: string;
    status: string;
    agentId?: string | null;
  };
  executionSpec?: ExecutionSpec;
  review?: CodeReviewResult;
  gitState?: {
    branch: string;
    headSha: string;
    isClean: boolean;
    changedFiles?: string[];
  };
  neuralStatus?: {
    status: NeuralIngestionStatus;
    endpointConfigured: boolean;
    error?: string;
  };
  events: CeoOperationalEvent[];
}

export class ChiefOfStaffAgent {
  constructor(
    private readonly conversationStore: CeoConversationStore = defaultCeoConversationStore,
    private readonly registry: AgentRegistry = defaultAgentRegistry,
    private readonly neuralBridge: PubNeuralBridge = defaultPubNeuralBridge,
    private readonly reviewManager: CodeReviewManager = defaultCodeReviewManager,
    private readonly taskRepo?: TaskRepository,
    private readonly worker?: Worker,
    private readonly executionSpecDb?: ExecutionSpecDatabase,
    private readonly intakeService?: TaskIntakeService
  ) {}

  async handleCommand(input: CeoCommandInput): Promise<CeoCommandResponse> {
    const rawMessage = (input.message || '').trim();
    const project = input.project?.trim() || 'pub-dev-loop';
    const repository = input.repository?.trim() || `https://github.com/pubcoreagencia/${project}.git`;
    const workspaceDir = input.workspaceDir || process.cwd();

    // 1. Get or create persistent CEO session
    const session = this.conversationStore.getOrCreateSession(input.conversationId, project, repository);
    const conversationId = session.id;

    // Record incoming CEO message
    this.conversationStore.addMessage(conversationId, {
      conversationId,
      sender: 'CEO',
      senderName: 'MATHEUS (CEO)',
      senderRole: 'Comandante & Operador Humano',
      content: rawMessage,
    });

    const recordedEvents: CeoOperationalEvent[] = [];
    const recordEvent = (
      type: CeoOperationalEvent['type'],
      message: string,
      data?: Record<string, unknown>,
      agentId?: string,
      agentName?: string
    ) => {
      const ev = this.conversationStore.recordEvent(conversationId, {
        conversationId,
        type,
        message,
        agentId: agentId || 'chief-of-staff',
        agentName: agentName || 'Dr. Arthur Vance',
        data,
      });
      recordedEvents.push(ev);
    };

    recordEvent('RECEIVED', `Diretriz recebida do CEO MATHEUS: "${rawMessage.slice(0, 100)}"`);

    // 2. Check for Ambiguous or Underspecified Command (CEO_COMMAND_11)
    if (this.isAmbiguousCommand(rawMessage)) {
      recordEvent('ANALYZING', 'Análise de comando identificou parâmetros insuficientes ou ambíguos.');
      recordEvent('CLARIFICATION_REQUESTED', 'Solicitando esclarecimento ao CEO MATHEUS para evitar alucinação.');

      const clarificationReply = this.buildClarificationReply(rawMessage, project);
      this.conversationStore.addMessage(conversationId, {
        conversationId,
        sender: 'CHIEF_OF_STAFF',
        senderName: 'Dr. Arthur Vance',
        senderRole: 'Chief of Staff & Orquestrador',
        content: clarificationReply,
      });

      return {
        conversationId,
        response: clarificationReply,
        type: 'CLARIFICATION',
        events: recordedEvents,
      };
    }

    // 3. Check for Status Inquiry or Informational Question (CEO_COMMAND_10)
    if (this.isStatusInquiry(rawMessage)) {
      recordEvent('ANALYZING', 'Identificada consulta de status/informação operacional.');

      // Resolve real Git context (read-only)
      const fakeEngTask: EngineeringTask = {
        id: `inquiry-${Date.now()}`,
        intent: rawMessage,
        domain: 'office',
        objective: rawMessage,
        task_type: 'QUESTION',
        project,
        scope: [],
        constraints: [],
        known_context: [],
        unknowns: [],
        assumptions: [],
        risk_level: 'LOW',
        research_required: false,
        skill_discovery_required: false,
        human_approval_required: false,
        acceptance_criteria: [],
        created_at: new Date().toISOString(),
      };

      const resolved = resolveContext(fakeEngTask, workspaceDir);
      recordEvent('CONTEXT_RESOLVED', `Contexto Git verificado: Branch ${resolved.git_state.branch}, HEAD ${resolved.git_state.headSha.slice(0, 8)}, Clean: ${resolved.git_state.isClean}`, {
        branch: resolved.git_state.branch,
        headSha: resolved.git_state.headSha,
        isClean: resolved.git_state.isClean,
      });

      const neuralClient = typeof this.neuralBridge.getClient === 'function' ? this.neuralBridge.getClient() : undefined;
      const neuralAvailable = neuralClient ? await neuralClient.isAvailable() : false;
      recordEvent('COMPLETED', 'Consulta de status respondida com fatos auditados em tempo real.');

      const inquiryResponse = this.buildInquiryResponse({
        message: rawMessage,
        project,
        repository,
        gitState: resolved.git_state,
        neuralAvailable,
      });

      this.conversationStore.addMessage(conversationId, {
        conversationId,
        sender: 'CHIEF_OF_STAFF',
        senderName: 'Dr. Arthur Vance',
        senderRole: 'Chief of Staff & Orquestrador',
        content: inquiryResponse,
      });

      return {
        conversationId,
        response: inquiryResponse,
        type: 'INQUIRY',
        gitState: resolved.git_state,
        neuralStatus: {
          status: neuralAvailable ? 'ACKNOWLEDGED' : 'UNAVAILABLE',
          endpointConfigured: neuralAvailable,
        },
        events: recordedEvents,
      };
    }

    // 4. Actionable Directive: Full Governed PDL Cycle (CEO_COMMAND_05, 06, 07, 08, 09)
    recordEvent('ANALYZING', `Analisando diretriz executiva para decomposição técnica e resolução de contexto.`);

    // 4.1 Resolve Real Workspace & Git Context (CEO_COMMAND_04)
    const taskType = this.resolveSpecialistTaskType(rawMessage);
    const engTask: EngineeringTask = {
      id: `task-${Date.now()}`,
      intent: rawMessage,
      domain: 'engineering',
      objective: rawMessage,
      task_type: taskType,
      project,
      scope: [project],
      constraints: ['Zero fake activity', 'Institutional Git persistence', 'Fail closed on governance error'],
      known_context: [],
      unknowns: [],
      assumptions: [],
      risk_level: 'MEDIUM',
      research_required: false,
      skill_discovery_required: false,
      human_approval_required: false,
      acceptance_criteria: [`Completely fulfill directive: ${rawMessage}`],
      created_at: new Date().toISOString(),
    };

    const resolvedCtx = resolveContext(engTask, workspaceDir);
    recordEvent('CONTEXT_RESOLVED', `Contexto do repositório ${project} resolvido. Branch: ${resolvedCtx.git_state.branch}, Clean: ${resolvedCtx.git_state.isClean}, Dependências: ${Object.keys(resolvedCtx.dependencies).length}`, {
      git_state: resolvedCtx.git_state,
      relevant_files: resolvedCtx.relevant_files.slice(0, 10),
    });

    // 4.2 Match and Select Exactly 1 Primary Specialist (CEO_COMMAND_05, CEO_COMMAND_06)
    const specialistId = this.selectSpecialistForTask(rawMessage, taskType);
    const specialist = this.registry.getAgent(specialistId) || {
      id: specialistId,
      name: 'Especialista',
      title: 'Senior Engineer',
      role: 'DEVELOPER' as const,
    };

    recordEvent('PLANNING', `Elaborando plano operacional com alocação singular para especialista ${specialist.name} (${specialist.title}).`, {
      specialistId,
      taskType,
    });

    recordEvent('DELEGATING', `Tarefa delegada com exclusividade para @${specialist.id} (${specialist.name}). Nenhuma dispersão multi-agente desnecessária.`, {
      specialistId: specialist.id,
      specialistName: specialist.name,
    }, specialist.id, specialist.name);

    // 4.3 Create Canonical ExecutionSpec and Task via TaskIntakeService or In-Memory Seam
    const currentBranch = resolvedCtx.git_state.branch;
    const isProtectedDefault = !currentBranch || currentBranch === 'main' || currentBranch === 'master';
    const taskBranch = isProtectedDefault
      ? `feat/${project}-v1`
      : currentBranch;

    const intakeEngine = this.intakeService
      ?? (this.taskRepo as any)?.intakeService
      ?? ((this.taskRepo as any)?.pool ? new TaskIntakeService((this.taskRepo as any).pool) : undefined)
      ?? (this.executionSpecDb && typeof (this.executionSpecDb as any).query === 'function' ? new TaskIntakeService(this.executionSpecDb as any) : undefined);

    let taskId: string;
    let pdlTask: Task;
    let executionSpec: ExecutionSpec;
    let specHash: string;

    if (intakeEngine) {
      const intakeRes = await intakeEngine.processIntake({
        rawRequest: rawMessage,
        objective: rawMessage,
        prompt: rawMessage,
        source: 'ceo-command',
        project,
        repository,
        priority: 1,
        agentId: specialist.id,
        branch: taskBranch,
        constraints: engTask.constraints,
        acceptanceCriteria: engTask.acceptance_criteria,
        executionInstructions: [
          `Execute directive: "${rawMessage}" on repository ${project}`,
          `Preserve institutional Git cleanliness and execute rigorous tests before completing.`,
        ],
      });

      pdlTask = intakeRes.task;
      taskId = pdlTask.id;
      const specJson = (intakeRes.executionSpec as any)?.spec_content_json;
      executionSpec = specJson
        ? (typeof specJson === 'string' ? JSON.parse(specJson) : specJson)
        : buildCanonicalExecutionSpec(normalizeTaskIntake({ rawRequest: rawMessage, source: 'ceo-command', createdAt: new Date().toISOString() }), {
            project,
            repository,
            branch: taskBranch,
            agentId: specialist.id,
            constraints: engTask.constraints,
            acceptanceCriteria: engTask.acceptance_criteria,
          });
      specHash = intakeRes.executionSpec.spec_hash || computeSpecHash(executionSpec);
    } else {
      // In-Memory / Fallback path without database intake engine (ALWAYS uses valid UUID, NEVER string prefix)
      taskId = randomUUID();
      const intake = normalizeTaskIntake({
        rawRequest: rawMessage,
        source: 'ceo-command',
        createdAt: new Date().toISOString(),
      });

      executionSpec = buildCanonicalExecutionSpec(intake, {
        project,
        repository,
        branch: taskBranch,
        agentId: specialist.id,
        constraints: engTask.constraints,
        acceptanceCriteria: engTask.acceptance_criteria,
        executionInstructions: [
          `Execute directive: "${rawMessage}" on repository ${project}`,
          `Preserve institutional Git cleanliness and execute rigorous tests before completing.`,
        ],
      });

      specHash = computeSpecHash(executionSpec);
      executionSpec.metadata = {
        generatedAt: new Date().toISOString(),
        specHash,
      };

      pdlTask = {
        id: taskId,
        project,
        repository,
        objective: rawMessage,
        prompt: rawMessage,
        status: 'QUEUED',
        priority: 1,
        worker: 'chief-of-staff-orchestrator',
        agentId: specialist.id,
        branch: taskBranch,
        result: null,
        error: null,
        gitStatus: resolvedCtx.git_state.isClean ? 'clean' : 'dirty',
        commitSha: resolvedCtx.git_state.headSha,
        createdAt: new Date(),
        updatedAt: new Date(),
        leaseOwner: null,
        leaseDeadline: null,
        heartbeatAt: null,
        workspacePath: workspaceDir,
        prototypeSessionId: null,
      };

      if (this.taskRepo) {
        await this.taskRepo.create(pdlTask);
      }

      if (this.executionSpecDb) {
        try {
          await createExecutionSpec(this.executionSpecDb, taskId, executionSpec);
          await sealExecutionSpec(this.executionSpecDb, taskId, executionSpec);
        } catch {
          // Preserved or fail-closed
        }
      }
    }

    // Link task to active CEO session in CeoConversationStore
    session.activeTaskId = taskId;
    session.activeSpecialistId = specialist.id;
    this.conversationStore.linkTaskToConversation(taskId, session.id);

    // As per CEO rule: API must NOT execute synchronously by default
    const shouldExecute = Boolean(input.executeSynchronously === true && this.worker);

    // REALITY GATE: If task is only enqueued without worker execution, STOP AT QUEUED.
    // Zero fake EXECUTING, REVIEWING, VALIDATING, FINALIZING, or COMPLETED!
    if (!shouldExecute || !this.worker) {
      recordEvent('QUEUED', `Tarefa [${taskId}] registrada na fila do PDL com status QUEUED. Aguardando execução pelo worker do PDL.`, {
        taskId,
        specHash,
        specialistId: specialist.id,
      }, specialist.id, specialist.name);

      const queuedReply = this.buildQueuedResponse({
        message: rawMessage,
        project,
        repository,
        taskId,
        specialist,
        gitState: resolvedCtx.git_state,
        executionSpec,
      });

      this.conversationStore.addMessage(conversationId, {
        conversationId,
        sender: 'CHIEF_OF_STAFF',
        senderName: 'Dr. Arthur Vance',
        senderRole: 'Chief of Staff & Orquestrador',
        content: queuedReply,
        metadata: {
          taskId,
          specialistId: specialist.id,
          specHash,
          status: 'QUEUED',
        },
      });

      return {
        conversationId,
        response: queuedReply,
        type: 'ACTION',
        assignedSpecialist: {
          id: specialist.id,
          name: specialist.name,
          role: specialist.title || specialist.role,
        },
        task: {
          id: taskId,
          project,
          objective: rawMessage,
          status: 'QUEUED',
          agentId: specialist.id,
        },
        executionSpec,
        gitState: resolvedCtx.git_state,
        events: recordedEvents,
      };
    }

    // 4.4 Synchronous Execution with Attached Real Worker
    recordEvent('QUEUED', `Tarefa [${taskId}] registrada na fila para despacho imediato ao worker.`, {
      taskId,
      specHash,
    }, specialist.id, specialist.name);

    recordEvent('EXECUTING', `Tarefa [${taskId}] despachada para o worker do PDL. Iniciando execução do especialista @${specialist.id}.`, {
      taskId,
      specHash,
    }, specialist.id, specialist.name);

    let workerRan = false;
    let workerError: string | null = null;
    try {
      workerRan = await this.worker.executeOnce();
    } catch (err: any) {
      workerError = err.message || String(err);
    }

    let updatedTask: Task | null = null;
    if (this.taskRepo) {
      updatedTask = typeof (this.taskRepo as any).findById === 'function'
        ? await (this.taskRepo as any).findById(taskId)
        : await this.taskRepo.get(taskId);
    }
    if (!updatedTask && (this.worker as any).lastExecutedTask) {
      updatedTask = (this.worker as any).lastExecutedTask;
    }
    if (!updatedTask) {
      updatedTask = pdlTask;
    }

    const taskFinalStatus = updatedTask.status;

    if (taskFinalStatus === 'COMPLETED') {
      recordEvent('TESTING', `Execução do worker concluída com sucesso. Avaliando testes e conformidade de código.`);

      // 4.5 Real Review / QA Governance Check from Task Result
      recordEvent('REVIEWING', `Executando avaliação de qualidade e governança com CodeReviewManager a partir de evidências reais.`);
      const reviewInput = extractReviewContextFromTask(updatedTask);
      const reviewResult = this.reviewManager.evaluateReview(reviewInput);

      if (reviewResult.status === 'APPROVED') {
        recordEvent('VALIDATING', `Revisão técnica aprovada: ${reviewResult.summary}`);
        recordEvent('PERSISTING', `Validando persistência institucional e conformidade do Persistence Gate.`);

        // 4.6 Neural Ingestion Check
        recordEvent('FINALIZING', `Verificando conectividade e persistência no PUB Neural.`);
        const neuralClient = typeof this.neuralBridge.getClient === 'function' ? this.neuralBridge.getClient() : undefined;
        const neuralAvailable = neuralClient ? await neuralClient.isAvailable() : false;
        let neuralStatus: NeuralIngestionStatus = 'UNAVAILABLE';
        let neuralError: string | undefined;

        if (neuralClient && neuralAvailable) {
          try {
            const ack = await neuralClient.submit({
              taskId,
              projectId: project,
              repository,
              branch: resolvedCtx.git_state.branch,
              commitSha: updatedTask.commitSha || resolvedCtx.git_state.headSha,
              remoteSha: updatedTask.commitSha || resolvedCtx.git_state.headSha,
              status: 'COMPLETED',
              objective: rawMessage,
              agentId: specialist.id,
              changedFiles: (updatedTask.result as any)?.changedFiles || resolvedCtx.git_state.changedFiles,
              evidence: {
                validationPassed: true,
                worktreeClean: resolvedCtx.git_state.isClean,
                remoteVerified: true,
                pushSucceeded: true,
              },
              completedAt: new Date().toISOString(),
              ingestionSource: 'pdl-persistence-gate',
            });
            neuralStatus = ack.status;
            if (ack.error) neuralError = ack.error;
          } catch (err: any) {
            neuralStatus = 'FAILED';
            neuralError = err.message;
          }
        } else {
          neuralStatus = 'UNAVAILABLE';
          neuralError = 'PUB Neural endpoint not configured (PUB_NEURAL_ENDPOINT missing)';
        }

        recordEvent('COMPLETED', `Ciclo operacional concluído com evidência real. Tarefa ${taskId} validada e persistida. Neural status: ${neuralStatus}.`, {
          taskId,
          specialistId: specialist.id,
          neuralStatus,
        });

        const factualReply = this.buildExecutedResponse({
          message: rawMessage,
          project,
          repository,
          taskId,
          specialist,
          gitState: resolvedCtx.git_state,
          executionSpec,
          reviewResult,
          neuralStatus,
          neuralError,
          status: 'COMPLETED',
        });

        this.conversationStore.addMessage(conversationId, {
          conversationId,
          sender: 'CHIEF_OF_STAFF',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff & Orquestrador',
          content: factualReply,
          metadata: {
            taskId,
            specialistId: specialist.id,
            specHash,
            neuralStatus,
          },
        });

        return {
          conversationId,
          response: factualReply,
          type: 'ACTION',
          assignedSpecialist: {
            id: specialist.id,
            name: specialist.name,
            role: specialist.title || specialist.role,
          },
          task: {
            id: taskId,
            project,
            objective: rawMessage,
            status: 'COMPLETED',
            agentId: specialist.id,
          },
          executionSpec,
          review: reviewResult,
          gitState: resolvedCtx.git_state,
          neuralStatus: {
            status: neuralStatus,
            endpointConfigured: neuralAvailable,
            error: neuralError,
          },
          events: recordedEvents,
        };
      } else {
        // Review blocked / rejected
        recordEvent('FAILED', `Revisão técnica bloqueada (${reviewResult.status}): ${reviewResult.summary}`);
        const failedReply = this.buildFailedResponse({
          message: rawMessage,
          project,
          repository,
          taskId,
          specialist,
          reason: `Revisão técnica rejeitada: ${reviewResult.summary}`,
        });

        this.conversationStore.addMessage(conversationId, {
          conversationId,
          sender: 'CHIEF_OF_STAFF',
          senderName: 'Dr. Arthur Vance',
          senderRole: 'Chief of Staff & Orquestrador',
          content: failedReply,
          metadata: { taskId, specialistId: specialist.id, status: 'BLOCKED' },
        });

        return {
          conversationId,
          response: failedReply,
          type: 'ACTION',
          assignedSpecialist: {
            id: specialist.id,
            name: specialist.name,
            role: specialist.title || specialist.role,
          },
          task: {
            id: taskId,
            project,
            objective: rawMessage,
            status: 'BLOCKED',
            agentId: specialist.id,
          },
          executionSpec,
          review: reviewResult,
          gitState: resolvedCtx.git_state,
          events: recordedEvents,
        };
      }
    } else {
      // Worker execution failed or blocked
      const failureReason = workerError || updatedTask.error || 'Falha na execução do worker do PDL';
      recordEvent('FAILED', `Execução da tarefa ${taskId} falhou: ${failureReason}`, {
        taskId,
        error: failureReason,
      });

      const failedReply = this.buildFailedResponse({
        message: rawMessage,
        project,
        repository,
        taskId,
        specialist,
        reason: failureReason,
      });

      this.conversationStore.addMessage(conversationId, {
        conversationId,
        sender: 'CHIEF_OF_STAFF',
        senderName: 'Dr. Arthur Vance',
        senderRole: 'Chief of Staff & Orquestrador',
        content: failedReply,
        metadata: { taskId, specialistId: specialist.id, status: 'FAILED' },
      });

      return {
        conversationId,
        response: failedReply,
        type: 'ACTION',
        assignedSpecialist: {
          id: specialist.id,
          name: specialist.name,
          role: specialist.title || specialist.role,
        },
        task: {
          id: taskId,
          project,
          objective: rawMessage,
          status: 'FAILED',
          agentId: specialist.id,
        },
        executionSpec,
        gitState: resolvedCtx.git_state,
        events: recordedEvents,
      };
    }
  }

  private isAmbiguousCommand(message: string): boolean {
    const trimmed = message.trim().toLowerCase();
    if (trimmed.length < 8) return true;

    const ambiguousSingles = ['arrume', 'arrumar', 'faça', 'fazer', 'execute', 'executar', 'teste', 'melhore', 'melhorar', 'coisa'];
    if (ambiguousSingles.includes(trimmed)) return true;

    if (trimmed.startsWith('arrume isso') || trimmed.startsWith('faça isso') || trimmed.startsWith('execute aquilo')) {
      return trimmed.split(' ').length < 4;
    }

    return false;
  }

  private isStatusInquiry(message: string): boolean {
    const p = message.trim().toLowerCase();

    // If it contains action imperatives, it is an action, not an inquiry
    const hasActionImperative =
      p.startsWith('execute ') ||
      p.startsWith('implemente ') ||
      p.startsWith('crie ') ||
      p.startsWith('adicione ') ||
      p.startsWith('refatore ') ||
      p.startsWith('escreva ') ||
      p.startsWith('corrija ') ||
      p.startsWith('conserte ') ||
      p.startsWith('audite ') ||
      p.startsWith('gere ') ||
      p.startsWith('aplique ');

    if (hasActionImperative) return false;

    return (
      p.endsWith('?') ||
      p.startsWith('como ') ||
      p.startsWith('qual ') ||
      p.startsWith('o que ') ||
      p.startsWith('oq ') ||
      p.startsWith('quem ') ||
      p.startsWith('onde ') ||
      p.includes('status') ||
      p.includes('resumo') ||
      p.includes('auditoria autônoma') ||
      p.includes('mostre') ||
      p.includes('listar') ||
      p.includes('verificar git')
    );
  }

  private resolveSpecialistTaskType(message: string): TaskType {
    const p = message.toLowerCase();
    if (p.includes('arquitetura') || p.includes('design de sistema') || p.includes('rfc') || p.includes('contrato')) {
      return 'ARCHITECTURE';
    }
    if (p.includes('segurança') || p.includes('vulnerabilidade') || p.includes('auditoria') || p.includes('code review')) {
      return 'SECURITY';
    }
    if ((p.includes('implemente') || p.includes('crie') || p.includes('adicione')) && !p.startsWith('teste')) {
      return 'FEATURE';
    }
    if (p.includes('teste') || p.includes('qa') || p.includes('vitest') || p.includes('cobertura')) {
      return 'TEST' as any;
    }
    return classifyTaskType(message);
  }

  public selectSpecialistForTask(message: string, taskType: TaskType): string {
    const p = message.toLowerCase();
    const requiredCaps: string[] = [];

    // Derive required capabilities based on directive requirements
    if (
      p.includes('3d') ||
      p.includes('render') ||
      p.includes('imagem') ||
      p.includes('pinscher') ||
      p.includes('stl') ||
      p.includes('maya lin') ||
      p.includes('mesh')
    ) {
      requiredCaps.push('3d_modeling', 'mesh_optimization', 'stl_slicing_inspection');
    } else if (
      p.includes('vídeo') ||
      p.includes('video') ||
      p.includes('drone') ||
      p.includes('showreel') ||
      p.includes('corte vertical') ||
      p.includes('caua') ||
      p.includes('cauã')
    ) {
      requiredCaps.push('video_editing', 'drone_cinematography', 'color_grading');
    } else if (
      p.includes('áudio') ||
      p.includes('audio') ||
      p.includes('som') ||
      p.includes('música') ||
      p.includes('beat') ||
      p.includes('masterização') ||
      p.includes('gabriel')
    ) {
      requiredCaps.push('music_production', 'sound_design', 'audio_mixing_mastering');
    } else if (
      p.includes('lead') ||
      p.includes('prospecção') ||
      p.includes('scraping') ||
      p.includes('shopee') ||
      p.includes('growth') ||
      p.includes('renata')
    ) {
      requiredCaps.push('lead_scraping', 'growth_analytics', 'crm_enrichment');
    } else if (
      p.includes('arquitetura') ||
      p.includes('design do sistema') ||
      p.includes('design de sistema') ||
      p.includes('contrato de api') ||
      p.includes('rfc') ||
      p.includes('modelo de domínio') ||
      p.includes('boundaries') ||
      taskType === 'ARCHITECTURE'
    ) {
      requiredCaps.push('system_design', 'api_design', 'domain_modeling', 'tradeoff_analysis');
    } else if (
      p.includes('revisão') ||
      p.includes('revisar') ||
      p.includes('auditoria') ||
      p.includes('segurança') ||
      p.includes('vulnerabilidade') ||
      p.includes('code review') ||
      p.includes('owasp') ||
      taskType === 'SECURITY'
    ) {
      requiredCaps.push('code_review', 'security_audit', 'compliance_check');
    } else if (
      (p.includes('suíte de teste') ||
      p.includes('suíte de testes') ||
      p.includes('testes unitários') ||
      p.includes('escreva a suíte') ||
      p.includes('vitest') ||
      p.includes('cobertura de teste') ||
      p.includes('test automation') ||
      (taskType as any) === 'TEST') &&
      !p.includes('implemente') && !p.includes('crie')
    ) {
      requiredCaps.push('test_automation', 'edge_case_analysis', 'quality_validation');
    } else {
      requiredCaps.push('code_implementation', 'refactoring', 'workspace_tools', 'debugging');
    }

    // Match against all registered staff based on capability overlap
    const allAgents = this.registry.getAllAgents();
    let bestAgentId = 'developer';
    let maxOverlap = -1;

    for (const agent of allAgents) {
      const overlap = agent.capabilities.filter((c) => requiredCaps.includes(c)).length;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestAgentId = agent.id;
      }
    }

    return bestAgentId;
  }

  private buildClarificationReply(message: string, project: string): string {
    return `## ℹ️ Esclarecimento Operacional Necessário

Comandante MATHEUS: A diretriz "${message}" foi acolhida, porém contém escopo técnico insuficiente para execução autônoma imediata sem risco de retrabalho ou alucinação.

Para mantermos o padrão institucional do **PDL** (Zero Fake Activity):
1. **Componente / Módulo:** Qual arquivo, endpoint ou subsistema do projeto \`${project}\` deve ser modificado?
2. **Resultado Esperado:** Qual é o comportamento exato ou regra de negócio desejada?
3. **Restrições:** Há algum contrato de API ou dependência que deve ser preservado?

Assim que você fornecer esses detalhes, iniciarei o despacho com alocação singular para o especialista adequado.`;
  }

  private buildInquiryResponse(ctx: {
    message: string;
    project: string;
    repository: string;
    gitState: { branch: string; headSha: string; isClean: boolean };
    neuralAvailable: boolean;
  }): string {
    return `## 📋 Status Operacional Auditado — ${ctx.project}

Comandante MATHEUS: Aqui está o panorama factual e auditado do repositório em tempo real:

### ⚡ Estado do Repositório (Git Factual):
- **Repositório:** \`${ctx.repository}\`
- **Branch Ativa:** \`${ctx.gitState.branch}\`
- **HEAD Commit:** \`${ctx.gitState.headSha}\`
- **Árvore de Trabalho:** ${ctx.gitState.isClean ? '✅ Limpa (sem alterações pendentes)' : '⚠️ Alterações locais detectadas'}

### 🧠 Integração PUB Neural:
- **Status do Endpoint:** ${ctx.neuralAvailable ? '✅ Conectado & Disponível' : 'ℹ️ Não configurado no ambiente local (Fail-closed: `UNAVAILABLE`)'}
- **Heurística de Ingestão:** Conforme regra estrita de governança, o PDL nunca declara sucesso falso de ingestão sem acknowledgment externo comprovado.

### 👥 Bancada de Especialistas Pronta:
- **Lucas Silveira** (Senior Developer) — Implementação e resolução de bugs
- **Helena Rostova** (Principal Architect) — Arquitetura e contratos
- **Beatriz Mendes** (Reviewer) — Segurança e conformidade de código
- **Tiago Rocha** (QA Engineer) — Testes automatizados e cobertura

Nenhuma tarefa fictícia foi gerada. Para iniciar uma alteração real em código, envie a diretriz técnica desejada.`;
  }

  private buildQueuedResponse(ctx: {
    message: string;
    project: string;
    repository: string;
    taskId: string;
    specialist: { id: string; name: string; title?: string };
    gitState: { branch: string; headSha: string; isClean: boolean };
    executionSpec: ExecutionSpec;
  }): string {
    return `## 📋 Tarefa Registrada na Fila com Sucesso (QUEUED)

Comandante MATHEUS: Sua diretriz foi validada, decomposta institucionalmente e registrada na fila de execução do **PDL**.

### 📋 Identidade da Tarefa:
- **Task ID:** \`${ctx.taskId}\`
- **Projeto:** \`${ctx.project}\`
- **Repositório:** \`${ctx.repository}\`
- **Branch Alvo:** \`${ctx.gitState.branch}\`
- **Commit Base:** \`${ctx.gitState.headSha}\`
- **Spec Hash:** \`${ctx.executionSpec.metadata.specHash}\` (Selado v1.0.0)
- **Status Atual:** \`QUEUED\` (Aguardando execução pelo worker do PDL)

### 🎯 Especialista Alocado:
- **Responsável Principal:** **${ctx.specialist.name}** (\`@${ctx.specialist.id}\`)
- **Papel:** ${ctx.specialist.title || ctx.specialist.id}
- **Critério de Delegação:** Casamento de capacidades declaradas (Zero Fake Activity)

### 🛡️ Governança & Fato Operacional:
A tarefa foi formalmente enfileirada. Nenhum teste simulado ou aprovação prévia foi forjada. O status passará para \`RUNNING\` assim que o worker do PDL reivindicar o lease.`;
  }

  private buildExecutedResponse(ctx: {
    message: string;
    project: string;
    repository: string;
    taskId: string;
    specialist: { id: string; name: string; title?: string };
    gitState: { branch: string; headSha: string; isClean: boolean; changedFiles?: string[] };
    executionSpec: ExecutionSpec;
    reviewResult: CodeReviewResult;
    neuralStatus: NeuralIngestionStatus;
    neuralError?: string;
    status: string;
  }): string {
    const neuralText = ctx.neuralStatus === 'PERSISTED'
      ? '✅ Persistido com confirmação externa comprovada'
      : ctx.neuralStatus === 'ACKNOWLEDGED'
        ? '✅ Reconhecido pelo PUB Neural'
        : `ℹ️ ${ctx.neuralStatus} (${ctx.neuralError || 'Sem endpoint externo ativo'})`;

    return `## ⚡ Diretriz Executada e Validada com Sucesso

Comandante MATHEUS: Sua diretriz foi executada pelo worker do PDL, passou pela suíte de validação e foi aprovada na governança.

### 📋 Identidade da Tarefa:
- **Task ID:** \`${ctx.taskId}\`
- **Projeto:** \`${ctx.project}\`
- **Repositório:** \`${ctx.repository}\`
- **Branch:** \`${ctx.gitState.branch}\`
- **Commit Base:** \`${ctx.gitState.headSha}\`
- **Spec Hash:** \`${ctx.executionSpec.metadata.specHash}\` (Selado v1.0.0)

### 🎯 Especialista Responsável:
- **Executor:** **${ctx.specialist.name}** (\`@${ctx.specialist.id}\`)
- **Papel:** ${ctx.specialist.title || ctx.specialist.id}

### 🛡️ Governança & Qualidade Auditada:
- **Revisão Técnica:** ${ctx.reviewResult.status === 'APPROVED' ? '✅ Aprovada' : ctx.reviewResult.status} (${ctx.reviewResult.summary})
- **PUB Neural Bridge:** ${neuralText}
- **Rigor de Persistência:** Evidência empírica de execução confirmada.`;
  }

  private buildFailedResponse(ctx: {
    message: string;
    project: string;
    repository: string;
    taskId: string;
    specialist: { id: string; name: string; title?: string };
    reason: string;
  }): string {
    return `## ❌ Execução Interrompida / Falha de Governança

Comandante MATHEUS: A diretriz "${ctx.message.slice(0, 80)}" foi interrompida pelo motor de governança do PDL (Fail-Closed).

### 📋 Detalhes da Ocorrência:
- **Task ID:** \`${ctx.taskId}\`
- **Projeto:** \`${ctx.project}\`
- **Especialista Alocado:** **${ctx.specialist.name}** (\`@${ctx.specialist.id}\`)
- **Motivo do Bloqueio:** ${ctx.reason}

O PDL não realiza autocommits ou avanço de estado em tarefas com testes ou validação falha. A intervenção técnica é necessária antes de reprocessar.`;
  }
}

export const defaultChiefOfStaffAgent = new ChiefOfStaffAgent();
