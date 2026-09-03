import { create } from 'zustand';
import type {
  AgentDefinition,
  CeoIdentity,
  EmployeeOperationalState,
  MeetingRoomState,
  OrganizationalPlan,
  SpeechBubbleItem,
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

export interface OfficeState {
  ceo: CeoIdentity;
  agents: AgentDefinition[];
  meetingRoom: MeetingRoomState;
  speechBubbles: SpeechBubbleItem[];
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

  loadData: () => Promise<void>;
  selectAgent: (agent?: AgentDefinition | CeoIdentity) => void;
  selectTask: (task?: Task) => void;
  setActiveProject: (project: string) => void;
  submitObjective: (objective: string) => Promise<OrganizationalPlan>;
  executeStep: (plan: OrganizationalPlan, stepId: string) => Promise<Task>;
  executeAllSteps: (plan: OrganizationalPlan) => Promise<void>;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
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
    return diff < 60000; // Concluído no último minuto
  });
  if (completedRecent) {
    return 'celebrating';
  }

  return 'idle';
}

export const useStore = create<OfficeState>((set, get) => ({
  ceo: CEO_IDENTITY,
  agents: [],
  meetingRoom: INITIAL_MEETING_ROOM,
  speechBubbles: [],
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

  loadData: async () => {
    try {
      const [agentsData, tasksData, healthData] = await Promise.all([
        fetchAgents().catch(() => []),
        fetchTasks().catch(() => []),
        fetchHealth().catch(() => ({ status: 'offline' })),
      ]);

      set((state) => {
        // Enriquecer agentes com posições no escritório, avatar e estado operacional real
        const enrichedAgents: AgentDefinition[] = (agentsData.length > 0 ? agentsData : state.agents).map((agent) => {
          const position = AGENT_OFFICE_POSITIONS[agent.id] || {
            zoneId: 'ENGINEERING',
            zoneName: 'Área Geral',
            deskId: `mesa-${agent.id}`,
            deskLabel: `Mesa de ${agent.name}`,
            floor: 3,
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
            state.actionLoading,
            agent.id === 'chief-of-staff'
          );

          return {
            ...agent,
            position,
            avatar,
            operationalState,
          };
        });

        // Derivar eventos de atividade em pt-BR a partir de transições reais
        const newActivities: OfficeActivityEvent[] = [...state.activities];

        for (const task of tasksData) {
          const prev = state.tasks.find((t) => t.id === task.id);
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

        // Atualizar estado da Sala de Alinhamento
        const meetingRoom: MeetingRoomState = {
          ...state.meetingRoom,
          status: state.actionLoading ? 'EM_REUNIAO' : 'DISPONIVEL',
          topic: state.actionLoading ? 'Planejamento de Objetivo com Chief of Staff' : undefined,
          participants: state.actionLoading ? ['ceo', 'chief-of-staff'] : [],
        };

        return {
          agents: enrichedAgents,
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
  },

  triggerSpeechBubble: (bubble) => {
    const item: SpeechBubbleItem = {
      ...bubble,
      id: `bubble-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    };
    set((state) => ({
      speechBubbles: [...state.speechBubbles, item],
    }));

    setTimeout(() => {
      get().dismissSpeechBubble(item.id);
    }, bubble.durationMs || 5000);
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

    // 1. Adicionar mensagem do CEO ao chat
    state.addMessage({
      sender: 'CEO',
      senderName: 'CEO (Você)',
      content: objectiveText,
      type: 'TEXT',
    });

    state.triggerSpeechBubble({
      senderId: 'ceo',
      senderName: 'CEO',
      targetId: 'chief-of-staff',
      content: objectiveText.slice(0, 60) + (objectiveText.length > 60 ? '...' : ''),
      durationMs: 4000,
      type: 'CHAT',
    });

    try {
      // 2. Enviar para engine de planejamento organizacional do Chief of Staff no backend
      const plan = await createPlan(objectiveText, {
        project: state.activeProject,
      });

      // 3. Adicionar resposta com plano do Chief of Staff ao chat
      state.addMessage({
        sender: 'CHIEF_OF_STAFF',
        senderName: 'Chief of Staff',
        senderRole: 'Orquestração & Estratégia',
        content: `Objetivo estratégico compreendido. Formulei um Plano Organizacional com ${plan.steps.length} etapas delegadas aos especialistas.`,
        type: 'PLAN',
        plan,
      });

      state.triggerSpeechBubble({
        senderId: 'chief-of-staff',
        senderName: 'Chief of Staff',
        targetId: 'ceo',
        content: `Plano de ${plan.steps.length} etapas formulado!`,
        durationMs: 5000,
        type: 'PLAN',
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

      if (step?.agentId) {
        state.triggerSpeechBubble({
          senderId: step.agentId,
          senderName: step.agentId.toUpperCase(),
          content: `Iniciando: ${step.description.slice(0, 50)}...`,
          durationMs: 4000,
          type: 'TASK',
        });
      }

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
