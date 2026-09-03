import { create } from 'zustand';
import type {
  AgentDefinition,
  OrganizationalPlan,
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

interface OfficeState {
  agents: AgentDefinition[];
  tasks: Task[];
  plans: OrganizationalPlan[];
  activePlan?: OrganizationalPlan;
  selectedAgent?: AgentDefinition;
  selectedTask?: Task;
  messages: ChatMessage[];
  activities: OfficeActivityEvent[];
  activeProject: string;
  loading: boolean;
  actionLoading: boolean;
  error?: string;
  health?: { status: string; runtime?: string; [key: string]: any };

  loadData: () => Promise<void>;
  selectAgent: (agent?: AgentDefinition) => void;
  selectTask: (task?: Task) => void;
  setActiveProject: (project: string) => void;
  submitObjective: (objective: string) => Promise<OrganizationalPlan>;
  executeStep: (plan: OrganizationalPlan, stepId: string) => Promise<Task>;
  executeAllSteps: (plan: OrganizationalPlan) => Promise<void>;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-init-1',
    sender: 'CHIEF_OF_STAFF',
    senderName: 'Chief of Staff',
    senderRole: 'Orchestrator & Strategy',
    content: 'Good morning, CEO. The office is online and all specialists (Architect, Developer, Reviewer, QA Engineer) are standing by at their desks. Provide an objective below to initiate planning and autonomous delegation.',
    timestamp: new Date().toLocaleTimeString(),
    type: 'TEXT',
  },
];

export const useStore = create<OfficeState>((set, get) => ({
  agents: [],
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
        const newActivities: OfficeActivityEvent[] = [...state.activities];

        for (const task of tasksData) {
          const prev = state.tasks.find((t) => t.id === task.id);
          if (!prev) {
            newActivities.unshift({
              id: `act-${task.id}-${Date.now()}`,
              timestamp: new Date(task.createdAt || Date.now()).toLocaleTimeString(),
              type: 'TASK_RUNNING',
              title: `Task Created: ${task.agentId ? `[${task.agentId.toUpperCase()}]` : ''} ${task.objective.slice(0, 40)}...`,
              description: `Status: ${task.status} | Worker: ${task.worker}`,
              agentId: task.agentId || undefined,
              taskId: task.id,
            });
          } else if (prev.status !== task.status) {
            newActivities.unshift({
              id: `act-status-${task.id}-${Date.now()}`,
              timestamp: new Date(task.updatedAt || Date.now()).toLocaleTimeString(),
              type: task.status === 'COMPLETED' ? 'TASK_COMPLETED' : task.status === 'FAILED' ? 'TASK_FAILED' : 'TASK_RUNNING',
              title: `Task ${task.status}: ${task.id.slice(0, 16)}`,
              description: task.result?.summary ? task.result.summary.slice(0, 100) : `Transitioned from ${prev.status} to ${task.status}`,
              agentId: task.agentId || undefined,
              taskId: task.id,
            });
          }
        }

        return {
          agents: agentsData.length > 0 ? agentsData : state.agents,
          tasks: tasksData,
          health: healthData,
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

  addMessage: (msg) => {
    const fullMsg: ChatMessage = {
      ...msg,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
    };
    set((state) => ({ messages: [...state.messages, fullMsg] }));
  },

  submitObjective: async (objectiveText: string) => {
    const state = get();
    set({ actionLoading: true, error: undefined });

    state.addMessage({
      sender: 'CEO',
      senderName: 'CEO (You)',
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
        senderRole: 'Orchestrator & Strategy',
        content: `Objective received. I have formulated an Organizational Plan with ${plan.steps.length} delegated steps.`,
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
        senderName: 'The Office Dispatcher',
        content: `Error creating organizational plan: ${err.message}`,
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
        senderName: step?.agentId?.toUpperCase() || 'SPECIALIST AGENT',
        senderRole: step?.agentId ? `Assigned Specialist (${step.agentId})` : 'Agent',
        content: `Commencing work on step '${step?.id}': ${step?.description}`,
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
        senderName: 'The Office Dispatcher',
        content: `Failed to execute step ${stepId}: ${err.message}`,
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
        senderRole: 'Orchestrator',
        content: `All ${plan.steps.length} steps have been dispatched to their assigned specialists in the execution queue.`,
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
