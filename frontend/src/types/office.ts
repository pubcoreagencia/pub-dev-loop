export type AgentDepartment = 'EXECUTIVE' | 'ENGINEERING' | 'QA';

export type AgentRole =
  | 'CHIEF_OF_STAFF'
  | 'ARCHITECT'
  | 'DEVELOPER'
  | 'REVIEWER'
  | 'QA_ENGINEER'
  | 'CEO';

export type AgentRoutingProfile =
  | 'reasoning'
  | 'coding'
  | 'review'
  | 'fast_prototype'
  | 'general';

export type AgentStatus = 'ACTIVE' | 'IDLE' | 'PAUSED' | 'DEPRECATED';

export type EmployeeOperationalState =
  | 'idle'
  | 'working'
  | 'thinking'
  | 'reviewing'
  | 'collaborating'
  | 'in_meeting'
  | 'waiting_for_dependency'
  | 'waiting_for_approval'
  | 'celebrating'
  | 'learning'
  | 'offline'
  | 'blocked';

export interface OfficePosition {
  zoneId: 'CEO_SUITE' | 'LEADERSHIP' | 'ENGINEERING' | 'QA' | 'MEETING_ROOM';
  zoneName: string;
  deskId: string;
  deskLabel: string;
  floor: number;
}

export interface AvatarProfile {
  avatarId: string;
  displayName: string;
  roleLabel: string;
  badgeIcon: string;
  accentColor: string;
  initials: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  title: string;
  department: AgentDepartment;
  role: AgentRole;
  specialty: string;
  personalitySummary: string;
  responsibilities: string[];
  capabilities: string[];
  routingProfile: AgentRoutingProfile;
  preferredModel?: string;
  systemPromptBase?: string;
  isManager?: boolean;
  reportsTo?: string | null;
  status: AgentStatus;
  position?: OfficePosition;
  avatar?: AvatarProfile;
  operationalState?: EmployeeOperationalState;
}

export interface CeoIdentity {
  id: 'ceo';
  name: string;
  title: string;
  role: 'CEO';
  status: 'ACTIVE';
  personalitySummary: string;
  specialty: string;
  position: OfficePosition;
  avatar: AvatarProfile;
}

export interface MeetingRoomState {
  id: string;
  name: string;
  status: 'DISPONIVEL' | 'EM_REUNIAO';
  topic?: string;
  participants: string[];
  activePlanId?: string;
  startedAt?: string;
}

export interface SpeechBubbleItem {
  id: string;
  senderId: string;
  senderName: string;
  targetId?: string;
  content: string;
  timestamp: string;
  durationMs: number;
  type: 'CHAT' | 'PLAN' | 'TASK' | 'MEETING';
}

export type PlanStepStatus = 'PENDING' | 'READY' | 'ASSIGNED' | 'UNRESOLVED';

export interface PlanStep {
  id: string;
  description: string;
  prompt: string;
  agentId: string | null;
  assignmentSource: 'EXPLICIT' | 'ORGANIZATIONAL_SUGGESTION' | 'UNRESOLVED';
  compatibility: {
    compatible: boolean;
    score: number;
    reasons: string[];
  };
  dependsOn: string[];
  status: PlanStepStatus;
}

export type OrganizationalPlanStatus = 'DRAFT' | 'READY' | 'INVALID';

export interface OrganizationalPlan {
  id: string;
  objective: string;
  project: string;
  repository: string;
  createdBy: 'chief-of-staff';
  steps: PlanStep[];
  status: OrganizationalPlanStatus;
  validationErrors: string[];
  createdAt: string;
}

export interface TaskTraceAttempt {
  attempt: number;
  provider: string;
  model: string;
  status: string;
  latencyMs?: number;
  fallbackUsed?: boolean;
}

export interface TaskTrace {
  provider: string;
  model: string;
  attempts?: TaskTraceAttempt[];
  fallbackUsed?: boolean;
}

export interface TaskResult {
  provider?: string;
  model?: string;
  summary?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs?: number;
  fallbackUsed?: boolean;
  trace?: TaskTrace;
}

export interface Task {
  id: string;
  project: string;
  repository: string;
  objective: string;
  prompt: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'BLOCKED';
  priority: number;
  worker: string;
  agentId: string | null;
  result: TaskResult | null;
  error: string | null;
  branch: string | null;
  commitSha: string | null;
  gitStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'CEO' | 'CHIEF_OF_STAFF' | 'AGENT' | 'SYSTEM';
  senderName: string;
  senderRole?: string;
  content: string;
  timestamp: string;
  type: 'TEXT' | 'PLAN' | 'EXECUTION' | 'RESULT' | 'ERROR' | 'SYSTEM';
  plan?: OrganizationalPlan;
  task?: Task;
  stepId?: string;
}

export interface OfficeActivityEvent {
  id: string;
  timestamp: string;
  type: 'OBJECTIVE_RECEIVED' | 'PLAN_CREATED' | 'AGENT_ASSIGNED' | 'TASK_RUNNING' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'FALLBACK_TRIGGERED';
  title: string;
  description: string;
  agentId?: string;
  taskId?: string;
  meta?: Record<string, any>;
}
