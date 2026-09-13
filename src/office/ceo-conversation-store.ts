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

  listSessions(): CeoConversationSession[] {
    return Array.from(this.sessions.values());
  }

  clear(): void {
    this.sessions.clear();
  }
}

export const defaultCeoConversationStore = new CeoConversationStore();
