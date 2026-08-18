import { create } from "zustand";
import type { Task } from "../types/task";
import type { Agent } from "../types/agent";
import { fetchTasks } from "../services/api";
import { deriveAgentsFromTasks } from "../services/agentAdapter";

interface State {
  tasks: Task[];
  agents: Agent[];
  selectedAgent?: Agent;
  loading: boolean;
  error?: string;
  loadData: () => Promise<void>;
  selectAgent: (agent?: Agent) => void;
}

export const useStore = create<State>((set, get) => ({
  tasks: [],
  agents: [],
  selectedAgent: undefined,
  loading: false,
  selectAgent: (agent) => set({ selectedAgent: agent }),
  async loadData() {
    try {
      const tasks = await fetchTasks();
      const agents = deriveAgentsFromTasks(tasks);

      // Keep selectedAgent in sync with latest data
      const currentSelected = get().selectedAgent;
      let updatedSelected = currentSelected;
      if (currentSelected) {
        const match = agents.find(
          (a) => a.id === currentSelected.id || a.taskId === currentSelected.taskId
        );
        if (match) {
          updatedSelected = match;
        }
      } else if (agents.length > 0) {
        // Auto-select first active agent if none selected
        updatedSelected = agents[0];
      }

      set({ tasks, agents, selectedAgent: updatedSelected, error: undefined });
    } catch (e: any) {
      set({ error: e.message ?? "Erro ao conectar com a API do PUB DEV LOOP" });
    }
  },
}));
