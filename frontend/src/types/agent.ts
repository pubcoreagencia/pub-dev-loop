import type { TaskState } from "./task";

export type RoomId =
  | "PLANEJAMENTO"
  | "DESENVOLVIMENTO"
  | "TESTES"
  | "REVISÃO"
  | "LOUNGE"
  | "BLOQUEADOS";

export interface Agent {
  id: string;
  name: string;
  role: string;
  state: TaskState;
  room: RoomId;
  provider: string;
  model: string;
  taskId: string;
  project: string;
  repository: string;
  startedAt: string;
  duration: string;
  lastEvent: string;
  commitSha?: string | null;
  error?: string | null;
  prototypeSessionId?: string | null;
}
