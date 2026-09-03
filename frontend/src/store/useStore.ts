import { create } from 'zustand';
import type {
  AgentDefinition,
  CeoIdentity,
  EmployeeOperationalState,
  EmployeeSpatialState,
  MeetingRoomState,
  OrganizationalPlan,
  SpeechBubbleItem,
  OfficeEvent,
  Task,
  ChatMessage,
  OfficeActivityEvent,
} from '../types/office';
import {
  fetchAgents,
  fetchTasks,
  fetchHealth,
  createPlan,
  executePlanStep,
} from '../services/api';
import {
  CEO_IDENTITY,
  INITIAL_MEETING_ROOM,
  AGENT_AVATAR_PROFILES,
  AGENT_OFFICE_POSITIONS,
} from '../config/officeLayout';
import {
  OfficeEventStreamClient,
  type EventStreamStatus,
} from '../services/eventStream';

export interface OfficeState {
  ceo: CeoIdentity;
  agents: AgentDefinition[];
  meetingRoom: MeetingRoomState;
  speechBubbles: SpeechBubbleItem[];
  officeEvents: OfficeEvent[];
  tasks: Task[];
  plans: OrganizationalPlan[];
  activePlan?: OrganizationalPlan;
  selectedAgent?: AgentDefinition | CeoIdentity;
  selectedTask?: Task;
  messages: ChatMessage[];
  activities: OfficeActivityEvent[];
  activeProject: string;
  loading: boolean;
  actionLoading: boolean;
  error?: string;
  health?: { status: string; runtime?: string; [key: string]: any };
  streamStatus: EventStreamStatus;

  initStream: () => void;
  closeStream: () => void;
  loadData: () => Promise<void>;
  selectAgent: (agent?: AgentDefinition | CeoIdentity) => void;
  selectTask: (task?: Task) => void;
  setActiveProject: (project: string) => void;
  submitObjective: (objective: string) => Promise<OrganizationalPlan>;
  executeStep: (plan: OrganizationalPlan, stepId: string) => Promise<Task>;
  executeAllSteps: (plan: OrganizationalPlan) => Promise<void>;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  recordOfficeEvent: (event: Omit<OfficeEvent, 'id' | 'timestamp'>) => OfficeEvent;
  handleIncomingStreamEvent: (event: OfficeEvent) => void;
  triggerSpatialMovement: (agentId: string, targetAgentId?: string, purpose?: 'HANDOFF' | 'MEETING' | 'APPROVAL', durationMs?: number) => void;
  triggerSpeechBubble: (bubble: Omit<SpeechBubbleItem, 'id' | 'timestamp'>) => void;
  dismissSpeechBubble: (id: string) => void;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-init-1',
    sender: 'CHIEF_OF_STAFF',
    senderName: 'Chief of Staff',
    senderRole: 'Orquestração & Estratégia',
    content: 'Bom dia, CEO. O escritório está operacional e todos os especialistas (Arquiteto, Desenvolvedor, Revisor e Engenheiro de QA) estão em suas bancadas de trabalho. Envie um objetivo estratégico abaixo para iniciarmos o planejamento e a delegação autônoma.',
    timestamp: new Date().toLocaleTimeString('pt-BR'),
    type: 'TEXT',
  },
];

const observedTaskStatuses = new Map<string, string>();
const activeHandoffs = new Map<string, string>();
const activeSpatialStates = new Map<string, { spatialState: EmployeeSpatialState; facingDirection: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' }>();
const processedEventIds = new Set<string>();

let streamClient: OfficeEventStreamClient | null = null;

function deriveOperationalState(agentId: string, tasks: Task[], actionLoading: boolean, isChiefOfStaff: boolean): EmployeeOperationalState {
  if (isChiefOfStaff && actionLoading) {
    return 'thinking';
  }

  const agentTasks = tasks.filter((t) => t.agentId === agentId);
  const runningTask = agentTasks.find((t) => t.status === 'RUNNING');
  if (runningTask) {
    if (agentId === 'reviewer') return 'reviewing';
    return 'working';
  }

  const queuedTask = agentTasks.find((t) => t.status === 'QUEUED');
  if (queuedTask) {
    return 'waiting_for_dependency';
  }

  const blockedTask = agentTasks.find((t) => t.status === 'BLOCKED');
  if (blockedTask) {
    return 'blocked';
  }

  const completedRecent = agentTasks.find((t) => {
    if (t.status !== 'COMPLETED') return false;
    const diff = Date.now() - new Date(t.updatedAt || t.createdAt).getTime();
    return diff < 60000;
  });
  if (completedRecent) {
    return 'celebrating';
  }

  return 'idle';
}

function truncateText(text: string, maxLen = 50): string {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

export const useStore = create<OfficeState>((set, get) => ({
  ceo: CEO_IDENTITY,
  agents: [],
  meetingRoom: INITIAL_MEETING_ROOM,
  speechBubbles: [],
  officeEvents: [],
  tasks: [],
  plans: [],
  activePlan: undefined,
  selectedAgent: undefined,
  selectedTask: undefined,
  messages: INITIAL_MESSAGES,
  activities: [],
  activeProject: 'pub-dev-loop',
  loading: false,
  actionLoading: false,
  error: undefined,
  health: undefined,
  streamStatus: 'disconnected',

  initStream: () => {
    if (streamClient) {
      streamClient.close();
    }
    const state = get();
    streamClient = new OfficeEventStreamClient(
      state.activeProject,
      {
        onEvent: (evt) => {
          get().handleIncomingStreamEvent(evt);
        },
        onStatusChange: (status) => {
          set({ streamStatus: status });
        },
      }
    );
    streamClient.connect();
  },

  closeStream: () => {
    if (streamClient) {
      streamClient.close();
      streamClient = null;
    }
    set({ streamStatus: 'disconnected' });
  },

  triggerSpatialMovement: (agentId, targetAgentId, _purpose = 'HANDOFF', durationMs = 5000) => {
    // 1. Fase: Aproximando-se do destino espacial
    activeSpatialStates.set(agentId, {
      spatialState: 'approaching',
      facingDirection: targetAgentId === 'architect' || targetAgentId === 'reviewer' ? 'WEST' : 'EAST',
    });
    set((s) => ({
      agents: s.agents.map((a) => {
        if (a.id !== agentId) return a;
        const sp = activeSpatialStates.get(agentId)!;
        return { ...a, spatialState: sp.spatialState, facingDirection: sp.facingDirection };
      }),
      ceo: agentId === 'ceo' ? { ...s.ceo, spatialState: 'approaching' } : s.ceo,
    }));

    // 2. Fase: Interagindo no ponto de interação (após 1.4s)
    setTimeout(() => {
      activeSpatialStates.set(agentId, {
        spatialState: 'interacting',
        facingDirection: targetAgentId === 'architect' || targetAgentId === 'reviewer' ? 'WEST' : 'EAST',
      });
      set((s) => ({
        agents: s.agents.map((a) => {
          if (a.id !== agentId) return a;
          const sp = activeSpatialStates.get(agentId)!;
          return { ...a, spatialState: sp.spatialState, facingDirection: sp.facingDirection };
        }),
        ceo: agentId === 'ceo' ? { ...s.ceo, spatialState: 'interacting' } : s.ceo,
      }));
    }, 1400);

    // 3. Fase: Retornando ao posto de trabalho (após 3.8s)
    setTimeout(() => {
      activeSpatialStates.set(agentId, {
        spatialState: 'returning',
        facingDirection: 'SOUTH',
      });
      set((s) => ({
        agents: s.agents.map((a) => {
          if (a.id !== agentId) return a;
          const sp = activeSpatialStates.get(agentId)!;
          return { ...a, spatialState: sp.spatialState, facingDirection: sp.facingDirection };
        }),
        ceo: agentId === 'ceo' ? { ...s.ceo, spatialState: 'returning' } : s.ceo,
      }));
    }, 3800);

    // 4. Fase: Na bancada / idle (após durationMs)
    setTimeout(() => {
      activeSpatialStates.delete(agentId);
      set((s) => ({
        agents: s.agents.map((a) => {
          if (a.id !== agentId) return a;
          return { ...a, spatialState: 'idle', facingDirection: a.position?.facingDirection || 'SOUTH' };
        }),
        ceo: agentId === 'ceo' ? { ...s.ceo, spatialState: 'idle', facingDirection: 'SOUTH' } : s.ceo,
      }));
    }, durationMs);
  },

  handleIncomingStreamEvent: (event: OfficeEvent) => {
    if (processedEventIds.has(event.id)) {
      return;
    }
    processedEventIds.add(event.id);

    const state = get();

    // 1. Registrar no stream de eventos do office
    set((s) => ({
      officeEvents: [event, ...s.officeEvents.filter((e) => e.id !== event.id).slice(0, 99)],
    }));

    // 2. Processar efeitos semânticos e espaciais
    switch (event.type) {
      case 'OBJECTIVE_SUBMITTED':
        state.triggerSpeechBubble({
          senderId: 'ceo',
          senderName: 'CEO',
          targetId: 'chief-of-staff',
          content: truncateText(event.payload?.objective || event.summary, 55),
          durationMs: 4000,
          type: 'CHAT',
        });
        state.triggerSpatialMovement('chief-of-staff', undefined, 'MEETING', 6000);
        state.triggerSpatialMovement('ceo', undefined, 'MEETING', 6000);
        break;

      case 'PLAN_FORMULATED':
        state.triggerSpeechBubble({
          senderId: 'chief-of-staff',
          senderName: 'Chief of Staff',
          targetId: 'ceo',
          content: `Plano de ${event.payload?.stepCount || 'múltiplas'} etapas formulado!`,
          durationMs: 5000,
          type: 'PLAN',
        });
        break;

      case 'STEP_DELEGATED':
        if (event.targetId) {
          state.triggerSpeechBubble({
            senderId: event.targetId,
            senderName: event.targetId.toUpperCase(),
            content: `Etapa delegada: ${truncateText(event.summary, 45)}`,
            durationMs: 4000,
            type: 'TASK',
          });
        }
        break;

      case 'AGENT_STARTED_WORK':
        if (event.actorId) {
          state.triggerSpeechBubble({
            senderId: event.actorId,
            senderName: event.actorId.toUpperCase(),
            content: `Trabalhando: ${truncateText(event.summary, 45)}`,
            durationMs: 4000,
            type: 'TASK',
          });
        }
        break;

      case 'AGENT_FINISHED_WORK':
        if (event.actorId) {
          state.triggerSpeechBubble({
            senderId: event.actorId,
            senderName: event.actorId.toUpperCase(),
            content: `Concluído: ${truncateText(event.summary, 45)}`,
            durationMs: 5000,
            type: 'TASK',
          });
        }
        break;

      case 'AGENT_FAILED_WORK':
        if (event.actorId) {
          state.triggerSpeechBubble({
            senderId: event.actorId,
            senderName: event.actorId.toUpperCase(),
            content: `Erro: ${truncateText(event.summary, 40)}`,
            durationMs: 4500,
            type: 'TASK',
          });
        }
        break;

      case 'AGENT_HANDOFF':
        if (event.targetId && event.actorId) {
          activeHandoffs.set(event.targetId, event.actorId);
          // Disparo de movimento espacial determinístico para o handoff real
          state.triggerSpatialMovement(event.targetId, event.actorId, 'HANDOFF', 6000);
          setTimeout(() => {
            activeHandoffs.delete(event.targetId!);
            get().loadData();
          }, 12000);
        }
        break;

      case 'MEETING_STARTED':
        set((s) => ({
          meetingRoom: {
            ...s.meetingRoom,
            status: 'EM_REUNIAO',
            topic: event.summary,
            participants: event.payload?.participants || ['ceo', 'chief-of-staff'],
          },
        }));
        state.triggerSpatialMovement('chief-of-staff', undefined, 'MEETING', 8000);
        state.triggerSpatialMovement('ceo', undefined, 'MEETING', 8000);
        break;

      case 'MEETING_ENDED':
        set((s) => ({
          meetingRoom: {
            ...s.meetingRoom,
            status: 'DISPONIVEL',
            topic: undefined,
            participants: [],
          },
        }));
        break;

      case 'MESSAGE_SENT':
      case 'MESSAGE_RECEIVED':
      case 'AGENT_RESPONDED':
        if (event.actorId) {
          state.triggerSpeechBubble({
            senderId: event.actorId,
            senderName: event.actorId.toUpperCase(),
            targetId: event.targetId,
            content: truncateText(event.summary, 55),
            durationMs: 4500,
            type: 'CHAT',
          });
        }
        break;
    }
  },

  loadData: async () => {
    try {
      const [agentsData, tasksData, healthData] = await Promise.all([
        fetchAgents().catch(() => []),
        fetchTasks().catch(() => []),
        fetchHealth().catch(() => ({ status: 'offline' })),
      ]);

      const state = get();

      for (const task of tasksData) {
        const prevStatus = observedTaskStatuses.get(task.id);

        if (!prevStatus) {
          observedTaskStatuses.set(task.id, task.status);
        } else if (prevStatus !== task.status) {
          observedTaskStatuses.set(task.id, task.status);

          if (task.status === 'COMPLETED' && task.agentId) {
            state.recordOfficeEvent({
              type: 'AGENT_FINISHED_WORK',
              actorId: task.agentId,
              taskId: task.id,
              summary: `Concluiu com sucesso: ${truncateText(task.result?.summary || task.objective, 40)}`,
            });
          } else if (task.status === 'FAILED' && task.agentId) {
            state.recordOfficeEvent({
              type: 'AGENT_FAILED_WORK',
              actorId: task.agentId,
              taskId: task.id,
              summary: `Falhou: ${truncateText(task.error || 'Erro na execução', 40)}`,
            });
          } else if (task.status === 'RUNNING' && task.agentId) {
            state.recordOfficeEvent({
              type: 'AGENT_STARTED_WORK',
              actorId: task.agentId,
              taskId: task.id,
              summary: `Iniciou execução: ${truncateText(task.objective, 40)}`,
            });
          }
        }
      }

      set((s) => {
        const enrichedAgents: AgentDefinition[] = (agentsData.length > 0 ? agentsData : s.agents).map((agent) => {
          const position = AGENT_OFFICE_POSITIONS[agent.id] || {
            zoneId: 'ENGINEERING',
            zoneName: 'Área Geral',
            deskId: `mesa-${agent.id}`,
            deskLabel: `Mesa de ${agent.name}`,
            floor: 3,
            facingDirection: 'SOUTH',
          };
          const avatar = AGENT_AVATAR_PROFILES[agent.id] || {
            avatarId: `avatar-${agent.id}`,
            displayName: agent.name,
            roleLabel: agent.title,
            badgeIcon: '💼',
            accentColor: '#94a3b8',
            initials: agent.name.slice(0, 2).toUpperCase(),
          };
          const operationalState = deriveOperationalState(
            agent.id,
            tasksData,
            s.actionLoading,
            agent.id === 'chief-of-staff'
          );
          const spatialInfo = activeSpatialStates.get(agent.id) || {
            spatialState: 'idle' as EmployeeSpatialState,
            facingDirection: position.facingDirection || 'SOUTH',
          };

          return {
            ...agent,
            position,
            avatar,
            operationalState,
            spatialState: spatialInfo.spatialState,
            facingDirection: spatialInfo.facingDirection,
            lastHandoffFrom: activeHandoffs.get(agent.id),
          };
        });

        const newActivities: OfficeActivityEvent[] = [...s.activities];

        for (const task of tasksData) {
          const prev = s.tasks.find((t) => t.id === task.id);
          if (!prev) {
            newActivities.unshift({
              id: `act-${task.id}-${Date.now()}`,
              timestamp: new Date(task.createdAt || Date.now()).toLocaleTimeString('pt-BR'),
              type: 'TASK_RUNNING',
              title: `Tarefa Criada: ${task.agentId ? `[${task.agentId.toUpperCase()}]` : ''} ${task.objective.slice(0, 40)}...`,
              description: `Status: ${task.status === 'RUNNING' ? 'Em Execução' : task.status} | Worker: ${task.worker}`,
              agentId: task.agentId || undefined,
              taskId: task.id,
            });
          } else if (prev.status !== task.status) {
            const isDone = task.status === 'COMPLETED';
            const isFail = task.status === 'FAILED';
            newActivities.unshift({
              id: `act-status-${task.id}-${Date.now()}`,
              timestamp: new Date(task.updatedAt || Date.now()).toLocaleTimeString('pt-BR'),
              type: isDone ? 'TASK_COMPLETED' : isFail ? 'TASK_FAILED' : 'TASK_RUNNING',
              title: `Tarefa ${isDone ? 'Concluída' : isFail ? 'Falhou' : 'Atualizada'}: ${task.id.slice(0, 16)}`,
              description: task.result?.summary ? task.result.summary.slice(0, 100) : `Transição de ${prev.status} para ${task.status}`,
              agentId: task.agentId || undefined,
              taskId: task.id,
            });
          }
        }

        const meetingRoom: MeetingRoomState = {
          ...s.meetingRoom,
          status: s.actionLoading ? 'EM_REUNIAO' : 'DISPONIVEL',
          topic: s.actionLoading ? 'Planejamento de Objetivo com Chief of Staff' : undefined,
          participants: s.actionLoading ? ['ceo', 'chief-of-staff'] : [],
        };

        const ceoSpatial = activeSpatialStates.get('ceo') || {
          spatialState: 'idle' as EmployeeSpatialState,
          facingDirection: 'SOUTH' as const,
        };

        return {
          agents: enrichedAgents,
          ceo: {
            ...s.ceo,
            spatialState: ceoSpatial.spatialState,
            facingDirection: ceoSpatial.facingDirection,
          },
          tasks: tasksData,
          health: healthData,
          meetingRoom,
          activities: newActivities.slice(0, 50),
          error: undefined,
        };
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  selectAgent: (agent) => {
    set({ selectedAgent: agent });
  },

  selectTask: (task) => {
    set({ selectedTask: task });
  },

  setActiveProject: (project) => {
    set({ activeProject: project });
    get().initStream();
  },

  recordOfficeEvent: (eventData) => {
    const fullEvent: OfficeEvent = {
      ...eventData,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    };
    if (!processedEventIds.has(fullEvent.id)) {
      processedEventIds.add(fullEvent.id);
      set((state) => ({
        officeEvents: [fullEvent, ...state.officeEvents.slice(0, 99)],
      }));
    }
    return fullEvent;
  },

  triggerSpeechBubble: (bubble) => {
    const item: SpeechBubbleItem = {
      ...bubble,
      id: `bubble-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    };

    set((state) => ({
      speechBubbles: [
        ...state.speechBubbles.filter((b) => b.senderId !== bubble.senderId),
        item,
      ],
    }));

    setTimeout(() => {
      get().dismissSpeechBubble(item.id);
    }, bubble.durationMs || 4500);
  },

  dismissSpeechBubble: (id) => {
    set((state) => ({
      speechBubbles: state.speechBubbles.filter((b) => b.id !== id),
    }));
  },

  addMessage: (msg) => {
    const fullMsg: ChatMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    };
    set((state) => ({ messages: [...state.messages, fullMsg] }));
  },

  submitObjective: async (objectiveText: string) => {
    const state = get();
    set({ actionLoading: true, error: undefined });

    state.addMessage({
      sender: 'CEO',
      senderName: 'CEO (Você)',
      content: objectiveText,
      type: 'TEXT',
    });

    try {
      const plan = await createPlan(objectiveText, {
        project: state.activeProject,
      });

      state.addMessage({
        sender: 'CHIEF_OF_STAFF',
        senderName: 'Chief of Staff',
        senderRole: 'Orquestração & Estratégia',
        content: `Objetivo estratégico compreendido. Formulei um Plano Organizacional com ${plan.steps.length} etapas delegadas aos especialistas.`,
        type: 'PLAN',
        plan,
      });

      set((s) => ({
        plans: [plan, ...s.plans],
        activePlan: plan,
        actionLoading: false,
      }));

      return plan;
    } catch (err: any) {
      state.addMessage({
        sender: 'SYSTEM',
        senderName: 'Despachante do Escritório',
        content: `Erro ao formular plano organizacional: ${err.message}`,
        type: 'ERROR',
      });
      set({ actionLoading: false, error: err.message });
      throw err;
    }
  },

  executeStep: async (plan: OrganizationalPlan, stepId: string) => {
    const state = get();
    set({ actionLoading: true });
    const step = plan.steps.find((s) => s.id === stepId);

    try {
      const task = await executePlanStep(plan, stepId);

      state.addMessage({
        sender: 'AGENT',
        senderName: step?.agentId?.toUpperCase() || 'AGENTE ESPECIALISTA',
        senderRole: step?.agentId ? `Especialista Alocado (${step.agentId})` : 'Especialista',
        content: `Iniciando execução da etapa '${step?.id}': ${step?.description}`,
        type: 'EXECUTION',
        task,
        stepId,
      });

      await state.loadData();
      set({ actionLoading: false });
      return task;
    } catch (err: any) {
      state.addMessage({
        sender: 'SYSTEM',
        senderName: 'Despachante do Escritório',
        content: `Falha ao disparar etapa ${stepId}: ${err.message}`,
        type: 'ERROR',
      });
      set({ actionLoading: false, error: err.message });
      throw err;
    }
  },

  executeAllSteps: async (plan: OrganizationalPlan) => {
    const state = get();
    set({ actionLoading: true });
    try {
      for (const step of plan.steps) {
        await executePlanStep(plan, step.id);
      }
      state.addMessage({
        sender: 'CHIEF_OF_STAFF',
        senderName: 'Chief of Staff',
        senderRole: 'Orquestração',
        content: `Todas as ${plan.steps.length} etapas foram despachadas com sucesso para as filas de execução dos especialistas.`,
        type: 'SYSTEM',
      });
      await state.loadData();
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set({ actionLoading: false });
    }
  },
}));
