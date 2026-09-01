import { create } from "zustand";
import type { Task, CreateTaskInput, PrototypeSession, LogicalProject } from "../types/task";
import type { Agent } from "../types/agent";
import { fetchTasks, fetchSessions, createTask, cancelTask, retryTask } from "../services/api";
import { deriveAgentsFromTasks, groupSessionsIntoProjects } from "../services/agentAdapter";

const STORAGE_PROJECT_KEY = "pub-3d:last-project";

export type ModalType =
  | "CREATE_TASK"
  | "VIEW_TASK"
  | "VIEW_LOGS"
  | "VIEW_RESULT"
  | "CONFIRM_CANCEL"
  | "CONFIRM_RETRY"
  | null;

interface State {
  sessions: PrototypeSession[];
  projects: LogicalProject[];
  activeProject?: LogicalProject;
  activeSession?: PrototypeSession;
  projectSearch: string;
  tasks: Task[];
  agents: Agent[];
  selectedAgent?: Agent;
  selectedTask?: Task;
  activeModal: ModalType;
  modalPayload?: any;
  loading: boolean;
  actionLoading: boolean;
  error?: string;
  projectsError?: string;
  successMessage?: string;

  loadData: () => Promise<void>;
  selectProject: (project?: LogicalProject) => void;
  setProjectSearch: (query: string) => void;
  selectAgent: (agent?: Agent) => void;
  selectTask: (task?: Task) => void;
  openModal: (type: ModalType, payload?: any) => void;
  closeModal: () => void;
  setSuccessMessage: (msg?: string) => void;

  // Actions
  handleCreateTask: (input: CreateTaskInput) => Promise<Task>;
  handleCancelTask: (id: string) => Promise<Task>;
  handleRetryTask: (id: string) => Promise<Task>;
}

export const useStore = create<State>((set, get) => ({
  sessions: [],
  projects: [],
  activeProject: undefined,
  activeSession: undefined,
  projectSearch: "",
  tasks: [],
  agents: [],
  selectedAgent: undefined,
  selectedTask: undefined,
  activeModal: null,
  modalPayload: undefined,
  loading: false,
  actionLoading: false,
  error: undefined,
  projectsError: undefined,
  successMessage: undefined,

  setProjectSearch: (query: string) => {
    set({ projectSearch: query });
  },

  selectProject: (project) => {
    if (project) {
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.setItem(STORAGE_PROJECT_KEY, project.normalizedProject);
        } catch {}
      }
      set({
        activeProject: project,
        activeSession: project.latestSession,
      });
    } else {
      set({
        activeProject: undefined,
        activeSession: undefined,
      });
    }
  },

  selectAgent: (agent) => {
    const state = get();
    const task = agent ? state.tasks.find((t) => t.id === agent.taskId) : undefined;
    set({ selectedAgent: agent, selectedTask: task });
  },

  selectTask: (task) => {
    const state = get();
    const agent = task
      ? state.agents.find((a) => a.taskId === task.id)
      : undefined;
    set({ selectedTask: task, selectedAgent: agent });
  },

  openModal: (type, payload) => set({ activeModal: type, modalPayload: payload }),
  closeModal: () => set({ activeModal: null, modalPayload: undefined }),
  setSuccessMessage: (msg) => set({ successMessage: msg }),

  async loadData() {
    // 1. Fetch Sessions and group into Logical Projects
    try {
      const sessions = await fetchSessions();
      const logicalProjects = groupSessionsIntoProjects(sessions);

      // Restore active project: try localStorage first, fallback to current or latest
      let savedProjectKey: string | null = null;
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          savedProjectKey = window.localStorage.getItem(STORAGE_PROJECT_KEY);
        } catch {}
      }

      let targetProject: LogicalProject | undefined;

      if (savedProjectKey) {
        targetProject = logicalProjects.find((p) => p.normalizedProject === savedProjectKey);
      }

      if (!targetProject && get().activeProject) {
        const curNorm = get().activeProject!.normalizedProject;
        targetProject = logicalProjects.find((p) => p.normalizedProject === curNorm);
      }

      if (!targetProject && logicalProjects.length > 0) {
        targetProject = logicalProjects[0];
      }

      set({
        sessions,
        projects: logicalProjects,
        activeProject: targetProject,
        activeSession: targetProject?.latestSession,
        projectsError: undefined,
      });
    } catch (e: any) {
      set({ projectsError: e.message ?? "Erro ao carregar sessões de /prototype/sessions" });
    }

    // 2. Fetch Tasks from /tasks
    try {
      const tasks = await fetchTasks();
      const agents = deriveAgentsFromTasks(tasks);

      const currentSelectedAgent = get().selectedAgent;
      let updatedSelectedAgent = currentSelectedAgent;
      if (currentSelectedAgent) {
        const match = agents.find(
          (a) =>
            a.id === currentSelectedAgent.id || a.taskId === currentSelectedAgent.taskId
        );
        if (match) {
          updatedSelectedAgent = match;
        }
      } else if (agents.length > 0) {
        updatedSelectedAgent = agents[0];
      }

      const currentSelectedTask = get().selectedTask;
      let updatedSelectedTask = currentSelectedTask;
      if (currentSelectedTask) {
        const matchTask = tasks.find((t) => t.id === currentSelectedTask.id);
        if (matchTask) updatedSelectedTask = matchTask;
      } else if (updatedSelectedAgent) {
        updatedSelectedTask = tasks.find(
          (t) => t.id === updatedSelectedAgent?.taskId
        );
      }

      set({
        tasks,
        agents,
        selectedAgent: updatedSelectedAgent,
        selectedTask: updatedSelectedTask,
        error: undefined,
      });
    } catch (e: any) {
      set({ error: e.message ?? "Erro ao conectar com a API de tarefas do PUB DEV LOOP" });
    }
  },

  async handleCreateTask(input: CreateTaskInput) {
    set({ actionLoading: true, error: undefined });
    try {
      const newTask = await createTask(input);
      await get().loadData();
      get().selectTask(newTask);
      set({
        activeModal: null,
        successMessage: `Tarefa criada com sucesso na fila!`,
      });
      return newTask;
    } catch (e: any) {
      set({ error: e.message ?? "Falha ao criar tarefa" });
      throw e;
    } finally {
      set({ actionLoading: false });
    }
  },

  async handleCancelTask(id: string) {
    set({ actionLoading: true, error: undefined });
    try {
      const updated = await cancelTask(id);
      await get().loadData();
      set({
        activeModal: null,
        successMessage: `Tarefa ${id.slice(0, 8)} cancelada com sucesso!`,
      });
      return updated;
    } catch (e: any) {
      set({ error: e.message ?? "Falha ao cancelar tarefa" });
      throw e;
    } finally {
      set({ actionLoading: false });
    }
  },

  async handleRetryTask(id: string) {
    set({ actionLoading: true, error: undefined });
    try {
      const updated = await retryTask(id);
      await get().loadData();
      set({
        activeModal: null,
        successMessage: `Tarefa ${id.slice(0, 8)} reinserida na fila de execução!`,
      });
      return updated;
    } catch (e: any) {
      set({ error: e.message ?? "Falha ao reexecutar tarefa" });
      throw e;
    } finally {
      set({ actionLoading: false });
    }
  },
}));
