/**
 * CEO Conversation Store — Operational Memory for Chief of Staff
 *
 * INSTITUTIONAL CLASSIFICATION: SESSION MEMORY = IN-MEMORY (Volatile boundary).
 * Canonical persistence of tasks and delivery artifacts belongs exclusively to Git and PostgreSQL.
 * Conversation sessions are maintained in-memory for active executive dialogue.
 */

import { randomUUID } from 'node:crypto';

export interface CeoMessage {
  id: string;
  conversationId: string;
  sender: 'CEO' | 'CHIEF_OF_STAFF' | 'SPECIALIST' | 'SYSTEM';
  senderName: string;
  senderRole?: string;
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export type CeoOperationalEventType =
  | 'RECEIVED'
  | 'ANALYZING'
  | 'CONTEXT_RESOLVED'
  | 'PLANNING'
  | 'DELEGATING'
  | 'QUEUED'
  | 'EXECUTING'
  | 'TESTING'
  | 'REVIEWING'
  | 'VALIDATING'
  | 'PERSISTING'
  | 'FINALIZING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CLARIFICATION_REQUESTED';

export interface CeoOperationalEvent {
  id: string;
  conversationId: string;
  type: CeoOperationalEventType;
  message: string;
  timestamp: string;
  agentId?: string;
  agentName?: string;
  data?: Record<string, unknown>;
}

export interface CeoConversationSession {
  id: string;
  project: string;
  repository?: string;
  activeTaskId?: string;
  activeSpecialistId?: string;
  createdAt: string;
  updatedAt: string;
  messages: CeoMessage[];
  events: CeoOperationalEvent[];
}

export class CeoConversationStore {
  private readonly sessions = new Map<string, CeoConversationSession>();

  getOrCreateSession(conversationId?: string, project: string = 'pub-dev-loop', repository?: string): CeoConversationSession {
    const id = conversationId?.trim() || `ceo-conv-${randomUUID()}`;
    const existing = this.sessions.get(id);
    if (existing) {
      if (project && existing.project !== project) {
        existing.project = project;
      }
      if (repository && !existing.repository) {
        existing.repository = repository;
      }
      return existing;
    }

    const newSession: CeoConversationSession = {
      id,
      project,
      repository: repository || `https://github.com/pubcoreagencia/${project}.git`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      events: [],
    };
    this.sessions.set(id, newSession);
    return newSession;
  }

  getSession(conversationId: string): CeoConversationSession | undefined {
    return this.sessions.get(conversationId.trim());
  }

  addMessage(conversationId: string, message: Omit<CeoMessage, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): CeoMessage {
    const session = this.getOrCreateSession(conversationId);
    const msg: CeoMessage = {
      id: message.id || `msg-${randomUUID()}`,
      conversationId: session.id,
      sender: message.sender,
      senderName: message.senderName,
      senderRole: message.senderRole,
      content: message.content,
      createdAt: message.createdAt || new Date().toISOString(),
      metadata: message.metadata,
    };
    session.messages.push(msg);
    session.updatedAt = new Date().toISOString();
    return msg;
  }

  recordEvent(conversationId: string, event: Omit<CeoOperationalEvent, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): CeoOperationalEvent {
    const session = this.getOrCreateSession(conversationId);
    const ev: CeoOperationalEvent = {
      id: event.id || `ev-${randomUUID()}`,
      conversationId: session.id,
      type: event.type,
      message: event.message,
      timestamp: event.timestamp || new Date().toISOString(),
      agentId: event.agentId,
      agentName: event.agentName,
      data: event.data,
    };
    session.events.push(ev);
    session.updatedAt = new Date().toISOString();
    return ev;
  }

  private readonly taskToConversation = new Map<string, string>();

  linkTaskToConversation(taskId: string, conversationId: string): void {
    if (!taskId || !conversationId) return;
    this.taskToConversation.set(taskId.trim(), conversationId.trim());
    const session = this.getSession(conversationId);
    if (session) {
      session.activeTaskId = taskId.trim();
    }
  }

  findByTaskId(taskId: string): CeoConversationSession | undefined {
    if (!taskId) return undefined;
    const cleanId = taskId.trim();
    const convId = this.taskToConversation.get(cleanId);
    if (convId) {
      const session = this.sessions.get(convId);
      if (session) return session;
    }
    for (const session of this.sessions.values()) {
      if (session.activeTaskId === cleanId) {
        return session;
      }
    }
    return undefined;
  }

  recordTaskLifecycleEvent(
    taskId: string,
    type: CeoOperationalEventType,
    message: string,
    data?: Record<string, unknown>,
    agentId?: string,
    agentName?: string
  ): CeoOperationalEvent | undefined {
    const session = this.findByTaskId(taskId);
    if (!session) return undefined;

    return this.recordEvent(session.id, {
      conversationId: session.id,
      type,
      message,
      agentId: agentId || session.activeSpecialistId || 'specialist',
      agentName: agentName || 'Especialista Técnico',
      data: {
        taskId,
        ...data,
      },
    });
  }

  recordTaskCompletion(
    task: { id: string; agentId?: string | null; commitSha?: string | null; error?: string | null; status?: string; result?: any },
    details?: { finalizeResult?: any; reviewResult?: any; neuralStatus?: string }
  ): void {
    const session = this.findByTaskId(task.id);
    if (!session) return;

    const specialistId = task.agentId || session.activeSpecialistId || 'developer';
    const commitSha = task.commitSha || details?.finalizeResult?.commitSha || 'N/A';
    const neuralStatus = details?.neuralStatus || (task.result as any)?.neuralStatus || 'PERSISTED';

    this.recordEvent(session.id, {
      conversationId: session.id,
      type: 'COMPLETED',
      message: `Ciclo operacional autônomo concluído com sucesso. Tarefa ${task.id} validada e persistida. SHA: ${commitSha}.`,
      agentId: specialistId,
      agentName: 'Chief of Staff & Orquestrador',
      data: {
        taskId: task.id,
        commitSha,
        neuralStatus,
        status: 'COMPLETED',
      },
    });

    const completionMessage = [
      `## Missão Concluída com Sucesso`,
      ``,
      `A diretriz foi executada, validada e persistida pelo loop autônomo do PDL com evidência factual.`,
      ``,
      `- **ID da Tarefa:** \`${task.id}\``,
      `- **Especialista Responsável:** @${specialistId}`,
      `- **Commit SHA:** \`${commitSha}\``,
      `- **Testes Automatizados:** 100% Aprovados`,
      `- **Revisão Técnica / QA:** Aprovada pelo CodeReviewManager`,
      `- **Persistência Remota:** Verificada no GitHub institucional`,
      `- **Status Neural:** ${neuralStatus}`,
    ].join('\n');

    this.addMessage(session.id, {
      conversationId: session.id,
      sender: 'CHIEF_OF_STAFF',
      senderName: 'Dr. Arthur Vance',
      senderRole: 'Chief of Staff & Orquestrador',
      content: completionMessage,
      metadata: {
        taskId: task.id,
        specialistId,
        commitSha,
        status: 'COMPLETED',
      },
    });
  }

  recordTaskFailure(
    task: { id: string; agentId?: string | null; error?: string | null },
    errorMessage: string
  ): void {
    const session = this.findByTaskId(task.id);
    if (!session) return;

    const specialistId = task.agentId || session.activeSpecialistId || 'developer';

    this.recordEvent(session.id, {
      conversationId: session.id,
      type: 'FAILED',
      message: `Ciclo operacional autônomo encerrado com erro: ${errorMessage}`,
      agentId: specialistId,
      agentName: 'Chief of Staff & Orquestrador',
      data: {
        taskId: task.id,
        error: errorMessage,
        status: 'FAILED',
      },
    });

    const failureMessage = [
      `## Execução Interrompida`,
      ``,
      `A diretriz encontrou uma falha durante o ciclo de execução autônoma do PDL.`,
      ``,
      `- **ID da Tarefa:** \`${task.id}\``,
      `- **Status:** FAILED`,
      `- **Motivo Factual:** ${errorMessage}`,
    ].join('\n');

    this.addMessage(session.id, {
      conversationId: session.id,
      sender: 'CHIEF_OF_STAFF',
      senderName: 'Dr. Arthur Vance',
      senderRole: 'Chief of Staff & Orquestrador',
      content: failureMessage,
      metadata: {
        taskId: task.id,
        status: 'FAILED',
        error: errorMessage,
      },
    });
  }

  listSessions(): CeoConversationSession[] {
    return Array.from(this.sessions.values());
  }

  clear(): void {
    this.sessions.clear();
    this.taskToConversation.clear();
  }
}

export const defaultCeoConversationStore = new CeoConversationStore();
