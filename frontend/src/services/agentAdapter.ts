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
      prototypeSessionId: t.prototypeSessionId || null,
    };
  });
}

/**
 * Normalizes project names for deterministic deduplication and grouping:
 * - trim leading/trailing whitespace
 * - convert to lowercase
 * - collapse multiple consecutive spaces into a single space
 */
export function normalizeProjectName(name: string): string {
  if (!name || typeof name !== "string") return "untitled-prototype";
  const cleaned = name.trim().toLowerCase().replace(/\s+/g, " ");
  return cleaned.length > 0 ? cleaned : "untitled-prototype";
}

/**
 * Groups prototype sessions into logical projects (1 LogicalProject : N PrototypeSessions):
 * 1. Groups sessions by normalizedProject
 * 2. Selects the most recent session (by updatedAt) as latestSession
 * 3. Counts total sessions
 * 4. Sorts logical projects by latestSession.updatedAt in descending order
 */
export function groupSessionsIntoProjects(sessions: import("../types/task").PrototypeSession[]): import("../types/task").LogicalProject[] {
  if (!sessions || sessions.length === 0) return [];

  const groups = new Map<string, {
    canonicalName: string;
    sessions: import("../types/task").PrototypeSession[];
  }>();

  for (const session of sessions) {
    const rawName = session.project && session.project.trim().length > 0 ? session.project.trim() : "untitled-prototype";
    const key = normalizeProjectName(rawName);

    if (!groups.has(key)) {
      groups.set(key, {
        canonicalName: rawName,
        sessions: [session],
      });
    } else {
      const g = groups.get(key)!;
      g.sessions.push(session);
    }
  }

  const result: import("../types/task").LogicalProject[] = [];

  for (const [normalizedKey, group] of groups.entries()) {
    // Sort sessions in this group descending by updatedAt
    group.sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const latest = group.sessions[0];

    result.push({
      project: group.canonicalName,
      normalizedProject: normalizedKey,
      latestSession: latest,
      sessionCount: group.sessions.length,
      sessions: group.sessions,
    });
  }

  // Sort logical projects descending by latest session updatedAt
  result.sort((a, b) => new Date(b.latestSession.updatedAt).getTime() - new Date(a.latestSession.updatedAt).getTime());

  return result;
}

