import type { Task, TaskState } from "../types/task";
import type { Agent, RoomId } from "../types/agent";

export const ROOM_MAPPING: Record<TaskState, RoomId> = {
  QUEUED: "PLANEJAMENTO",
  ASSIGNED: "PLANEJAMENTO",
  RUNNING: "DESENVOLVIMENTO",
  TESTING: "TESTES",
  NEEDS_REVIEW: "REVISÃO",
  COMPLETED: "LOUNGE",
  FAILED: "BLOQUEADOS",
  BLOCKED: "BLOQUEADOS",
  CANCELLED: "LOUNGE",
};

export const ROOM_COORDINATES: Record<RoomId, [number, number, number]> = {
  PLANEJAMENTO: [-11, 0, 7],
  DESENVOLVIMENTO: [0, 0, 7],
  TESTES: [11, 0, 7],
  REVISÃO: [-11, 0, -7],
  LOUNGE: [0, 0, -7],
  BLOQUEADOS: [11, 0, -7],
};

export const STATE_LABELS_PT: Record<TaskState, string> = {
  QUEUED: "EM FILA",
  ASSIGNED: "ATRIBUÍDO",
  RUNNING: "EM EXECUÇÃO",
  TESTING: "TESTANDO",
  NEEDS_REVIEW: "AGUARDANDO REVISÃO",
  COMPLETED: "CONCLUÍDO",
  FAILED: "FALHOU",
  BLOCKED: "BLOQUEADO",
  CANCELLED: "CANCELADO",
};

export function mapTaskToEvent(task: Task): string {
  switch (task.status) {
    case "QUEUED":
      return "Aguardando na fila de execução do orquestrador";
    case "ASSIGNED":
      return `Tarefa atribuída ao ${task.worker || "9Router Worker"}`;
    case "RUNNING":
      return "Executando raciocínio, ferramentas e alterações de código";
    case "TESTING":
      return "Executando testes automatizados e validação de workspace";
    case "NEEDS_REVIEW":
      return "Workspace validado com alterações pendentes de revisão";
    case "COMPLETED":
      return task.commitSha
        ? `Tarefa concluída com sucesso (Commit ${task.commitSha.slice(0, 7)})`
        : "Tarefa concluída com sucesso";
    case "FAILED":
      return task.error
        ? `Falha na execução: ${task.error.slice(0, 75)}`
        : "Falha durante execução do agente";
    case "BLOCKED":
      return "Execução bloqueada por dependência";
    case "CANCELLED":
      return "Tarefa cancelada pelo operador";
    default:
      return "Estado operacional monitorado";
  }
}

export function deriveAgentsFromTasks(tasks: Task[]): Agent[] {
  if (!tasks || tasks.length === 0) {
    return [];
  }

  // Identify active tasks (QUEUED, ASSIGNED, RUNNING, TESTING, NEEDS_REVIEW)
  const activeTasks = tasks.filter((t) =>
    ["RUNNING", "TESTING", "ASSIGNED", "QUEUED", "NEEDS_REVIEW"].includes(t.status)
  );

  // If no active tasks, display the most recent tasks as agents in their respective rooms
  const tasksToMap = activeTasks.length > 0 ? activeTasks : tasks.slice(0, 2);

  return tasksToMap.map((t) => {
    const rawResult = (t.result || {}) as Record<string, any>;
    const trace = rawResult.trace as Record<string, any> | undefined;
    const model =
      (rawResult.model as string) ||
      (trace?.attempts?.[0]?.model as string) ||
      "gemini-3.7-flash";
    const provider =
      (rawResult.provider as string) ||
      (t.worker && t.worker.toLowerCase().includes("router") ? "9Router" : "9Router");

    const created = new Date(t.createdAt).getTime();
    const updated = new Date(t.updatedAt).getTime();
    const durationMs = rawResult.durationMs
      ? Number(rawResult.durationMs)
      : Math.max(0, updated - created);
    const durationStr = durationMs > 0 ? `${Math.round(durationMs / 1000)}s` : "< 1s";

    const workerName = t.worker
      ? t.worker.toLowerCase().includes("router")
        ? "9Router Worker"
        : `Worker (${t.worker})`
      : "9Router Worker";

    return {
      id: `agent-${t.worker || t.id.slice(0, 8)}`,
      name: workerName,
      role: "Engenheiro de Software Autônomo",
      state: t.status,
      room: ROOM_MAPPING[t.status] || "PLANEJAMENTO",
      provider,
      model,
      taskId: t.id,
      project: t.project,
      repository: t.repository,
      startedAt: new Date(t.createdAt).toLocaleString("pt-BR"),
      duration: durationStr,
      lastEvent: mapTaskToEvent(t),
      commitSha: t.commitSha || null,
      error: t.error || null,
    };
  });
}
