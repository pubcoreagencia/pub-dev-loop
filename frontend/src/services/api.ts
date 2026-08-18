import type { Task } from "../types/task";
import type { Agent } from "../types/agent";
import { deriveAgentsFromTasks } from "./agentAdapter";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/*$/, "")}/`
  : "/";

function isJsonResponse(res: Response): boolean {
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json");
}

export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}health`);
  if (!res.ok) throw new Error(`Falha no health check: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error("Health response não é JSON");
  return await res.json();
}

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_BASE}tasks`);
  if (!res.ok) throw new Error(`Erro ao buscar tarefas: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error("Resposta de tarefas não é JSON");
  return (await res.json()) as Task[];
}

export async function fetchTask(id: string): Promise<Task> {
  const res = await fetch(`${API_BASE}tasks/${id}`);
  if (!res.ok) throw new Error(`Erro ao buscar tarefa ${id}: ${res.status}`);
  if (!isJsonResponse(res)) throw new Error("Resposta da tarefa não é JSON");
  return (await res.json()) as Task;
}

export async function fetchAgents(tasks?: Task[]): Promise<Agent[]> {
  const taskList = tasks ?? (await fetchTasks());
  return deriveAgentsFromTasks(taskList);
}
